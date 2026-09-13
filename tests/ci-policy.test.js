import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { adaptLedger } from "../src/adapters/ledger.js";
import { validateGraph, analyze, hasOwnBlocker } from "../src/model.js";
import * as client from "../public/client-state.js";
const policy = {
  status: "waived",
  decision_ref: "DEC-EXAMPLE",
  reason: "User reports no CI quota",
  replacement: "Local verification and integration review",
  effective_on: "2026-09-09",
  until: "User restores the CI requirement",
};
const graph = JSON.parse(
  await readFile(
    new URL("../examples/synthetic/graph.json", import.meta.url),
    "utf8",
  ),
);
const item = {
  id: "T",
  outcome: "Import",
  kind: "product",
  status: "in_progress",
  depends_on: [],
  acceptance: [],
  evidence: [],
  delivery: { status: "pending_integration", ci: policy },
  checkpoint: {
    ci: "Prior job did not start",
    ci_observation: {
      status: "jobs_not_started",
      checked_at: "2026-09-08T01:00:00Z",
    },
  },
  blockers: [{ id: "CI", state: "resolved", resolution: "waived_by_user" }],
};
const config = {
  project: { name: "Archive" },
  groups: [{ id: "work", title: "Work", nodeIds: ["T", "NEXT"] }],
  views: [{ id: "all", title: "All", mode: "all" }],
};
const adapt = (ci_policy = policy) =>
  adaptLedger(
    {
      ledger: JSON.stringify({
        schema_version: 1,
        ci_policy,
        items: [item, { ...item, id: "NEXT", depends_on: ["T"], blockers: [] }],
      }),
    },
    config,
  );
test("ledger preserves current CI waiver separately from historical failure and delivery", () => {
  const g = adapt();
  assert.deepEqual(g.ciPolicy, policy);
  assert.equal(g.nodes[0].checkpoint.ci_observation.status, "jobs_not_started");
  assert.equal(g.nodes[0].status, "in_progress");
  assert.equal(g.nodes[0].delivery.status, "pending_integration");
  assert.equal(hasOwnBlocker(g.nodes[0]), false);
  assert.deepEqual(analyze(g).NEXT.blockedBy, []);
  g.nodes[0].blockers.push({ id: "HUMAN", state: "awaiting_authorization" });
  assert.deepEqual(analyze(g).NEXT.blockedBy, ["T"]);
});
test("validates waiver decision and replacement without rejecting legacy CI records", () => {
  for (const key of [
    "decision_ref",
    "reason",
    "replacement",
    "effective_on",
    "until",
  ]) {
    const g = structuredClone(graph);
    g.ciPolicy = { ...policy, [key]: "" };
    assert.throws(() => validateGraph(g), /CI/);
  }
  const g = structuredClone(graph);
  g.nodes[0].delivery = { ci: { ...policy, reason: 42 } };
  assert.throws(() => validateGraph(g), /CI/);
  for (const ci of [
    undefined,
    "Historical provider-specific result",
    { status: "legacy_result", details: { anything: true } },
  ]) {
    const g = structuredClone(graph);
    g.nodes[0].delivery = { ci };
    assert.doesNotThrow(() => validateGraph(g));
  }
  assert.doesNotThrow(() => adapt(undefined));
});
test("current CI summary distinguishes waiver, explicit node override, and unknown legacy status", () => {
  assert.equal(
    typeof client.ciSummary,
    "function",
    "CI summary helper must exist",
  );
  assert.match(client.ciSummary(policy).label, /用户.*豁免.*未运行/);
  assert.equal(client.ciSummary(policy).passed, false);
  assert.match(client.ciSummary({ status: "not_run" }).label, /未运行/);
  assert.match(client.ciSummary({ status: "passed" }).label, /通过.*记录/);
  assert.match(client.ciSummary(undefined).label, /未知/);
  assert.match(client.ciSummary("legacy text").label, /未分类/);
});
