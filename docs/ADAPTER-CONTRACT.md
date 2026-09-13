# Adapter contract

[Documentation](README.md) · [Setup guide](SETUP.md)

Use `normalized` for a graph you maintain directly, or `ledger-v1` for an existing ledger. Examples use fictional projects, paths and IDs.

## Configuration and file access

```json
{
  "root": ".",
  "adapter": "normalized",
  "sources": { "graph": "graph.json", "context": "evidence.md" },
  "git": false,
  "evidenceAllowlist": ["evidence.md"]
}
```

| File setting | Rule |
| --- | --- |
| `root` | Resolved relative to the configuration file |
| `sources` | Up to 12 entries, with paths relative to `root` |
| Paths | No absolute paths, traversal, empty segments, backslashes or URL/query/fragment syntax |
| Files | Regular UTF-8 files, at most 2 MiB each; symlink paths are rejected |

The normalized adapter parses `sources.graph`. Other configured documents contribute to freshness checks, not graph state.

| `git` value | Behavior |
| --- | --- |
| `false` | Skip Git metadata |
| `true` | Require Git metadata; a failure makes the snapshot stale |
| Omitted | Report unavailable metadata as unknown |

Available metadata includes HEAD, branch and dirty status for configured source files only. It does not describe whether all application code is clean.

To make a local evidence file readable:

1. Add its exact root-relative reference to `evidenceAllowlist`.
2. Reference it in a node's evidence/references or a journey stage's evidence.
3. Also add it to `sources` if it should affect the snapshot freshness hash.

Access is checked again when the file is read. Other references can remain as metadata; the server does not fetch external URLs or open arbitrary paths.

## Normalized graph

Required top-level fields:

- `schemaVersion: 1`.
- `project` with a string `name`; `id` is optional metadata.
- Nonempty `groups` and `views`.
- `nodes` with 0–500 entries.

Node, group and view IDs must be unique within their collection and match `[A-Za-z0-9][A-Za-z0-9_.-]{0,100}`.

| Node field | Contract |
| --- | --- |
| `id`, `title` | Stable ID and string outcome/title. |
| `kind` | `product`, `technical`, `documentation`, `human`, or `milestone`. |
| `status` | `planned`, `ready`, `in_progress`, `verified`, `awaiting_human`, `accepted`, `blocked`, or `unknown`. |
| `groupId` | Existing group ID. |
| `dependsOn` | Array of existing node IDs; duplicates, dangling references, and dependency cycles are rejected. |
| `acceptance` | Array of strings. |
| `evidence` | Array of `{ "label": "Review record", "ref": "evidence.md" }` objects. |
| `references` | Optional array with the same reference shape. |
| `children` | Optional array of existing node IDs describing milestone scope. It does not create dependency edges; put prerequisites in `dependsOn` too. |
| `localVerification` | Detail value, conventionally `verified` or `unknown`, kept separate from status. |
| `delivery`, `checkpoint` | Recorded delivery facts and local verification checkpoint. |
| `blockers` | Recorded blocker objects, such as `{ "id": "ACCESS", "state": "blocked_external", "owner": "Archive administrator", "next_action": "Restore preview access" }`. |
| `humanGate`, `approval`, `deferral` | Explicit gate flag and recorded decision/deferral details. A deferral does not itself grant acceptance. |
| `scopeUnknown` | Explicit indication that milestone scope is not established. |
| `journeys` | Recorded journey rows, conventionally `{ "id", "title", "outcome", "boundaries", "coverage" }`. |
| `recorded` | Optional original item for inspecting source detail. |

Groups contain `id` and string `title`. Views contain `id`, string `title`, and a mode:

| Mode | Meaning |
| --- | --- |
| `all` | All nodes. |
| `include` | Exactly `nodeIds`, plus immediate external prerequisites displayed as boundary nodes. |
| `ancestors` | `nodeIds` and their transitive prerequisites. |
| `blocked` | Nodes recorded as blocked/awaiting human and nodes with propagated blocking ancestors. |

`include` and `ancestors` require known `nodeIds`.

The validator checks structure, enumerations, text, references and renderer-consumed optional fields, including blockers and journeys. Adapter authors still need to review the evidence: a valid snapshot does not establish that its claims are true.

### Completion and blocking

| Recorded state | Dependency effect |
| --- | --- |
| `accepted` | Satisfies any node kind |
| `verified` | Satisfies technical and documentation nodes only |
| Unsatisfied, with `blocked` or `awaiting_human` status | Blocking root |
| Unsatisfied, with a blocker not `resolved` or `resolved_local` | Blocking root |

Blocking roots propagate downstream. Unmet prerequisites alone do not put a node in the blocked view. Expanding groups or changing views affects presentation only.

## Existing ledger adapter

Example configuration for an invented repository:

```json
{
  "root": "../archive-work",
  "adapter": "ledger-v1",
  "project": { "id": "archive", "name": "Community archive" },
  "sources": {
    "ledger": "planning/work.json",
    "journeys": "planning/JOURNEYS.md",
    "execution": "planning/EXECUTION.md"
  },
  "git": true,
  "evidenceAllowlist": ["records/review.md"],
  "groups": [
    { "id": "foundation", "title": "Foundation", "nodeIds": ["T1"] },
    { "id": "experience", "title": "Visitor experience", "nodeIds": ["P1", "H1"] }
  ],
  "views": [
    { "id": "all", "title": "All work", "mode": "all" },
    { "id": "visit", "title": "Visitor path", "mode": "ancestors", "nodeIds": ["P1"] },
    { "id": "gates", "title": "Gates", "mode": "include", "nodeIds": ["H1"] },
    { "id": "blocked", "title": "Blocked work", "mode": "blocked" }
  ]
}
```

