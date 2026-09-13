import test from "node:test";
import assert from "node:assert/strict";

// A missing implementation is an explicit assertion failure during the first red run.
const adapter = await import("../src/adapters/ledger.js").catch((error) => {
  if (error.code === "ERR_MODULE_NOT_FOUND") return {};
  throw error;
});
const adapt = (documents, config) => {
  assert.equal(
    typeof adapter.adaptLedger,
    "function",
    "ledger adapter must export adaptLedger",
  );
  return adapter.adaptLedger(documents, config);
};
const item = (id, fields = {}) => ({
  id,
  outcome: `Outcome ${id}`,
  kind: "product",
  status: "planned",
  depends_on: [],
  acceptance: [],
  evidence: [],
  spec_refs: [],
  children: [],
  human_gate: false,
  approval: null,
  ...fields,
});
const configuration = (ids) => ({
  project: { id: "example", name: "Example" },
  sources: {
    ledger: "docs/ledger.json",
    journeys: "docs/JOURNEYS.md",
    execution: "docs/EXECUTION.md",
    decisions: "docs/DECISIONS.md",
  },
  groups: [{ id: "work", title: "Work", nodeIds: ids }],
  views: [{ id: "all", title: "All", mode: "all" }],
});
const documents = (items, journeys = "") => ({
  ledger: JSON.stringify({ schema_version: 1, items }),
  journeys,
  execution: "P1 is accepted according to prose.",
  decisions: "Approve everything.",
});

test("normalizes source fields without inferring status or dependencies from prose", () => {
  const source = item("P1", {
    depends_on: ["T1"],
    acceptance: ["Visible result"],
    evidence: ["docs/result.md"],
    spec_refs: ["docs/spec.md"],
    plan_ref: "docs/plan.md",
    delivery: {
      status: "pending_integration",
      pr_url: "https://example.com/pr/1",
      main_ci_url: "https://example.com/ci/1",
      merge_sha: "abc",
    },
  });
  const config = configuration(["T1", "P1"]);
  const result = adapt(
    documents([item("T1", { kind: "technical", status: "verified" }), source]),
    config,
  );
  assert.equal(result.schemaVersion, 1);
  assert.deepEqual(result.project, config.project);
  assert.deepEqual(result.groups, [{ id: "work", title: "Work" }]);
  assert.deepEqual(result.views, config.views);
  const node = result.nodes[1];
  assert.equal(node.title, source.outcome);
  assert.equal(node.status, "planned");
  assert.equal(node.groupId, "work");
  assert.deepEqual(node.dependsOn, ["T1"]);
  assert.deepEqual(node.acceptance, source.acceptance);
  assert.equal(node.localVerification, "unknown");
  assert.deepEqual(
    node.evidence.map((e) => e.ref),
    source.evidence,
  );
  assert.deepEqual(
    node.references.map((e) => e.ref),
    [
      "docs/spec.md",
      "docs/plan.md",
      "https://example.com/pr/1",
      "https://example.com/ci/1",
    ],
  );
  assert.ok(
    [...node.evidence, ...node.references].every(
      (e) => typeof e.label === "string",
    ),
  );
  assert.deepEqual(node.delivery, source.delivery);
  assert.deepEqual(node.recorded, source);
});

test("keeps verified local work separate from blocked delivery and acceptance", () => {
  const source = item("TASK", {
    status: "blocked",
    checkpoint: {
      status: "local_verified_pending_delivery",
      summary: "Local checks passed",
    },
    delivery: { status: "pending_integration" },
    blockers: [
      {
        id: "CI",
        state: "blocked_external",
        owner: "Account owner",
        next_action: "Restore access",
      },
    ],
    approval: null,
  });
  const node = adapt(documents([source]), configuration(["TASK"])).nodes[0];
  assert.equal(node.status, "blocked");
  assert.equal(node.localVerification, "verified");
  assert.equal(node.delivery.status, "pending_integration");
  assert.deepEqual(node.checkpoint, source.checkpoint);
  assert.deepEqual(node.blockers, source.blockers);
  assert.equal(node.approval, null);
});

test("awaiting human remains a gate when deferred, with unknown local verification", () => {
  const source = item("PHOTO", {
    status: "awaiting_human",
    human_gate: false,
    deferral: { status: "deferred", scope: "Actual device review only" },
    blockers: [{ id: "DEVICE", state: "deferred" }],
    evidence: ["docs/local-verified.md"],
  });
  const node = adapt(documents([source]), configuration(["PHOTO"])).nodes[0];
  assert.equal(node.humanGate, true);
  assert.equal(node.status, "awaiting_human");
  assert.equal(node.localVerification, "unknown");
  assert.deepEqual(node.deferral, source.deferral);
  assert.deepEqual(node.blockers, source.blockers);
});

