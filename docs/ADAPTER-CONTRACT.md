# Adapter contract

The board accepts a JSON configuration with adapter `normalized` or `ledger-v1`. All examples here use invented projects, paths, and IDs.

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

`root` is resolved relative to the configuration file. Values in `sources` are relative to that root. At most 12 source entries are allowed. Paths cannot be absolute, contain traversal or empty segments, use backslashes, or include URL/query/fragment syntax. Sources must be regular UTF-8 files of at most 2 MiB; symlink paths are refused. The normalized adapter parses `sources.graph`; additional configured documents participate in freshness checks but do not infer graph state.

`git: false` disables Git metadata. `git: true` requires it and a failure makes the snapshot stale. If omitted, unavailable Git metadata is reported as unknown. When available, freshness includes HEAD, branch, and dirty status scoped to the configured source files. This is not a statement that all application code is clean.

`evidenceAllowlist` contains exact root-relative file references. A file must both appear in a node's evidence/references or a journey stage's evidence and be allowlisted to be readable through the evidence endpoint. It is checked again on read. Other references may remain recorded metadata; the server does not fetch external URLs or open arbitrary paths. To include an evidence document in the snapshot's freshness hash, also list it in `sources`.

## Normalized graph

Required top-level fields are `schemaVersion: 1`, `project` with string `name`, nonempty `groups`, nonempty `views`, and `nodes` with 0–500 entries. A project `id` is useful metadata. Node, group, and view IDs are unique within their own collection and match `[A-Za-z0-9][A-Za-z0-9_.-]{0,100}`.

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

`include` and `ancestors` require an array of known `nodeIds`. The validator checks graph structure, core enumerations, text fields, and reference shapes. It validates renderer-consumed optional structures, including blocker and journey arrays and known detail-field types, before accepting a snapshot. It does not establish evidence truth. Adapter authors must preserve honest, well-formed details and review their evidence.

Dependency satisfaction uses recorded status: `accepted` satisfies any node kind; `verified` satisfies technical and documentation nodes only. An unsatisfied prerequisite is a blocking root if its status is `blocked` or `awaiting_human`, or it contains a blocker whose state is neither `resolved` nor `resolved_local`. Blocking roots propagate downstream. A node can therefore have unmet dependencies without being in the blocked view. Group expansion and views change presentation, not the source graph or its state.

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

The ledger document is `{ "schema_version": 1, "items": [...] }`. Each item uses the same `id`, `kind`, and `status` conventions above, with `outcome` mapped to `title` and `depends_on` mapped to `dependsOn`. Each ledger ID must be assigned exactly once to a configured group. Unknown, missing, or multiply assigned IDs are errors.

The adapter copies `acceptance`, `delivery`, `checkpoint`, `blockers`, `approval`, `deferral`, and `children`. Evidence entries can be strings or reference objects; they normalize to `{label, ref}`. `spec_refs`, `plan_ref`, `delivery.pr_url`, and `delivery.main_ci_url` become references. The original item is retained as `recorded`.

`localVerification` becomes `verified` when `checkpoint.status` is `local_verified_pending_delivery` or `local_verified_delivered`, or when a technical item has status `verified`; otherwise it is `unknown`. `humanGate` is true when `human_gate` is true or the status is `awaiting_human`. A milestone without children receives `scopeUnknown: true`. These mappings do not change the original status.

An optional journeys Markdown document may contain four-column table rows:

```markdown
| Journey | Outcome | Boundaries | Coverage |
| --- | --- | --- | --- |
| J01 Find a collection | Search → open record | Empty results; retry | T1, P1 |
```

Rows must begin with `J` followed by digits and a title. Coverage maps exact existing IDs and bounded numeric ranges such as `T1–T3`. The adapter attaches journey descriptions, but never derives status, acceptance, or dependencies from narrative prose. Other configured documents contribute source freshness only.

## Freshness and evidence reads

