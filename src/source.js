import { open, lstat, realpath, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { validateGraph } from "./model.js";
const exec = promisify(execFile),
  hash = (x) => createHash("sha256").update(x).digest("hex");
export function safeRelative(ref) {
  if (
    typeof ref !== "string" ||
    !ref ||
    ref.includes("\\") ||
    ref.includes("\0") ||
    ref.includes("%") ||
    ref.includes(":") ||
    ref.includes("?") ||
    ref.includes("#") ||
    path.isAbsolute(ref) ||
    ref.split("/").some((x) => !x || x === "." || x === "..")
  )
    throw new Error("Unsafe source path");
  return ref;
}
export async function readScoped(root, ref, expectedRoot) {
  safeRelative(ref);
  const base = await realpath(root);
  if (expectedRoot && base !== expectedRoot)
    throw new Error("Source root changed");
  const target = path.join(base, ref);
  let cur = base;
  for (const part of ref.split("/")) {
    cur = path.join(cur, part);
    if ((await lstat(cur)).isSymbolicLink())
      throw new Error("Symlink source refused");
  }
  if ((await realpath(target)) !== target)
    throw new Error("Source escaped root");
  const fh = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await fh.stat();
    if (!before.isFile() || before.size > 2 * 1024 * 1024)
      throw new Error("Source must be regular file ≤2 MiB");
    const content = await fh.readFile("utf8");
    const after = await fh.stat(),
      current = await lstat(target);
    if (
      (await realpath(target)) !== target ||
      current.isSymbolicLink() ||
      before.ino !== current.ino ||
      before.dev !== current.dev ||
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs ||
      content.length > 2 * 1024 * 1024
    )
      throw new Error("Source changed while reading");
    return {
      content,
      hash: hash(content),
      mtime: new Date(after.mtimeMs).toISOString(),
      size: after.size,
      identity: `${after.dev}:${after.ino}:${after.ctimeMs}`,
    };
  } finally {
    await fh.close();
  }
}
export async function loadConfig(file) {
  const config = JSON.parse(await readFile(file, "utf8"));
  config.root = path.resolve(path.dirname(file), config.root);
  return config;
}
async function gitMeta(config) {
  if (config.git === false)
    return { head: null, branch: null, dirty: null, dirtyScope: "unknown" };
  const run = (args) =>
    exec("git", ["-C", config.root, ...args], {
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
      timeout: 4000,
      maxBuffer: 2 * 1024 * 1024,
    }).then((r) => r.stdout.trim());
  try {
    const [head, branch, status] = await Promise.all([
      run(["rev-parse", "HEAD"]),
      run(["branch", "--show-current"]),
      run([
        "status",
        "--porcelain=v1",
        "--untracked-files=normal",
        "--",
        ...Object.values(config.sources),
      ]),
    ]);
    return {
      head,
      branch: branch || "detached",
      dirty: !!status,
      dirtyScope: "configured source files",
      statusHash: hash(status),
    };
  } catch {
    if (config.git === true)
      throw new Error("Required Git metadata unavailable");
    return { head: null, branch: null, dirty: null, dirtyScope: "unknown" };
  }
}
export class Source {
  constructor(config) {
    if (
      !config?.sources ||
      !["ledger-v1", "normalized"].includes(config.adapter)
    )
      throw new Error("Unsupported source configuration");
    Object.values(config.sources).forEach(safeRelative);
    if (Object.keys(config.sources).length > 12)
      throw new Error("Too many sources");
    this.config = config;
    this.last = null;
    this.sequence = 0;
    this.queue = Promise.resolve();
    this.afterRead = null;
  }
  refresh() {
    const task = this.queue.then(() => this.readSnapshot());
    this.queue = task.catch(() => {});
    return task;
  }
  async assertRoot() {
    const current = await realpath(this.config.root);
    if (this.root && current !== this.root)
      throw new Error("Configured source root was retargeted");
    this.root = current;
    return current;
  }
  async readSet() {
    await this.assertRoot();
    const entries = await Promise.all(
      Object.entries(this.config.sources).map(async ([key, ref]) => [
        key,
        { ref, ...(await readScoped(this.root, ref, this.root)) },
      ]),
    );
    return Object.fromEntries(entries);
  }
  async readSnapshot() {
    const startedAt = new Date().toISOString(),
      sequence = ++this.sequence;
    let error;
    for (let attempts = 1; attempts <= 3; attempts++)
      try {
        await this.assertRoot();
        const gitBefore = await gitMeta({ ...this.config, root: this.root }),
          a = await this.readSet();
        await this.afterRead?.(attempts);
        const b = await this.readSet(),
          gitAfter = await gitMeta({ ...this.config, root: this.root });
        await this.assertRoot();
        const signature = (x) =>
          JSON.stringify(
            Object.entries(x).map(([k, v]) => [k, v.hash, v.mtime, v.identity]),
          );
        if (
          signature(a) !== signature(b) ||
          JSON.stringify(gitBefore) !== JSON.stringify(gitAfter)
        )
          throw new Error("Source changed during multi-file snapshot");
        const documents = Object.fromEntries(
          Object.entries(b).map(([k, v]) => [k, v.content]),
        );
        const graph =
          this.config.adapter === "normalized"
            ? JSON.parse(documents.graph)
            : (await import("./adapters/ledger.js")).adaptLedger(
                documents,
                this.config,
              );
        validateGraph(graph);
        const freshness = {
          startedAt,
          completedAt: new Date().toISOString(),
          attempts,
          hash: hash(signature(b)),
          sourceTime: Object.values(b)
            .map((v) => v.mtime)
            .sort()
            .at(-1),
          files: Object.values(b).map(({ ref, hash, mtime, size }) => ({
            path: ref,
            hash,
            mtime,
            size,
          })),
          git: gitAfter,
          remote: "Recorded only; remote CI not queried",
          root: this.config.root,
        };
        this.last = { graph, freshness };
        return {
          ...this.last,
          stale: false,
          error: null,
          sequence,
          attemptedAt: startedAt,
        };
      } catch (e) {
        error =
          e instanceof SyntaxError
            ? "Source JSON is incomplete or invalid"
            : e.code
              ? `Source read failed (${e.code})`
              : e.message;
      }
    return {
      ...(this.last || { graph: null, freshness: null }),
      stale: true,
      error,
      sequence,
      attemptedAt: startedAt,
    };
  }
  evidenceId(ref) {
    return hash(ref);
  }
  async evidence(id) {
    await this.assertRoot();
    if (!this.last) throw new Error("No valid snapshot");
    const refs = this.references();
    const ref = refs.find((r) => this.evidenceId(r) === id);
    if (!ref || !(this.config.evidenceAllowlist || []).includes(ref))
      throw new Error("Evidence not allowlisted");
    const data = await readScoped(this.root, ref, this.root);
    return {
      ref,
      ...data,
      readAt: new Date().toISOString(),
      snapshotHash: this.last.freshness.hash,
    };
  }
  references() {
    return [
      ...new Set(
        [
          ...(this.last?.graph.nodes || []),
          ...(this.last?.graph.journeys || []).map((j) => ({
            evidence: [
              ...(j.localVerification?.evidence || []),
              ...(j.acceptanceReview?.evidence || []),
              ...(j.delivery?.evidence || []),
            ],
          })),
        ]
          .flatMap((n) =>
            [...(n.evidence || []), ...(n.references || [])].map((e) => e.ref),
          )
          .filter((r) => (this.config.evidenceAllowlist || []).includes(r)),
      ),
    ].sort();
  }
}
