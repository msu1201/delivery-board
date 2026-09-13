import test from "node:test";
import assert from "node:assert/strict";
import { adaptLedger } from "../src/adapters/ledger.js";
import { validateGraph, projectGraph } from "../src/model.js";
const item = (id) => ({
  id,
  outcome: id,
  kind: "product",
  status: "accepted",
  depends_on: id === "TASK" ? ["BASE"] : [],
  acceptance: [],
  evidence: [],
});
const config = {
  project: { name: "Fictional archive" },
  groups: [{ id: "g", title: "Work", nodeIds: ["BASE", "TASK"] }],
  views: [{ id: "all", title: "All", mode: "all" }],
};
const journey = (id = "FLOW-A") => ({
  id,
  title: "Read archive",
  item_ids: ["TASK"],
  outcome: "Find → read → recover",
  boundaries: "Retry",
  acceptance_criteria: ["The complete loop is checked"],
  local_verification: {
    status: "partial",
    tested_commit: "abc123",
    evidence: ["records/partial.md"],
  },
  acceptance_review: { status: "not_accepted", evidence: [] },
  delivery: { status: "pending_integration", evidence: [] },
});
const adapt = (journeys, markdown = "") =>
  adaptLedger(
    {
      ledger: JSON.stringify({
        schema_version: 1,
        items: [item("BASE"), item("TASK")],
        ...(journeys === undefined ? {} : { journeys }),
      }),
      journeys: markdown,
    },
    config,
  );
test("explicit journey stages are independent of accepted tasks and use existing IDs only", () => {
  const g = adapt([journey(), journey("FLOW-B")]);
  assert.equal(g.journeys.length, 2);
  assert.equal(g.journeys[0].localVerification.status, "partial");
  assert.equal(g.journeys[0].acceptanceReview.status, "not_accepted");
  assert.equal(g.journeys[0].delivery.status, "pending_integration");
  assert.deepEqual(g.journeys[0].itemIds, ["TASK"]);
  const p = projectGraph(g, "all", new Set(["g"]), "FLOW-A");
  assert.deepEqual(
    p.entities.map((n) => n.id),
    ["BASE", "TASK"],
  );
  assert.deepEqual(
    p.edges.map((e) => [e.source, e.target]),
    [["BASE", "TASK"]],
  );
});
test("legacy Markdown remains selectable narrative with unknown stages, never inferred acceptance", () => {
  const g = adapt(
    undefined,
    "| J01 Read archive | Open → read | Retry | TASK |",
  );
  assert.equal(g.journeys[0].recordSource, "narrative");
  assert.equal(g.journeys[0].localVerification, null);
  assert.equal(g.journeys[0].acceptanceReview, null);
  assert.deepEqual(g.journeys[0].itemIds, ["TASK"]);
  assert.deepEqual(adapt(undefined).journeys, []);
});
test("reject invalid journey ID/reference/duplicates and evidence-less passes", () => {
  for (const change of [
    (j) => (j.id = "bad:id"),
    (j) => (j.item_ids = ["MISSING"]),
    (j) => (j.item_ids = ["TASK", "TASK"]),
    (j) =>
      (j.local_verification = {
        status: "passed",
        tested_commit: "abc",
        evidence: [],
      }),
    (j) => (j.acceptance_review = { status: "accepted", evidence: [] }),
    (j) => (j.delivery = { status: "delivered", evidence: [] }),
    (j) =>
      (j.local_verification = {
        status: "passed",
        tested_commit: null,
        evidence: ["proof.md"],
      }),
    (j) => (j.boundaries = []),
    (j) => (j.local_verification = { status: "green", evidence: [] }),
  ]) {
    const j = journey();
    change(j);
    assert.throws(() => adapt([j]));
  }
  assert.throws(() => adapt([journey(), journey()]));
  assert.throws(() => adapt("bad"));
});
test("normalized schema validates journeys too; missing records remain unknown", () => {
  const g = adapt([journey()]);
  g.journeys[0].localVerification = {
    status: "passed",
    testedCommit: "abc",
    evidence: [],
  };
  assert.throws(() => validateGraph(g));
  g.journeys[0].localVerification = null;
  assert.doesNotThrow(() => validateGraph(g));
});
test("actual contract forbids accepted before local passed and delivered before accepted", () => {
  const a = journey();
  a.acceptance_review = { status: "accepted", evidence: ["review.md"] };
  assert.throws(() => adapt([a]));
  const d = journey();
  d.delivery = { status: "delivered", evidence: ["delivery.md"] };
  assert.throws(() => adapt([d]));
  a.local_verification = {
    status: "passed",
    tested_commit: "abc",
    evidence: ["local.md"],
  };
  a.delivery = { status: "delivered", evidence: ["delivery.md"] };
  assert.equal(adapt([a]).journeys[0].delivery.status, "delivered");
});
