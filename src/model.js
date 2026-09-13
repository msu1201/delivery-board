const ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,100}$/;
const states = [
  "planned",
  "ready",
  "in_progress",
  "verified",
  "awaiting_human",
  "accepted",
  "blocked",
  "unknown",
];
const kinds = ["product", "technical", "documentation", "human", "milestone"];
const fail = (m) => {
  throw new Error(m);
};
const text = (s, m) => (typeof s === "string" && s.length <= 50000) || fail(m);
const record = (value, label) =>
  (value !== null && typeof value === "object" && !Array.isArray(value)) ||
  fail(`${label} must be an object`);
function optionalTextFields(value, keys, label) {
  for (const key of keys)
    if (value[key] != null) text(value[key], `${label}.${key} must be text`);
}
function validateCIPolicy(value, legacy = false) {
  if (value == null) return;
  if (legacy && typeof value === "string") {
    text(value, "CI record must be text");
    return;
  }
  record(value, "CI policy");
  optionalTextFields(
    value,
    [
      "status",
      "decision_ref",
      "reason",
      "replacement",
      "effective_on",
      "until",
    ],
    "CI policy",
  );
  if (value.status === "waived") {
    for (const key of [
      "decision_ref",
      "reason",
      "replacement",
      "effective_on",
      "until",
    ])
      if (typeof value[key] !== "string" || !value[key].trim())
        fail(`CI waiver requires ${key}`);
  }
}
function optionalDetails(n) {
  for (const key of ["references", "children", "blockers", "journeys"])
    if (n[key] !== undefined && !Array.isArray(n[key]))
      fail(`${n.id}: ${key} must be array`);
  for (const key of [
    "delivery",
    "checkpoint",
    "approval",
    "deferral",
    "recorded",
  ])
    if (n[key] != null) record(n[key], `${n.id}.${key}`);
  for (const key of ["humanGate", "scopeUnknown"])
    if (n[key] != null && typeof n[key] !== "boolean")
      fail(`${n.id}.${key} must be boolean`);
  optionalTextFields(n, ["localVerification"], n.id);
  for (const [key, fields] of Object.entries({
    delivery: ["status", "pr_url", "main_ci_url"],
    checkpoint: ["status", "summary"],
    deferral: ["status", "scope", "scheduled_for"],
  }))
    if (n[key] != null) optionalTextFields(n[key], fields, `${n.id}.${key}`);
  validateCIPolicy(n.delivery?.ci, true);
  for (const b of n.blockers || []) {
    record(b, `${n.id}.blockers entry`);
    optionalTextFields(
      b,
      ["id", "state", "owner", "exit", "next_action"],
      `${n.id}.blockers`,
    );
  }
  for (const j of n.journeys || []) {
    record(j, `${n.id}.journeys entry`);
    optionalTextFields(
      j,
      ["id", "title", "outcome", "boundaries", "coverage"],
      `${n.id}.journeys`,
    );
  }
}
export function validateJourneys(journeys, ids) {
  if (journeys === undefined) return;
  if (!Array.isArray(journeys) || journeys.length > 500)
    fail("Invalid journeys array");
  const seen = new Set();
  for (const j of journeys) {
    record(j, "Journey");
    if (typeof j.id !== "string" || !ID.test(j.id) || seen.has(j.id))
      fail("Invalid/duplicate journey ID");
    seen.add(j.id);
    optionalTextFields(j, ["note"], "Journey");
    if (
      j.acceptanceReview?.status === "accepted" &&
      j.localVerification?.status !== "passed"
    )
      fail("Journey acceptance requires local passed");
    if (
      j.delivery?.status === "delivered" &&
      j.acceptanceReview?.status !== "accepted"
    )
      fail("Journey delivery requires acceptance");
    for (const key of ["title", "outcome", "boundaries"])
      text(j[key], `Invalid journey ${key}`);
    if (
      !Array.isArray(j.itemIds) ||
      new Set(j.itemIds).size !== j.itemIds.length ||
      j.itemIds.some((id) => !ids.has(id))
    )
      fail("Invalid journey item reference");
    if (!Array.isArray(j.acceptanceCriteria)) fail("Invalid journey criteria");
    j.acceptanceCriteria.forEach((x) => text(x, "Invalid journey criterion"));
    if (!["explicit", "narrative"].includes(j.recordSource))
      fail("Invalid journey record source");
    for (const [key, statuses, passed] of [
      ["localVerification", ["not_assessed", "partial", "passed"], "passed"],
      ["acceptanceReview", ["not_accepted", "accepted"], "accepted"],
      ["delivery", ["pending_integration", "delivered"], "delivered"],
    ]) {
      const stage = j[key];
      if (stage == null) continue;
      if (j.recordSource === "narrative")
        fail("Narrative cannot assert journey acceptance");
      record(stage, "Journey stage");
      if (!statuses.includes(stage.status) || !Array.isArray(stage.evidence))
        fail("Invalid journey stage");
      for (const e of stage.evidence) {
        record(e, "Journey evidence");
        text(e.label, "Invalid evidence label");
        text(e.ref, "Invalid evidence ref");
        if (!e.ref.trim()) fail("Empty journey evidence");
      }
      if (key === "localVerification" && stage.testedCommit != null)
        text(stage.testedCommit, "Invalid tested commit");
      if (
        stage.status === passed &&
        (!stage.evidence.length ||
          !j.itemIds.length ||
          !j.acceptanceCriteria.length ||
          (key === "localVerification" && !stage.testedCommit?.trim()))
      )
        fail("Journey pass requires scope, evidence and tested version");
    }
  }
}
export function validateWorkLog(entries) {
  if (entries === undefined) return;
  if (!Array.isArray(entries) || entries.length > 1000) fail("Invalid workLog (0–1000 records)");
  const ids = new Set();
  const timestamp = (value) => {
    if (value == null) return null;
    if (typeof value !== "string") fail("Invalid workLog time");
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
    if (!match || !Number.isFinite(Date.parse(value))) fail("Invalid workLog time; include timezone");
    const [,year,month,day,hour,minute,second] = match.map((x,i)=>i>0&&i<7?Number(x):x);
    if (month<1 || month>12 || day<1 || day>new Date(Date.UTC(year,month,0)).getUTCDate() || hour>23 || minute>59 || second>59) fail("Invalid workLog calendar time");
    return Date.parse(value);
  };
  for (const e of entries) {
    record(e, "workLog entry");
    if (typeof e.id !== "string" || !ID.test(e.id) || ids.has(e.id)) fail("Invalid/duplicate workLog ID");
    ids.add(e.id);
    for (const key of ["title", "summary", "result"]) text(e[key], `workLog ${key} required`);
    if (!e.title.trim()) fail("workLog title must not be empty");
    if (!["in_progress","completed","blocked","unknown"].includes(e.status)) fail("Invalid workLog status");
    const start=timestamp(e.startedAt), end=timestamp(e.endedAt);
    if (start!==null && end!==null && end<start) fail("workLog end precedes start");
    if (e.status==="in_progress" && end!==null) fail("Active workLog cannot have an end time");
    for (const key of ["taskIds","previousTaskIds","nextTaskIds"]) {
      if (!Array.isArray(e[key]) || e[key].length>500 || new Set(e[key]).size!==e[key].length || e[key].some(id=>typeof id!=="string" || !ID.test(id))) fail(`Invalid workLog ${key}`);
    }
  }
}
export function validateGraph(g) {
  if (
    g?.schemaVersion !== 1 ||
    !g.project ||
    !Array.isArray(g.nodes) ||
    g.nodes.length > 500
  )
    fail("Invalid graph schema or node count (0–500)");
  record(g.project, "Project");
  text(g.project.name, "Project name required");
  optionalTextFields(g.project, ["id"], "Project");
  if (
    !Array.isArray(g.groups) ||
    !g.groups.length ||
    !Array.isArray(g.views) ||
    !g.views.length
  )
    fail("Groups and views required");
  const unique = (xs, label) => {
    const seen = new Set();
    for (const x of xs) {
      record(x, label);
      if (typeof x.id !== "string" || !ID.test(x.id) || seen.has(x.id))
        fail(`Invalid/duplicate ${label} ID: ${x.id}`);
      seen.add(x.id);
    }
    return seen;
  };
  const ids = unique(g.nodes, "node"),
    groups = unique(g.groups, "group");
  unique(g.views, "view");
  validateJourneys(g.journeys, ids);
  validateCIPolicy(g.ciPolicy);
  validateWorkLog(g.workLog);
  for (const a of g.groups) text(a.title, "Group title required");
  for (const n of g.nodes) {
    optionalDetails(n);
    text(n.title, "Node title required");
    if (
      !states.includes(n.status) ||
      !kinds.includes(n.kind) ||
      !groups.has(n.groupId)
    )
      fail(`Invalid node ${n.id}`);
    for (const key of ["dependsOn", "acceptance", "evidence"])
      if (!Array.isArray(n[key])) fail(`${n.id}: ${key} must be array`);
    if (new Set(n.dependsOn).size !== n.dependsOn.length)
      fail("Duplicate dependency");
    for (const d of n.dependsOn)
      if (!ids.has(d)) fail(`Dangling dependency ${n.id} → ${d}`);
    for (const a of n.acceptance) text(a, "Invalid acceptance");
    for (const e of [...n.evidence, ...(n.references || [])]) {
      record(e, "Evidence reference");
      text(e.ref, "Invalid evidence reference");
      text(e.label, "Invalid evidence label");
    }
    if (
      n.children &&
      (!Array.isArray(n.children) || n.children.some((c) => !ids.has(c)))
    )
      fail("Invalid milestone children");
  }
  const map = new Map(g.nodes.map((n) => [n.id, n])),
    visiting = new Set(),
    done = new Set();
  function visit(id) {
    if (visiting.has(id)) fail(`Dependency cycle at ${id}`);
    if (done.has(id)) return;
    visiting.add(id);
    for (const d of map.get(id).dependsOn) visit(d);
    visiting.delete(id);
    done.add(id);
  }
  g.nodes.forEach((n) => visit(n.id));
  for (const v of g.views) {
    text(v.title, "View title required");
    if (!["all", "include", "ancestors", "blocked"].includes(v.mode))
      fail("Invalid view mode");
    if (
      ["include", "ancestors"].includes(v.mode) &&
      (!Array.isArray(v.nodeIds) || v.nodeIds.some((id) => !ids.has(id)))
    )
      fail("Unknown view node");
  }
  return g;
}
export const satisfied = (n) =>
  n.status === "accepted" ||
  (["technical", "documentation"].includes(n.kind) && n.status === "verified");