A successful snapshot reports capture start/completion, attempts, an aggregate source hash, latest source modification time, per-file hashes/times/sizes, and available Git facts. The reader compares two source sets and Git metadata, retries up to three times, and retains its previous valid graph on failure with `stale: true`. A matching capture does not prove an external writer finished all intended updates.

Evidence is read on demand, so it may be newer than the graph snapshot. Its response carries a content hash, modification time, read time, and the associated snapshot hash. Interpret those facts before attributing the evidence to the displayed state or code version. Remote CI is recorded-only and is not queried during refresh.

Local evidence IDs are stable SHA-256 identifiers of exact allowlisted references, not mutable array positions. A refresh in another tab cannot change which file an existing button identifies. The client verifies the returned reference too.

The source root is resolved and pinned on the first read. Retargeting its symlink after startup fails the refresh; all lower path components reject symlinks. Restart with an intentionally updated configuration to change source roots.

## Independent journey acceptance (optional)

Both adapters accept an optional top-level `journeys` array (up to 500 records). Existing sources without it remain valid. Each normalized record contains unique `id`, `title`, `outcome`, `boundaries`, optional `note`, unique existing `itemIds`, `acceptanceCriteria` strings, and `recordSource` (`explicit` or `narrative`). Selecting a journey shows its referenced items and their existing transitive prerequisites. Membership creates neither extra nodes nor dependency edges; an item may belong to multiple journeys.

Explicit stage records are independent of associated item status:

| Normalized field | Allowed statuses | Other fields |
| --- | --- | --- |
| `localVerification` | `not_assessed`, `partial`, `passed` | `testedCommit`, `evidence` |
| `acceptanceReview` | `not_accepted`, `accepted` | `evidence` |
| `delivery` | `pending_integration`, `delivered` | `evidence` |

Evidence uses `{label, ref}` entries and the same allowlist as node evidence. Missing/null stages display unknown. Passing a stage requires nonempty evidence, item references, and acceptance criteria; local `passed` additionally requires a tested commit. `accepted` requires local `passed`; `delivered` requires acceptance `accepted`. These are structural safeguards, not proof that a review occurred. The source workflow must check actual evidence and all applicable product gates.

The ledger-v1 adapter maps `item_ids`, `acceptance_criteria`, `local_verification`, `acceptance_review`, and `tested_commit` to their camelCase names. Ledger evidence entries may be strings or reference objects. Explicit ledger journeys override Markdown descriptions with the same ID. Remaining Markdown journeys become narrative records with unknown stages; narrative records cannot assert verification, acceptance, or delivery. No journey becomes complete because its associated tasks are green.

Invalid journey records fail the snapshot atomically. Refresh preserves the prior valid snapshot with a visible stale/error warning, and retains a selected journey while its ID still exists.

## Current CI policy and historical observations

Optional ledger `ci_policy` maps to normalized `ciPolicy`. An item's `delivery.ci`, when present, supplies its own current record; otherwise the UI shows the project policy. A waiver is `{status: "waived", decision_ref, reason, replacement, effective_on, until}` with nonempty string values for all six fields. It displays user-waived / not run and never counts as a passing CI result. `not_run`, `passed`, `failed`, `required`, and `unknown` receive explicit recorded labels; unrecognized legacy records remain unclassified and readable. Existing sources without policy remain valid and display unknown.

The UI shows historical `checkpoint.ci` and `checkpoint.ci_observation` under a separate history heading. Current policy never rewrites this history or task/acceptance/delivery states. The source owner explicitly resolves a waived blocker (`state: "resolved"`, optionally `resolution: "waived_by_user"`); the board's normal dependency rules already exclude resolved blockers. Other unresolved blockers and human gates remain effective. A waiver does not itself authorize implementation, integration, or delivery.

A nonempty string `checkpoint.summary` is shown verbatim as escaped text in the normal current-work area and node details. Missing summaries stay explicitly unrecorded. The summary is explanatory source data, never a rule for changing local verification, acceptance or delivery status. Failed refresh retains the last successful summary alongside the stale indicator. Newly added evidence references still require an explicit inspected `evidenceAllowlist` update and a verified viewer restart to load changed configuration.
