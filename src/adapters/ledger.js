import { validateGraph } from "../model.js";

const copy = (value) => structuredClone(value);
const reference = (value, label) =>
  typeof value === "string"
    ? { label: label || value, ref: value }
    : { label: value.label || label || value.ref, ref: value.ref };
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function journeyRows(markdown, ids) {
  const rows = [];
  for (const line of markdown.split(/\r?\n/)) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line
      .trim()
      .split(/(?<!\\)\|/)
      .slice(1, -1)
      .map((cell) => cell.trim().replace(/\\\|/g, "|"));
    const match = cells[0]?.match(/^(J\d+)\s+(.+)$/);
    if (!match || cells.length !== 4) continue;
    const coverage = cells[3];
    const mapped = new Set();
    // Expand only explicit numeric ranges and only to IDs present in this ledger.
    for (const range of coverage.matchAll(
      /(?<![A-Za-z0-9_.-])([A-Za-z]+)(\d+)\s*[–—-]\s*(?:\1)?(\d+)(?![A-Za-z0-9_.-])/g,
    )) {
      const start = Number(range[2]),
        end = Number(range[3]);
      for (const id of ids) {
        const member = id.match(/^([A-Za-z]+)(\d+)$/);
        if (
          member &&
          member[1] === range[1] &&
          Number(member[2]) >= start &&
          Number(member[2]) <= end
        )
          mapped.add(id);
      }
    }
    for (const id of ids) {
      if (
        new RegExp(
          `(?<![A-Za-z0-9_.-])${escapeRegex(id)}(?![A-Za-z0-9_.-])`,
        ).test(coverage)
      )
        mapped.add(id);
    }
    rows.push({
      mapped,
      journey: {
        id: match[1],
        title: match[2],
        outcome: cells[1],
        boundaries: cells[2],
        coverage,
      },
    });
  }
  return rows;
}

/** Convert configured UTF-8 source documents without deriving workflow state from prose. */
export function adaptLedger(documents, config) {
  if (typeof documents?.ledger !== "string")
    throw new Error("Ledger source text required");
  let ledger;
  try {
    ledger = JSON.parse(documents.ledger);
  } catch (error) {
    throw new Error(`Invalid ledger JSON: ${error.message}`);
  }
  if (ledger?.schema_version !== 1 || !Array.isArray(ledger.items))
    throw new Error("Invalid ledger schema");
  if (!Array.isArray(config?.groups))
    throw new Error("Configured groups required");
  const ids = new Set(ledger.items.map((item) => item.id));
  const memberships = new Map();
  for (const group of config.groups) {
    if (!Array.isArray(group.nodeIds))
      throw new Error(`Node IDs required for group ${group.id}`);
    for (const id of group.nodeIds) {
      if (!ids.has(id)) throw new Error(`Unknown configured node ${id}`);
      if (memberships.has(id))
        throw new Error(`Node ${id} mapped to multiple groups`);
      memberships.set(id, group.id);
    }
  }
  const journeys = journeyRows(documents.journeys || "", ids);
  const nodes = ledger.items.map((item) => {
    if (!memberships.has(item.id)) throw new Error(`Unmapped node ${item.id}`);
    const references = (item.spec_refs || []).map((ref) =>
      reference(ref, "Specification"),
    );
    if (item.plan_ref) references.push(reference(item.plan_ref, "Plan"));
    if (item.delivery?.pr_url)
      references.push(reference(item.delivery.pr_url, "Delivery PR"));
    if (item.delivery?.main_ci_url)
      references.push(reference(item.delivery.main_ci_url, "Main CI"));
    return {
      id: item.id,
      title: item.outcome,
      kind: item.kind,
      status: item.status,
      groupId: memberships.get(item.id),
      dependsOn: copy(item.depends_on || []),
      acceptance: copy(item.acceptance || []),
      evidence: (item.evidence || []).map((ref) => reference(ref)),
      references,
      localVerification:
        item.checkpoint?.status === "local_verified_pending_delivery" ||
        item.checkpoint?.status === "local_verified_delivered" ||
        (item.kind === "technical" && item.status === "verified")
          ? "verified"
          : "unknown",
      delivery: copy(item.delivery || {}),
      checkpoint: copy(item.checkpoint || null),
      blockers: copy(item.blockers || []),
      deferral: copy(item.deferral || null),
      approval: copy(item.approval || null),
      humanGate: item.human_gate === true || item.status === "awaiting_human",
      children: copy(item.children || []),
      scopeUnknown:
        item.kind === "milestone" &&
        (!item.children || item.children.length === 0),
      journeys: journeys
        .filter((row) => row.mapped.has(item.id))
        .map((row) => copy(row.journey)),
      recorded: copy(item),
    };
  });
  if (ledger.journeys !== undefined && !Array.isArray(ledger.journeys))
    throw new Error("Invalid ledger journeys");
  const stage = (value, local = false) =>
    value == null
      ? null
      : {
          status: value.status,
          evidence: Array.isArray(value.evidence)
            ? value.evidence.map((ref) => reference(ref))
            : value.evidence,
          ...(local ? { testedCommit: value.tested_commit } : {}),
        };
  const explicit = (ledger.journeys || []).map((j) => ({
    id: j.id,
    title: j.title,
    note: j.note,
    outcome: j.outcome,
    boundaries: j.boundaries,
    itemIds: copy(j.item_ids),
    acceptanceCriteria: copy(j.acceptance_criteria),
    recordSource: "explicit",
    localVerification: stage(j.local_verification, true),
    acceptanceReview: stage(j.acceptance_review),
    delivery: stage(j.delivery),
  }));
  const journeyRecords = [
    ...explicit,
    ...journeys
      .filter((row) => !explicit.some((j) => j.id === row.journey.id))
      .map((row) => ({
        ...copy(row.journey),
        itemIds: [...row.mapped],
        acceptanceCriteria: [],
        recordSource: "narrative",
        localVerification: null,
        acceptanceReview: null,
        delivery: null,
      })),
  ];
  return validateGraph({
    schemaVersion: 1,
    project: copy(config.project),
    ...(ledger.ci_policy !== undefined
      ? { ciPolicy: copy(ledger.ci_policy) }
      : {}),
    nodes,
    journeys: journeyRecords,
    groups: config.groups.map(({ id, title }) => ({ id, title })),
    views: copy(config.views),
  });
}