export const hasOwnBlocker = (n) =>
  ["blocked", "awaiting_human"].includes(n.status) ||
  (n.blockers || []).some(
    (b) => !["resolved", "resolved_local"].includes(b.state),
  );
export function analyze(g) {
  const map = new Map(g.nodes.map((n) => [n.id, n])),
    result = Object.create(null);
  function calc(n) {
    if (result[n.id]) return result[n.id];
    const unmet = n.dependsOn.filter((id) => !satisfied(map.get(id)));
    const roots = new Set();
    for (const id of n.dependsOn) {
      const d = map.get(id);
      if (!satisfied(d) && hasOwnBlocker(d)) roots.add(id);
      for (const r of calc(d).blockedBy) roots.add(r);
    }
    return (result[n.id] = { unmet, blockedBy: [...roots] });
  }
  g.nodes.forEach(calc);
  return result;
}
export function closure(g, seed, direction = "ancestors") {
  const found = new Set(seed);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of g.nodes) {
      const add =
        direction === "ancestors"
          ? found.has(n.id)
            ? n.dependsOn
            : []
          : n.dependsOn.some((d) => found.has(d))
            ? [n.id]
            : [];
      for (const id of add)
        if (!found.has(id)) {
          found.add(id);
          changed = true;
        }
    }
  }
  return found;
}
export function projectGraph(g, viewId, expanded, journeyId = null) {
  const view = viewId === null ? { mode: "all" } : g.views.find((v) => v.id === viewId) || g.views[0],
    analysis = analyze(g);
  let keep = new Set(g.nodes.map((n) => n.id));
  if (view.mode === "include") keep = new Set(view.nodeIds);
  if (view.mode === "ancestors") keep = closure(g, view.nodeIds);
  if (view.mode === "blocked")
    keep = new Set(
      g.nodes
        .filter((n) => hasOwnBlocker(n) || analysis[n.id].blockedBy.length)
        .map((n) => n.id),
    );
  if (journeyId) {
    const j = g.journeys?.find((j) => j.id === journeyId);
    if (!j) fail("Unknown journey");
    keep = closure(g, j.itemIds);
  }
  const visible = g.nodes.filter((n) => keep.has(n.id));
  const external = g.nodes.filter(
    (n) => !keep.has(n.id) && visible.some((v) => v.dependsOn.includes(n.id)),
  );
  const entities = [],
    groupIds = new Set(visible.map((n) => n.groupId));
  for (const gr of g.groups.filter((x) => groupIds.has(x.id))) {
    const members = visible.filter((n) => n.groupId === gr.id);
    if (expanded.has(gr.id))
      entities.push(
        ...members.map((n) => ({ id: n.id, node: n, groupId: gr.id })),
      );
    else
      entities.push({
        id: `group:${gr.id}`,
        groupId: gr.id,
        group: gr,
        members,
      });
  }
  entities.push(
    ...external.map((n) => ({
      id: `external:${n.id}`,
      node: n,
      external: true,
    })),
  );
  const entity = (id) => {
    const n = g.nodes.find((n) => n.id === id);
    return !keep.has(id)
      ? `external:${id}`
      : expanded.has(n.groupId)
        ? id
        : `group:${n.groupId}`;
  };
  const edgeMap = new Map();
  for (const n of visible)
    for (const d of n.dependsOn) {
      const source = entity(d),
        target = entity(n.id);
      if (source === target) continue;
      const key = JSON.stringify([source, target]);
      if (!edgeMap.has(key))
        edgeMap.set(key, { source, target, count: 0, dependencies: [] });
      const e = edgeMap.get(key);
      e.count++;
      e.dependencies.push({ source: d, target: n.id });
    }
  return {
    visible,
    external,
    entities,
    edges: [...edgeMap.values()],
    analysis,
  };
}
