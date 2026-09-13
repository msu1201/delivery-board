import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir, rm, cp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Source, loadConfig } from "../src/source.js";
import { startServer } from "../src/server.js";
const out = path.resolve(process.env.BOARD_EVIDENCE_DIR || "local/evidence");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--no-first-run"],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const report = [];
async function until(predicate) {
  const deadline = Date.now() + 10000;
  while (!predicate()) {
    if (Date.now() > deadline) throw Error("Browser synchronization deadline");
    await new Promise((r) => setTimeout(r, 10));
  }
}
const shot = (name) =>
  page.screenshot({ path: path.join(out, name + ".png"), fullPage: true });
const choose = async (id) => {
  await page.locator("#search").fill(id);
  await page.locator("#search").press("Enter");
  await page.locator(".node-id").filter({ hasText: id }).waitFor();
};
let synthetic;
const tmp = await mkdtemp(path.join(os.tmpdir(), "board-browser-"));
try {
  await cp("examples/synthetic", tmp, { recursive: true });
  const config = await loadConfig(path.join(tmp, "config.json"));
  config.evidenceAllowlist.push("second.md");
  await writeFile(path.join(tmp, "second.md"), "Second document content");
  synthetic = await startServer(new Source(config), 0);
  await page.goto(synthetic.url);
  await page
    .locator("#project-name")
    .filter({ hasText: "Community archive" })
    .waitFor();
  await shot("synthetic-overview");
  const groupPoint = await page.evaluate(() => {
    const e = document.getElementById("cy"),
      c = e._cyreg.cy,
      p = c.getElementById("group:foundation").renderedPosition(),
      r = e.getBoundingClientRect();
    return { x: p.x + r.x, y: p.y + r.y };
  });
  await page.mouse.click(groupPoint.x, groupPoint.y);
  assert.equal(
    await page.locator("#groups button").first().getAttribute("aria-expanded"),
    "true",
  );
  await page.getByRole("button", { name: "展开全部", exact: true }).click();
  await page.getByRole("button", { name: "查看全图", exact: true }).click();
  await shot("synthetic-expanded");
  const geometry = await page.evaluate(() => {
    const cy = document.getElementById("cy")._cyreg.cy;
    return {
      nodes: cy
        .nodes()
        .filter((n) => !n.isParent())
        .map((n) => ({
          id: n.id(),
          ...n.position(),
          w: n.width(),
          h: n.height(),
          grabbable: n.grabbable(),
        })),
      edges: cy
        .edges()
        .map((e) => ({
          source: e.source().id(),
          target: e.target().id(),
          points: [
            e.sourceEndpoint(),
            ...e.segmentPoints(),
            e.targetEndpoint(),
          ],
        })),
    };
  });
  assert.equal(geometry.nodes.length, 10);
  assert.equal(geometry.edges.length, 10);
  assert.ok(geometry.nodes.every((n) => !n.grabbable));
  const { intersects } = await import("../public/routing.js");
  for (const edge of geometry.edges)
    for (const node of geometry.nodes.filter(
      (n) => ![edge.source, edge.target].includes(n.id),
    ))
      for (let i = 1; i < edge.points.length; i++)
        assert.equal(
          intersects(edge.points[i - 1], edge.points[i], node),
          false,
          `Edge ${edge.source}→${edge.target} crosses ${node.id}`,
        );
  // A physical click on the canvas uses the same detail action as the keyboard list.
  const target = await page.evaluate(() => {
    const c = document.getElementById("cy"),
      cy = c._cyreg.cy,
      n = cy.getElementById("INGEST");
    const p = n.renderedPosition(),
      r = c.getBoundingClientRect();
    return { x: p.x + r.x, y: p.y + r.y };
  });
  await page.mouse.click(target.x, target.y);
  await page.locator(".node-id").filter({ hasText: "INGEST" }).waitFor();
  report.push(
    "Canvas node click selects details; rendered edges avoid intermediate node bodies, 10 entities/10 real edges and node dragging disabled.",
  );
  await choose("INGEST");
  assert.match(await page.locator("#detail").innerText(), /已完成（来源记录）/);
  assert.match(await page.locator("#detail").innerText(), /尚未交付/);
  await shot("synthetic-ingest");
  const zoomBefore = await page.locator("#zoom-value").innerText();
  await page.getByRole("button", { name: "放大", exact: true }).click();
  assert.notEqual(await page.locator("#zoom-value").innerText(), zoomBefore);
  await page.getByRole("button", { name: "聚焦这条依赖链" }).click();
  await page.getByRole("button", { name: "退出依赖聚焦" }).click();
  await page.getByRole("button", { name: "Review focus", exact: true }).click();
  assert.match(await page.locator("#counts").innerText(), /3 个外部前置/);
  await shot("synthetic-hidden-prerequisites");
  await page.getByRole("button", { name: "All work", exact: true }).click();
  await choose("INGEST");
  await page
    .locator("#detail")
    .getByRole("button", { name: "Fictional demonstration record" })
    .click();
  await page
    .locator("#evidence-content")
    .filter({ hasText: /fictional/i })
    .waitFor();
  await page.getByRole("button", { name: "关闭证据" }).click();
  const file = path.join(tmp, "graph.json"),
    original = JSON.parse(await readFile(file, "utf8"));
  const changed = structuredClone(original);
  changed.nodes
    .find((n) => n.id === "INGEST")
    .evidence.push({ label: "Second evidence", ref: "second.md" });
  changed.nodes.find((n) => n.id === "INGEST").title =
    "Externally saved revision";
  changed.nodes.find((n) => n.id === "INGEST").blockers[0].next_action =
    "New saved recovery action";
  changed.nodes.find((n) => n.id === "INGEST").dependsOn = [];
  const panBefore = await page.evaluate(() =>
    document.getElementById("cy")._cyreg.cy.pan(),
  );
  const box = await page.locator("#cy").boundingBox();
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 65, box.y + 40, { steps: 5 });
  await page.mouse.up();
  assert.notDeepEqual(
    await page.evaluate(() => document.getElementById("cy")._cyreg.cy.pan()),
    panBefore,
  );
  const oldPan = await page.evaluate(() =>
    document.getElementById("cy")._cyreg.cy.pan(),
  );
  const oldHash = await page.locator("#sources").textContent(),
    oldZoom = await page.locator("#zoom-value").innerText();
  await writeFile(file, JSON.stringify(changed));
  await page.locator("#refresh").click();
  await page
    .locator(".detail-title")
    .filter({ hasText: "Externally saved revision" })
    .waitFor();
  assert.match(
    await page.locator("#detail").innerText(),
    /New saved recovery action/,
  );
  assert.notEqual(await page.locator("#sources").textContent(), oldHash);
  assert.equal(await page.locator("#search").inputValue(), "INGEST");
  assert.equal(await page.locator("#zoom-value").innerText(), oldZoom);
  assert.deepEqual(
    await page.evaluate(() => document.getElementById("cy")._cyreg.cy.pan()),
    oldPan,
  );
  await shot("synthetic-refreshed");
  report.push(
    "External fixture edit + ordinary Refresh updates title, blocker, dependency and hash; selection/search/zoom retained.",
  );

  await page.locator("#auto-refresh").uncheck();
  // Two in-flight UI refreshes resolved in reverse order.
  const pending = [];
  await page.route("**/api/snapshot", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.graph.project.name = `Request-${pending.length + 1}`;
    data.freshness.hash = `request-${pending.length + 1}`;
    pending.push({ route, data });
  });
  await page.locator("#refresh").click();
  await until(() => pending.length >= 1);
  await page.locator("#refresh").click();
  await until(() => pending.length >= 2);
  await pending[1].route.fulfill({ json: pending[1].data });
  await page
    .locator("#project-name")
    .filter({ hasText: "Request-2" })
    .waitFor();
  await pending[0].route.fulfill({ json: pending[0].data });
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  assert.equal(await page.locator("#project-name").innerText(), "Request-2");
  await page.unroute("**/api/snapshot");
  report.push("Browser reversed refresh responses retain the latest result.");
  // Close document A, open B; a late response from A cannot overwrite B.
  const evidencePending = [];
  await page.route("**/api/evidence?*", async (route) => {
    const response = await route.fetch();
    evidencePending.push({ route, data: await response.json() });
  });
  await page
    .locator("#detail")
    .getByRole("button", { name: "Fictional demonstration record" })
    .click();
  await until(() => evidencePending.length >= 1);
  await page.getByRole("button", { name: "关闭证据" }).click();
  await page
    .locator("#detail")
    .getByRole("button", { name: "Second evidence" })
    .click();
  await until(() => evidencePending.length >= 2);
  await evidencePending[1].route.fulfill({ json: evidencePending[1].data });
  await page
    .locator("#evidence-content")
    .filter({ hasText: "Second document content" })
    .waitFor();
  await evidencePending[0].route.fulfill({ json: evidencePending[0].data });
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  assert.equal(
    await page.locator("#evidence-content").innerText(),
    "Second document content",
  );
  assert.equal(await page.locator("#evidence-title").innerText(), "second.md");
  await page.getByRole("button", { name: "关闭证据" }).click();
  await page.unroute("**/api/evidence?*");
  report.push("Late evidence response cannot replace another open document.");
  const successTime = await page.locator("#read-time").innerText();
  await writeFile(file, "{");
  await page.locator("#refresh").click();
  await page.locator("#alert.error").waitFor();
  assert.match(
    await page.locator(".detail-title").innerText(),
    /Externally saved/,
  );
  assert.equal(await page.locator("#read-time").innerText(), successTime);
  await shot("synthetic-stale");
  await writeFile(file, JSON.stringify(changed));
  await page.locator("#refresh").click();
  await page.locator("#alert:not(.error)").waitFor();
  const malicious = structuredClone(changed);
  malicious.nodes.find((n) => n.id === "INGEST").title =
    '<img src=x onerror="window.pwned=true">';
  malicious.nodes.find((n) => n.id === "INGEST").references = [
    { label: "Unsafe script", ref: "javascript:alert(1)" },
  ];
  await writeFile(file, JSON.stringify(malicious));
  await page.locator("#refresh").click();
  await page.locator(".detail-title").filter({ hasText: "<img" }).waitFor();
  assert.equal(await page.locator("#detail img").count(), 0);
  assert.equal(await page.locator('#detail a[href^="javascript:"]').count(), 0);
  assert.equal(await page.evaluate(() => window.pwned), undefined);
  report.push(
    "Malicious title displayed literally; script URL has no active link.",
  );
  await writeFile(file, JSON.stringify(original));
  await page.reload();
  await page
    .locator("#project-name")
    .filter({ hasText: "Community archive" })
    .waitFor();
  await choose("NEXT-SEASON");
  assert.match(await page.locator("#detail").innerText(), /范围未完全展开/);
  await page.setViewportSize({ width: 390, height: 844 });
  await choose("RIGHTS");
  assert.match(await page.locator("#detail").innerText(), /人类验收已延期/);
  await shot("synthetic-narrow");
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    JSON.stringify(
      await page.evaluate(() =>
        [...document.querySelectorAll("body *")]
          .filter((e) => e.getBoundingClientRect().right > innerWidth)
          .map((e) => [
            e.tagName,
            e.id,
            e.className,
            e.getBoundingClientRect().right,
          ])
          .slice(0, 20),
      ),
    ),
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator("#search").fill("CURATOR");
  await page.locator("#node-list button").first().focus();
  await page.keyboard.press("Enter");
  assert.match(await page.locator(".node-id").innerText(), /CURATOR/);
  report.push(
    "Keyboard Enter, groups, view boundaries, zoom, fit, dependency focus and evidence dialog operated; 390px no page overflow.",
  );
  await synthetic.close();
  synthetic = null;
  await page.locator("#refresh").click();
  await page.locator("#alert.error").waitFor();
  assert.match(await page.locator(".node-id").innerText(), /CURATOR/);
  await shot("service-unavailable");
  report.push(
    "Half-written source and stopped service preserve previous graph and successful timestamp with STALE/ERROR.",
  );
  if (process.env.BOARD_REAL_ACCEPTANCE) {
    const { acceptReal } = await import(
      path.resolve(process.env.BOARD_REAL_ACCEPTANCE)
    );
    await acceptReal({ page, choose, shot, report, assert });
  }
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(out, "browser-results.json"),
    JSON.stringify(
      {
        passed: true,
        checks: report,
        browser: await browser.version(),
        consoleErrors: errors,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({ passed: true, checks: report, evidence: out }, null, 2),
  );
} finally {
  if (synthetic) await synthetic.close();
  await browser.close();
  await rm(tmp, { recursive: true, force: true });
}
