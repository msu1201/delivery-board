import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdtemp, cp, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Source, loadConfig } from "../src/source.js";
import { startServer } from "../src/server.js";
const root = await mkdtemp(path.join(os.tmpdir(), "journey-board-")),
  out = path.resolve("local/evidence/journeys");
await mkdir(out, { recursive: true });
await cp("examples/synthetic", root, { recursive: true });
const file = path.join(root, "graph.json"),
  g = JSON.parse(await readFile(file, "utf8"));
const j = {
  id: "FLOW-A",
  title: "Read the complete archive",
  itemIds: ["INGEST", "SEARCH"],
  outcome: "Search → read → recover",
  boundaries: "Lost response and retry",
  acceptanceCriteria: ["Complete the full visitor loop"],
  recordSource: "explicit",
  localVerification: {
    status: "partial",
    testedCommit: "abc123",
    evidence: [{ label: "Independent flow record", ref: "flow.md" }],
  },
  acceptanceReview: { status: "not_accepted", evidence: [] },
  delivery: { status: "pending_integration", evidence: [] },
};
g.journeys = [
  j,
  {
    ...structuredClone(j),
    id: "FLOW-B",
    title: "Shared import path",
    itemIds: ["INGEST"],
  },
];
await writeFile(file, JSON.stringify(g));
await writeFile(
  path.join(root, "flow.md"),
  "Independent journey evidence; not whole-loop acceptance.",
);
const config = await loadConfig(path.join(root, "config.json"));
config.evidenceAllowlist.push("flow.md");
const server = await startServer(new Source(config), 0);
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
  assert.match(await page.locator('#journey-select option[value="FLOW-A"]').textContent(), /🟪.*部分验证.*环节 0\/2/);
  await page.locator("#journey-select").selectOption("FLOW-A");
  assert.match(await page.locator('#journey-summary').innerText(), /已完成 0\/2/);
  assert.match(await page.locator('#detail .journey-status').innerText(), /闭环确认 0\/3/);
  await page
    .locator("#detail")
    .filter({ hasText: "部分验证，未全部通过" })
    .waitFor();
  assert.match(await page.locator("#detail").innerText(), /未验收/);
  assert.match(await page.locator("#detail").innerText(), /尚未交付/);
  assert.match(await page.locator("#counts").innerText(), /3 \/ 10/);
  const ids = await page.evaluate(() =>
    document
      .getElementById("cy")
      ._cyreg.cy.nodes()
      .filter((n) => !n.isParent())
      .map((n) => n.data("originalId")),
  );
  assert.deepEqual(ids.sort(), ["ARCHIVE-SPEC", "INGEST", "SEARCH"].sort());
  await page
    .locator("#detail")
    .getByRole("button", { name: "Independent flow record" })
    .click();
  await page
    .locator("#evidence-content")
    .filter({ hasText: "Independent journey evidence" })
    .waitFor();
  await page.getByRole("button", { name: "关闭证据" }).click();
  await page.screenshot({
    path: path.join(out, "synthetic-flow.png"),
    fullPage: true,
  });
  await page.locator("#journey-select").selectOption("FLOW-B");
  assert.match(await page.locator("#counts").innerText(), /2 \/ 10/);
  await page
    .locator("#node-list")
    .getByRole("button", { name: /INGEST/ })
    .click();
  await page.getByRole("button", { name: "返回闭环验收" }).click();
  assert.match(
    await page.locator(".detail-title").innerText(),
    /Shared import/,
  );
  g.journeys[1].localVerification = {
    status: "passed",
    testedCommit: "new456",
    evidence: [{ label: "Independent flow record", ref: "flow.md" }],
  };
  await writeFile(file, JSON.stringify(g));
  await page.locator("#refresh").click();
  await page
    .locator("#detail")
    .filter({ hasText: "本地验证通过（记录）" })
    .waitFor();
  assert.equal(await page.locator("#journey-select").inputValue(), "FLOW-B");
  assert.match(await page.locator("#detail").innerText(), /未验收/);
  g.journeys[1].localVerification.evidence = [];
  await writeFile(file, JSON.stringify(g));
  await page.locator("#refresh").click();
  await page.locator("#alert.error").waitFor();
  assert.match(
    await page.locator("#detail").innerText(),
    /本地验证通过（记录）/,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: path.join(out, "synthetic-stale-narrow.png"),
    fullPage: true,
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  delete g.journeys;
  await writeFile(file, JSON.stringify(g));
  await page.locator("#refresh").click();
  await page.locator("#alert:not(.error)").waitFor();
  assert.equal(await page.locator("#journey-select").isDisabled(), true);
  if (process.env.BOARD_JOURNEY_REAL_ACCEPTANCE) {
    const hook = await import(
      pathToFileURL(path.resolve(process.env.BOARD_JOURNEY_REAL_ACCEPTANCE))
    );
    await hook.default(page, out, process.env.BOARD_JOURNEY_REAL_URL);
  }
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(out, "results.json"),
    JSON.stringify(
      {
        passed: true,
        real: !!process.env.BOARD_JOURNEY_REAL_URL,
        checks: [
          "journey selection and prerequisite closure",
          "shared task has one entity",
          "independent partial/not accepted/not delivered",
          "journey-only allowlisted evidence",
          "external edit refresh preserves journey",
          "invalid pass retains stale graph",
          "legacy without journeys",
          "390px no overflow",
        ],
        errors,
      },
      null,
      2,
    ),
  );
  console.log("Journey browser acceptance passed");
} finally {
  await browser.close();
  await server.close();
  await rm(root, { recursive: true, force: true });
}