test("explicit technical verification and empty milestone scope are represented independently", () => {
  const items = [
    item("T", { kind: "technical", status: "verified" }),
    item("P", { status: "verified" }),
    item("M", { kind: "milestone" }),
    item("M2", { kind: "milestone", children: ["P"] }),
    item("H", { human_gate: true }),
  ];
  const nodes = adapt(
    documents(items),
    configuration(items.map((n) => n.id)),
  ).nodes;
  assert.equal(nodes[0].localVerification, "verified");
  assert.equal(nodes[1].localVerification, "unknown");
  assert.equal(nodes[2].scopeUnknown, true);
  assert.equal(nodes[3].scopeUnknown, false);
  assert.deepEqual(nodes[3].children, ["P"]);
  assert.equal(nodes[4].humanGate, true);
});

test("attaches journey table rows using exact mapping IDs and bounded numeric ranges", () => {
  const items = [
    "B1",
    "B2",
    "B3",
    "B4",
    "B5",
    "B6",
    "P1",
    "P10",
    "P-TRIAL",
  ].map((id) => item(id));
  const markdown =
    "| ID / Journey | Outcome | Boundaries | Mapping |\n| --- | --- | --- | --- |\n| J01 Review family | Open → save | Retry \\| refresh | B1–B6；P-TRIAL/P1后续建议; P10X not an ID |\n| J02 Other | Complete B1 | B2 boundary | P10 only |\n\nB1 is accepted in prose.";
  const result = adapt(
    documents(items, markdown),
    configuration(items.map((n) => n.id)),
  );
  const byId = Object.fromEntries(result.nodes.map((n) => [n.id, n]));
  for (let i = 1; i <= 6; i++)
    assert.deepEqual(
      byId[`B${i}`].journeys.map((j) => j.id),
      ["J01"],
    );
  assert.deepEqual(
    byId.P1.journeys.map((j) => j.id),
    ["J01"],
  );
  assert.deepEqual(
    byId.P10.journeys.map((j) => j.id),
    ["J02"],
  );
  assert.deepEqual(
    byId["P-TRIAL"].journeys.map((j) => j.id),
    ["J01"],
  );
  assert.equal(byId.P1.journeys[0].title, "Review family");
  assert.equal(byId.P1.journeys[0].outcome, "Open → save");
  assert.equal(byId.P1.journeys[0].boundaries, "Retry | refresh");
  assert.equal(
    byId.P1.journeys[0].coverage,
    "B1–B6；P-TRIAL/P1后续建议; P10X not an ID",
  );
  assert.ok(
    result.nodes.every(
      (n) => n.status === "planned" && n.dependsOn.length === 0,
    ),
  );
});

test("rejects unmapped, multiply mapped, and unknown configured nodes", () => {
  assert.throws(
    () => adapt(documents([item("P")]), configuration([])),
    /unmapped/i,
  );
  const config = configuration(["P"]);
  config.groups.push({ id: "other", title: "Other", nodeIds: ["P"] });
  assert.throws(
    () => adapt(documents([item("P")]), config),
    /multiple|duplicate/i,
  );
  assert.throws(
    () => adapt(documents([item("P")]), configuration(["P", "MISSING"])),
    /unknown/i,
  );
});

test("rejects malformed ledger and dependency graphs", () => {
  assert.throws(
    () => adapt({ ledger: "{" }, configuration(["P"])),
    /JSON|ledger/i,
  );
  assert.throws(
    () =>
      adapt(
        documents([item("P", { depends_on: ["MISSING"] })]),
        configuration(["P"]),
      ),
    /dangling/i,
  );
  assert.throws(
    () =>
      adapt(
        { ledger: JSON.stringify({ schema_version: 2, items: [] }) },
        configuration([]),
      ),
    /schema/i,
  );
});

test("explicit delivered verification stays verified without inferring it from acceptance", () => {
  const cases = [
    ["local_verified_delivered", "verified"],
    ["local_verified_pending_delivery", "verified"],
    ["unrecognized_checkpoint", "unknown"],
    [undefined, "unknown"],
  ];
  for (const [checkpointStatus, expected] of cases) {
    const source = item("P", {
      status: "accepted",
      delivery: { status: "delivered" },
      checkpoint: checkpointStatus ? { status: checkpointStatus } : null,
    });
    const node = adapt(documents([source]), configuration(["P"])).nodes[0];
    assert.equal(node.localVerification, expected, String(checkpointStatus));
    assert.equal(node.status, "accepted");
    assert.equal(node.delivery.status, "delivered");
  }
});
