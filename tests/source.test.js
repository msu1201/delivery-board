import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, symlink, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Source, readScoped } from "../src/source.js";
const g = {
  schemaVersion: 1,
  project: { id: "s", name: "Synthetic" },
  groups: [{ id: "g", title: "Group" }],
  views: [{ id: "all", title: "All", mode: "all" }],
  nodes: [
    {
      id: "a",
      title: "Before",
      groupId: "g",
      kind: "product",
      status: "planned",
      dependsOn: [],
      acceptance: [],
      evidence: [],
    },
  ],
};
async function setup(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "board-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, "graph.json"), JSON.stringify(g));
  await writeFile(path.join(root, "context.md"), "context");
  const config = {
    root,
    adapter: "normalized",
    sources: { graph: "graph.json", context: "context.md" },
  };
  return { root, config, source: new Source(config) };
}
test("refresh records changed state and hash, same source graph retained on half-written/missing input", async (t) => {
  const { root, source } = await setup(t);
  const a = await source.refresh();
  assert.equal(a.stale, false);
  assert.equal(a.graph.nodes[0].title, "Before");
  await writeFile(
    path.join(root, "graph.json"),
    JSON.stringify({ ...g, nodes: [{ ...g.nodes[0], title: "After" }] }),
  );
  const b = await source.refresh();
  assert.notEqual(b.freshness.hash, a.freshness.hash);
  assert.equal(b.graph.nodes[0].title, "After");
  await writeFile(path.join(root, "graph.json"), "{");
  const bad = await source.refresh();
  assert.equal(bad.stale, true);
  assert.equal(bad.graph.nodes[0].title, "After");
  assert.equal(bad.freshness.completedAt, b.freshness.completedAt);
  await rm(path.join(root, "context.md"));
  assert.equal((await source.refresh()).stale, true);
});
test("reject traversal, absolute path, symlink directory and leaf escape", async (t) => {
  const { root } = await setup(t);
  await symlink(os.tmpdir(), path.join(root, "link"));
  await symlink(path.join(root, "graph.json"), path.join(root, "leaf"));
  for (const ref of [
    "../file",
    "/etc/passwd",
    "link/a",
    "leaf",
    "a/../graph.json",
  ])
    await assert.rejects(() => readScoped(root, ref));
});
test("bounded multi-file consistency retry and concurrent refresh serialization", async (t) => {
  const { root, source } = await setup(t);
  let calls = 0;
  source.afterRead = async () => {
    calls++;
    await writeFile(path.join(root, "context.md"), String(calls));
  };
  const a = await source.refresh();
  assert.equal(a.stale, true);
  assert.equal(a.graph, null);
  assert.equal(calls, 3);
  source.afterRead = null;
  const results = await Promise.all([
    source.refresh(),
    source.refresh(),
    source.refresh(),
  ]);
  assert.ok(results.every((x) => !x.stale));
  assert.equal(new Set(results.map((x) => x.sequence)).size, 3);
});
test("retries a torn read then returns coherent later generation", async (t) => {
  const { root, source } = await setup(t);
  let once = true;
  source.afterRead = async () => {
    if (once) {
      once = false;
      await writeFile(path.join(root, "context.md"), "new");
    }
  };
  const a = await source.refresh();
  assert.equal(a.stale, false);
  assert.equal(a.freshness.attempts, 2);
});
test("invalid optional node details retain the last valid snapshot as stale", async (t) => {
  const { root, source } = await setup(t);
  const good = await source.refresh();
  for (const fields of [
    { blockers: "invalid" },
    { blockers: [null] },
    { journeys: [null] },
    { delivery: { status: [] } },
  ]) {
    await writeFile(
      path.join(root, "graph.json"),
      JSON.stringify({ ...g, nodes: [{ ...g.nodes[0], ...fields }] }),
    );
    const bad = await source.refresh();
    assert.equal(bad.stale, true, JSON.stringify(fields));
    assert.ok(bad.error);
    assert.deepEqual(bad.graph, good.graph);
    assert.deepEqual(bad.freshness, good.freshness);
  }
});
test("evidence identity cannot change after another client refresh adds a reference", async (t) => {
  const { root, config } = await setup(t);
  config.evidenceAllowlist = ["a.md", "z.md"];
  await writeFile(path.join(root, "z.md"), "Z evidence");
  await writeFile(path.join(root, "a.md"), "A evidence");
  const z = structuredClone(g);
  z.nodes[0].evidence = [{ ref: "z.md", label: "Z" }];
  await writeFile(path.join(root, "graph.json"), JSON.stringify(z));
  const source = new Source(config);
  await source.refresh();
  const oldId = source.evidenceId("z.md");
  z.nodes[0].evidence.unshift({ ref: "a.md", label: "A" });
  await writeFile(path.join(root, "graph.json"), JSON.stringify(z));
  await source.refresh();
  assert.equal((await source.evidence(oldId)).content, "Z evidence");
  await assert.rejects(() => source.evidence("0"));
});
test("cycle and dangling dependency failures keep prior successful snapshot", async (t) => {
  const { root, source } = await setup(t);
  const good = await source.refresh();
  for (const deps of [["missing"], ["a"]]) {
    const invalid = structuredClone(g);
    invalid.nodes[0].dependsOn = deps;
    await writeFile(path.join(root, "graph.json"), JSON.stringify(invalid));
    const result = await source.refresh();
    assert.equal(result.stale, true);
    assert.equal(result.freshness.hash, good.freshness.hash);
    assert.deepEqual(result.graph.nodes[0].dependsOn, []);
  }
});
test("evidence symlink and non-allowlisted references never disclose content", async (t) => {
  const { root, config } = await setup(t);
  config.evidenceAllowlist = ["outside.md"];
  const raw = structuredClone(g);
  raw.nodes[0].evidence = [
    { ref: "outside.md", label: "Outside" },
    { ref: "context.md", label: "Not allowed" },
  ];
  await writeFile(path.join(root, "graph.json"), JSON.stringify(raw));
  await symlink(path.join(root, "context.md"), path.join(root, "outside.md"));
  const source = new Source(config);
  await source.refresh();
  await assert.rejects(() => source.evidence(source.evidenceId("outside.md")));
  await assert.rejects(() => source.evidence(source.evidenceId("context.md")));
});
test("source root is pinned and retargeting a configured root symlink is rejected", async (t) => {
  const { root, config } = await setup(t);
  await import("node:fs/promises").then(async (fs) => {
    await fs.mkdir(path.join(root, "one"));
    await fs.mkdir(path.join(root, "two"));
    for (const dir of ["one", "two"]) {
      await writeFile(path.join(root, dir, "graph.json"), JSON.stringify(g));
      await writeFile(path.join(root, dir, "context.md"), dir);
    }
    await symlink(path.join(root, "one"), path.join(root, "current"));
    config.root = path.join(root, "current");
    const source = new Source(config);
    const good = await source.refresh();
    assert.equal(good.stale, false);
    await rm(path.join(root, "current"));
    await symlink(path.join(root, "two"), path.join(root, "current"));
    const moved = await source.refresh();
    assert.equal(moved.stale, true);
    assert.equal(moved.freshness.hash, good.freshness.hash);
  });
});
test("journey-only evidence obeys the same stable-ID allowlist; invalid pass retains previous journey", async (t) => {
  const { root, config } = await setup(t);
  config.evidenceAllowlist = ["flow.md"];
  await writeFile(path.join(root, "flow.md"), "Independent flow evidence");
  const graph = structuredClone(g);
  graph.journeys = [
    {
      id: "FLOW",
      title: "Flow",
      itemIds: ["a"],
      outcome: "Open and complete",
      boundaries: "Retry",
      acceptanceCriteria: ["End to end"],
      recordSource: "explicit",
      localVerification: {
        status: "partial",
        testedCommit: "abc",
        evidence: [{ label: "Flow", ref: "flow.md" }],
      },
      acceptanceReview: { status: "not_accepted", evidence: [] },
      delivery: { status: "pending_integration", evidence: [] },
    },
  ];
  await writeFile(path.join(root, "graph.json"), JSON.stringify(graph));
  const source = new Source(config);
  assert.equal((await source.refresh()).stale, false);
  assert.equal(
    (await source.evidence(source.evidenceId("flow.md"))).content,
    "Independent flow evidence",
  );
  graph.journeys[0].localVerification = {
    status: "passed",
    testedCommit: "abc",
    evidence: [],
  };
  await writeFile(path.join(root, "graph.json"), JSON.stringify(graph));
  const bad = await source.refresh();
  assert.equal(bad.stale, true);
  assert.equal(bad.graph.journeys[0].localVerification.status, "partial");
});
