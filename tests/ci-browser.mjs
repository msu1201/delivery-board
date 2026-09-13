import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdtemp, cp, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Source, loadConfig } from "../src/source.js";
import { startServer } from "../src/server.js";
const root = await mkdtemp(path.join(os.tmpdir(), "board-ci-"));
const out = path.resolve("local/evidence/launcher-ci");
await mkdir(out, { recursive: true });
await cp("examples/synthetic", root, { recursive: true });
const file = path.join(root, "graph.json"),
  g = JSON.parse(await readFile(file, "utf8"));
const server = await startServer(
  new Source(await loadConfig(path.join(root, "config.json"))),
  0,
);
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(5000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(server.url);
  await page.locator("#search").fill("INGEST");
  await page.locator("#search").press("Enter");
  await page
    .locator("#detail .ci-current")
    .filter({ hasText: "未知 / 未记录" })
    .waitFor();
  const policy = {
    status: "waived",
    decision_ref: "DEC-EXAMPLE",
    reason: "No CI quota",
    replacement: "Local integration and acceptance remain required",
    effective_on: "2026-09-09",
    until: "User restores the CI requirement",
  };
  g.ciPolicy = policy;
  const n = g.nodes.find((n) => n.id === "INGEST");
  n.delivery = { status: "pending_integration", ci: policy };
  n.checkpoint = {
    ...(n.checkpoint || {}),
    ci: "Prior CI jobs did not start",
    ci_observation: {
      status: "jobs_not_started",
      checked_at: "2026-09-08T01:00:00Z",
    },
  };
  n.blockers = [
    {
      id: "CI",
      state: "resolved",
      resolution: "waived_by_user",
      next_action: "No CI retry required under current policy",
    },
    {
      id: "REVIEW",
      state: "awaiting_authorization",
      owner: "Reviewer",
      next_action: "Review integration",
    },
  ];
  await writeFile(file, JSON.stringify(g));
  await page.locator("#refresh").click();
  await page
    .locator("#ci-policy")
    .filter({ hasText: "用户已豁免 · 未运行" })
    .waitFor();
  const current = page.locator("#detail .ci-current");
  assert.match(await current.innerText(), /DEC-EXAMPLE/);
  assert.match(await current.innerText(), /Local integration/);
  assert.match(await current.innerText(), /不计为通过/);
  assert.match(
    await page.locator("#detail .ci-history").innerText(),
    /历史.*Prior CI jobs did not start/s,
  );
  assert.match(await page.locator("#detail").innerText(), /尚未交付/);
  assert.match(await page.locator("#detail").innerText(), /REVIEW/);
  await page.screenshot({
    path: path.join(out, "synthetic-ci-waiver.png"),
    fullPage: true,
  });
  const ev = page.locator("#detail .ref-row button").first();
  if (await ev.count()) {
    await ev.click();
    await page
      .locator("#evidence-meta")
      .filter({ hasText: "SHA256" })
      .waitFor();
    await page.getByRole("button", { name: "关闭证据" }).click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: path.join(out, "synthetic-ci-narrow.png"),
    fullPage: true,
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  delete g.ciPolicy;
  delete n.delivery.ci;
  await writeFile(file, JSON.stringify(g));
  await page.locator("#refresh").click();
  await current.filter({ hasText: "未知 / 未记录" }).waitFor();
  assert.equal(await page.locator("#ci-policy").isHidden(), true);
  if (process.env.BOARD_CI_REAL_ACCEPTANCE) {
    const hook = await import(
      pathToFileURL(path.resolve(process.env.BOARD_CI_REAL_ACCEPTANCE))
    );
    await hook.default(page, out, process.env.BOARD_CI_REAL_URL);
  }
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(out, "browser-results.json"),
    JSON.stringify(
      {
        passed: true,
        real: !!process.env.BOARD_CI_REAL_ACCEPTANCE,
        checks: [
          "legacy unknown",
          "current waiver separate from history",
          "refresh retains node",
          "other blockers and delivery retained",
          "evidence",
          "390px no overflow",
        ],
        errors,
      },
      null,
      2,
    ),
  );
  console.log("CI browser acceptance passed");
} finally {
  await browser.close();
  await server.close();
  await rm(root, { recursive: true, force: true });
}
