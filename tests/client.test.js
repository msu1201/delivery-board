import test from "node:test";
import assert from "node:assert/strict";
import { RefreshController, safeWebURL } from "../public/client-state.js";
test("late successes and errors cannot overwrite newer refresh; last good graph survives failure", async () => {
  const calls = [],
    applied = [];
  const c = new RefreshController(
    () => new Promise((resolve, reject) => calls.push({ resolve, reject })),
    (s) => applied.push(s),
  );
  const a = c.refresh();
  const b = c.refresh();
  calls[1].resolve({
    graph: { id: "new" },
    stale: false,
    freshness: { completedAt: "new" },
  });
  await b;
  calls[0].resolve({ graph: { id: "old" }, stale: false });
  await a;
  assert.equal(applied.length, 1);
  assert.equal(c.snapshot.graph.id, "new");
  const bad = c.refresh();
  calls[2].reject(Error("offline"));
  await bad;
  assert.equal(c.snapshot.graph.id, "new");
  assert.equal(c.snapshot.stale, true);
  assert.equal(c.snapshot.freshness.completedAt, "new");
});
test("only http(s) links without credentials are allowed", () => {
  for (const x of [
    "javascript:alert(1)",
    "data:text/html,x",
    "file:///etc/passwd",
    "https://a:b@example.com",
    "//evil.example",
    "  javascript:alert(1)",
  ])
    assert.equal(safeWebURL(x), null);
  assert.equal(
    safeWebURL("https://example.com/pr/1"),
    "https://example.com/pr/1",
  );
});
test("evidence requests only apply the latest dialog response, including late errors", async () => {
  const { LatestOnly } = await import("../public/client-state.js");
  const latest = new LatestOnly(),
    pending = [],
    applied = [];
  const work = () =>
    new Promise((resolve, reject) => pending.push({ resolve, reject }));
  const a = latest.run(work, (e, x) => applied.push(x));
  const b = latest.run(work, (e, x) => applied.push(x));
  pending[1].resolve("B evidence");
  await b;
  pending[0].resolve("A evidence");
  await a;
  assert.deepEqual(applied, ["B evidence"]);
});
test("unknown delivery states never imply undelivered", async () => {
  const { deliveryState } = await import("../public/client-state.js");
  for (const x of [undefined, "unknown", "not_recorded", "unrecognized"])
    assert.equal(deliveryState(x), "unknown");
  assert.equal(deliveryState("pending_integration"), "pending");
  assert.equal(deliveryState("delivered"), "delivered");
});