The ledger shape is `{ "schema_version": 1, "items": [...] }`.

- Items use the node `id`, `kind` and `status` rules above.
- `outcome` maps to `title`; `depends_on` maps to `dependsOn`.
- Assign every ledger ID to exactly one configured group. Unknown, missing or repeated assignments fail validation.

| Ledger value | Normalized result |
| --- | --- |
| `acceptance`, `delivery`, `checkpoint`, `blockers`, `approval`, `deferral`, `children` | Copied |
| Evidence strings or reference objects | `{label, ref}` entries |
| `spec_refs`, `plan_ref`, `delivery.pr_url`, `delivery.main_ci_url` | References |
| Original item | `recorded` |

Additional mappings preserve the original status:

- `localVerification` is `verified` for checkpoint status `local_verified_pending_delivery` or `local_verified_delivered`, or a technical item with status `verified`. Otherwise it is `unknown`.
- `humanGate` is true for `human_gate: true` or status `awaiting_human`.
- A milestone without children receives `scopeUnknown: true`.

An optional journeys Markdown document may contain four-column table rows:

```markdown
| Journey | Outcome | Boundaries | Coverage |
| --- | --- | --- | --- |
| J01 Find a collection | Search → open record | Empty results; retry | T1, P1 |
```

- Rows begin with `J`, digits and a title.
- Coverage matches existing IDs or bounded numeric ranges such as `T1–T3`.
- Markdown supplies descriptions only; it cannot set status, acceptance or dependencies.
- Other configured documents contribute freshness only.

## Freshness and evidence reads

A successful snapshot includes:

- Capture start/completion and attempts.
- Aggregate source hash and latest modification time.
- Per-file hashes, times and sizes.
- Available Git facts.

The reader compares two source sets and Git metadata, retrying up to three times. Failure preserves the previous valid graph with `stale: true`. Matching reads do not prove an external writer finished every intended update.

Evidence is read on demand and may be newer than the graph. Its response includes the content hash, modification time, read time and associated snapshot hash. Check these before attributing evidence to a displayed state or code version.

Refresh does not query remote CI; it displays saved records.

Evidence IDs are stable SHA-256 identifiers of exact allowlisted references. Refreshing another tab cannot redirect an existing button to a different file. The client also checks the returned reference.

The first read resolves and pins the source root. Retargeting its symlink fails refresh; lower path components reject symlinks. To change roots, update the configuration deliberately and restart.

## Independent journey acceptance (optional)

Both adapters accept an optional top-level `journeys` array with up to 500 records. Sources without it remain valid.

Each normalized record contains:

- Unique `id`, plus `title`, `outcome` and `boundaries`.
- Optional `note`.
- Unique, existing `itemIds` and `acceptanceCriteria` strings.
- `recordSource`: `explicit` or `narrative`.

Selecting a journey shows its items and transitive prerequisites. Membership adds no nodes or dependency edges; tasks can belong to multiple journeys.

Explicit stage records are independent of associated item status:

| Normalized field | Allowed statuses | Other fields |
| --- | --- | --- |
| `localVerification` | `not_assessed`, `partial`, `passed` | `testedCommit`, `evidence` |
| `acceptanceReview` | `not_accepted`, `accepted` | `evidence` |
| `delivery` | `pending_integration`, `delivered` | `evidence` |

Stage evidence uses `{label, ref}` and the node evidence allowlist. Missing or null stages show unknown.

| To record… | Required |
| --- | --- |
| A passing stage | Nonempty evidence, item references and acceptance criteria |
| Local `passed` | The above, plus a tested commit |
| Acceptance `accepted` | Local `passed` |
| Delivery `delivered` | Acceptance `accepted` |

These checks validate structure. The source workflow must verify the evidence and applicable product gates.

The `ledger-v1` adapter maps `item_ids`, `acceptance_criteria`, `local_verification`, `acceptance_review` and `tested_commit` to camelCase. Evidence may use strings or reference objects.

- Explicit ledger journeys override Markdown descriptions with the same ID.
- Remaining Markdown journeys become narrative records with unknown stages.
- Narrative records cannot assert verification, acceptance or delivery.
- Completed tasks alone cannot complete a journey.

An invalid journey fails the whole snapshot. Refresh keeps the previous valid graph with a stale/error warning. A selected journey stays selected while its ID exists.

## Current CI policy and historical observations

Ledger `ci_policy` maps to normalized `ciPolicy`. A task's `delivery.ci` takes precedence; otherwise the UI shows project policy.

| CI record | Display |
| --- | --- |
| `waived` | User-waived / not run; never a pass |
| `not_run`, `passed`, `failed`, `required`, `unknown` | Explicit recorded status |
| Unrecognized legacy value | Unclassified, with the original record available |
| Missing policy | Unknown |

A waiver requires nonempty strings for all six fields: `{status: "waived", decision_ref, reason, replacement, effective_on, until}`.

Historical `checkpoint.ci` and `checkpoint.ci_observation` appear separately. Current policy does not rewrite them or change task, acceptance or delivery states.

The source owner resolves a waived blocker explicitly with `state: "resolved"` and optionally `resolution: "waived_by_user"`. Normal dependency rules then exclude it. Other blockers and human gates still apply; a waiver alone does not authorize implementation, integration or delivery.

## Checkpoint summaries

- `checkpoint.summary` must be a nonempty string to appear in current work and node details. It displays verbatim as escaped text.
- A missing summary shows unrecorded. Failed refresh keeps the last summary with the stale indicator.
- Summaries explain the source state; they do not change verification, acceptance or delivery.
- New evidence references require an inspected `evidenceAllowlist` update and a verified viewer restart to load the new configuration.