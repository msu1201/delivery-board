import test from "node:test";
import assert from "node:assert/strict";
import { validateGraph, analyze, projectGraph } from "../src/model.js";
const node = (id, more = {}) => ({
  id,
  title: id,
  kind: "product",
  status: "planned",
  groupId: "g",
  dependsOn: [],
  acceptance: [],
  evidence: [],
  ...more,
});
const graph = (nodes) => ({
  schemaVersion: 1,
  project: { id: "test", name: "Test" },
  nodes,
  groups: [{ id: "g", title: "Group" }],
  views: [
    { id: "all", title: "All", mode: "all" },
    {
      id: "partial",
      title: "Partial",
      mode: "include",
      nodeIds: nodes.some((n) => n.id === "b") ? ["b"] : [],
    },
    { id: "blocked", title: "Blocked", mode: "blocked" },
  ],
});
test("schema rejects duplicate IDs, missing refs and cycles", () => {
  assert.throws(() => validateGraph(graph([node("a"), node("a")])));
  assert.throws(() =>
    validateGraph(graph([node("a", { dependsOn: ["missing"] })])),
  );
  assert.throws(() =>
    validateGraph(
      graph([node("a", { dependsOn: ["b"] }), node("b", { dependsOn: ["a"] })]),
    ),
  );
  assert.equal(validateGraph(graph([node("a")])).nodes.length, 1);
});
test("verified products do not satisfy dependencies; accepted and verified technical nodes can", () => {
  const g = graph([
    node("a", { status: "verified" }),
    node("b", { dependsOn: ["a"] }),
  ]);
  assert.deepEqual(analyze(g).b.unmet, ["a"]);
  g.nodes[0].kind = "technical";
  assert.deepEqual(analyze(g).b.unmet, []);
  g.nodes[0].kind = "human";
  assert.deepEqual(analyze(g).b.unmet, ["a"]);
});
test("blocking propagates transitively; hidden prerequisites remain explicit", () => {
  const g = graph([
    node("a", { status: "blocked" }),
    node("b", { dependsOn: ["a"] }),
    node("c", { dependsOn: ["b"] }),
  ]);
  assert.deepEqual(analyze(g).c.blockedBy, ["a"]);
  const p = projectGraph(g, "partial", new Set(["g"]));
  assert.equal(p.external[0].id, "a");
  assert.deepEqual(
    p.edges.map((e) => [e.source, e.target]),
    [["external:a", "b"]],
  );
  assert.equal(projectGraph(g, "blocked", new Set(["g"])).visible.length, 3);
});
test("collapse aggregates edges and expands original dependencies without duplicate nodes", () => {
  const g = graph([node("a"), node("b", { dependsOn: ["a"] })]);
  assert.equal(projectGraph(g, "all", new Set()).entities.length, 1);
  const p = projectGraph(g, "all", new Set(["g"]));
  assert.equal(p.edges.length, 1);
  assert.equal(p.entities.length, 2);
});
test("schema rejects malformed renderer details before projection or selection", () => {
  const invalid = [
    { blockers: "invalid" },
    { blockers: null },
    { blockers: [null] },
    { blockers: ["blocked"] },
    { blockers: [{ owner: { name: "Owner" } }] },
    { journeys: "invalid" },
    { journeys: [null] },
    { journeys: [{ title: [] }] },
    { references: {} },
    { references: null },
    { references: [null] },
    { evidence: [{ label: "x", ref: 42 }] },
    { children: false },
    { children: null },
    { delivery: "delivered" },
    { delivery: { status: { value: "delivered" } } },
    { checkpoint: [] },
    { checkpoint: { status: true } },
    { approval: [] },
    { deferral: { scope: [] } },
    { humanGate: "false" },
    { scopeUnknown: "false" },
    { localVerification: { status: "verified" } },
    { recorded: [] },
  ];
  for (const fields of invalid)
    assert.throws(
      () => validateGraph(graph([node("a", fields)])),
      JSON.stringify(fields),
    );
});
test("schema preserves omitted facts and nullable record details without inventing values", () => {
  const g = graph([
    node("a", {
      checkpoint: null,
      approval: null,
      deferral: null,
      delivery: null,
      localVerification: null,
      humanGate: null,
      scopeUnknown: null,
    }),
  ]);
  delete g.project.id;
  const before = structuredClone(g);
  assert.deepEqual(validateGraph(g), before);
  assert.equal("blockers" in g.nodes[0], false);
});
test("schema requires string IDs and record-shaped entities", () => {
  for (const collection of ["nodes", "groups", "views"]) {
    const g = graph([node("a")]);
    g[collection][0].id = 1;
    assert.throws(() => validateGraph(g), collection);
    g[collection][0] = null;
    assert.throws(() => validateGraph(g), collection);
  }
  const g = graph([node("a")]);
  g.project = [];
  assert.throws(() => validateGraph(g));
});
test("blocked view includes own unresolved blockers and excludes resolved blockers", () => {
  const g = graph([
    node("root", { blockers: [{ state: "blocked_external" }] }),
    node("resolved", { blockers: [{ state: "resolved" }] }),
    node("local", { blockers: [{ state: "resolved_local" }] }),
    node("child", { dependsOn: ["root"] }),
  ]);
  assert.deepEqual(
    projectGraph(g, "blocked", new Set(["g"])).visible.map((n) => n.id),
    ["root", "child"],
  );
  assert.deepEqual(analyze(g).child.blockedBy, ["root"]);
  g.nodes = g.nodes.filter((n) => n.id !== "child");
  assert.deepEqual(
    projectGraph(g, "blocked", new Set(["g"])).visible.map((n) => n.id),
    ["root"],
  );
});

test("null view is a full roadmap even when the source only defines filtered views", () => {
  const g = graph([node("a"), node("b", { dependsOn: ["a"] }), node("c")]);
  g.views = [g.views.find((v) => v.id === "partial")];
  const original = structuredClone(g);
  const p = projectGraph(g, null, new Set(["g"]));
  assert.deepEqual(p.visible.map((n) => n.id), ["a", "b", "c"]);
  assert.equal(p.external.length, 0);
  assert.deepEqual(g, original);
});
