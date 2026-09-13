import test from "node:test";
import assert from "node:assert/strict";
import { currentWork } from "../src/current-work.js";
const item = (id, extra = {}) => ({
  id, title: id, groupId: "work", kind: "product", status: "planned",
  dependsOn: [], acceptance: [], evidence: [], ...extra,
});
const graph = (nodes, journeys = []) => ({
  nodes, journeys, groups: [{ id: "work", title: "Work" }],
});
const ids = (nodes) => nodes.map((node) => node.id);

test("exports the current work helper", () => {
  assert.equal(typeof currentWork, "function");
});

test("only recorded in-progress nodes are current and preserve source order", () => {
  const inactive = ["accepted", "verified", "blocked", "ready", "awaiting_human"]
    .map((status) => item(status, { status }));
  assert.deepEqual(currentWork(graph(inactive)), []);
  const first = item("SECOND-ID", { status: "in_progress" });
  const second = item("FIRST-ID", { status: "in_progress" });
  const g = graph([first, ...inactive, second]);
  const result = currentWork(g);
  assert.deepEqual(ids(result.map((entry) => entry.node)), [first.id, second.id]);
  assert.equal(result[0].node, first);
  assert.equal(result[0].group, g.groups[0]);
});

test("returns shared explicit and narrative journeys plus deduplicated legacy memberships", () => {
  const legacy = { id: "OLD", title: "Old route" };
  const first = item("A", { status: "in_progress", journeys: [{ id: "EXPLICIT" }, legacy, legacy] });
  const second = item("B", { status: "in_progress" });
  const journeys = [
    { id: "EXPLICIT", recordSource: "explicit", itemIds: ["A", "B"] },
    { id: "NARRATIVE", recordSource: "narrative", itemIds: ["A"] },
    { id: "OTHER", recordSource: "explicit", itemIds: [] },
  ];
  const [a, b] = currentWork(graph([first, second], journeys));
  assert.deepEqual(ids(a.journeys), ["EXPLICIT", "NARRATIVE", "OLD"]);
  assert.equal(a.journeys[0], journeys[0]);
  assert.equal(a.journeys[2], legacy);
  assert.deepEqual(ids(b.journeys), ["EXPLICIT"]);
});

test("keeps prerequisite IDs, successor records, blockers and downstream milestones distinct", () => {
  const g = graph([
    item("BLOCK", { status: "blocked" }),
    item("PRE", { dependsOn: ["BLOCK"] }),
    item("DONE", { status: "accepted" }),
    item("NOW", { status: "in_progress", dependsOn: ["PRE", "DONE"], blockers: [{ state: "open" }] }),
    item("NEXT", { dependsOn: ["NOW"] }),
    item("GOAL", { kind: "milestone", dependsOn: ["NEXT"] }),
    item("SCOPE", { kind: "milestone", children: ["NOW"] }),
    item("UNRELATED", { kind: "milestone" }),
  ]);
  const [result] = currentWork(g);
  assert.deepEqual(result.unmet, ["PRE"]);
  assert.deepEqual(result.blockedBy, ["BLOCK"]);
  assert.equal(result.hasOwnBlocker, true);
  assert.deepEqual(ids(result.successors), ["NEXT"]);
  assert.equal(result.successors[0], g.nodes[4]);
  assert.deepEqual(ids(result.downstreamMilestones), ["GOAL"]);
  assert.deepEqual(ids(result.scopeMilestones), ["SCOPE"]);
});

test("nested scope membership is shared, cycle-safe and excludes current milestone itself", () => {
  const g = graph([
    item("NOW", { status: "in_progress", kind: "milestone", children: ["INNER"] }),
    item("OUTER", { kind: "milestone", children: ["INNER"] }),
    item("INNER", { kind: "milestone", children: ["NOW", "OUTER"] }),
    item("SHARED", { kind: "milestone", children: ["NOW"] }),
    item("CYCLE-A", { kind: "milestone", children: ["CYCLE-B"] }),
    item("CYCLE-B", { kind: "milestone", children: ["CYCLE-A"] }),
  ]);
  const [result] = currentWork(g);
  assert.deepEqual(ids(result.scopeMilestones), ["OUTER", "INNER", "SHARED"]);
  assert.deepEqual(result.downstreamMilestones, []);
  assert.equal(result.hasOwnBlocker, false);
});

test("derivation never mutates source records or adds dependency edges", () => {
  const g = graph([
    item("NOW", { status: "in_progress" }),
    item("SCOPE", { kind: "milestone", children: ["NOW"] }),
  ]);
  const before = structuredClone(g);
  const freeze = (value) => {
    if (value && typeof value === "object") {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
  };
  freeze(g);
  assert.doesNotThrow(() => currentWork(g));
  assert.deepEqual(g, before);
});
