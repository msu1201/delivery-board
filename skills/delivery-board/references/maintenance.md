# Maintaining normalized records

Use the resolved checkout's `docs/ADAPTER-CONTRACT.md` as the schema authority. Inspect the initialized configuration rather than assuming a graph filename or source root. Change only the sidecar and source records covered by the user's task; respect an existing project's authoritative ledger and active writer.

## First population

Read approved project records before creating tasks. Map explicit work items to stable IDs, descriptive titles, kinds, groups, acceptance criteria, and exact references. A draft proposal may be referenced as a draft but is not an approved plan or acceptance decision. Use `unknown` for unsupported status; an approved future work item may be `planned`. Include only recorded prerequisite edges. If the source supplies no dependencies, do not manufacture a linear chain.

Use milestone `children` only for established scope. Set `scopeUnknown` when scope is not established. A group's visual containment does not define milestone scope. Journey `itemIds` identify coverage and do not add dependencies. Narrative journeys retain unknown stage facts. Explicit journey stages must satisfy the contract and actual evidence; passing all associated tasks does not imply journey acceptance.

For each local reference, resolve it against the configuration root and inspect the target. Preserve source provenance rather than copy unsupported conclusions into evidence. Include a file in `sources` if its changes must affect snapshot freshness, within the contract's limits. Add exact inspected paths to `evidenceAllowlist` only when the user should be able to read them through the viewer. A recorded external link is metadata; the board does not fetch its content. Do not broaden the allowlist to an entire repository or use traversal/symlink workarounds. If a document cannot fit the access contract, leave it as metadata or explicitly prepare an authorized compatible evidence record.

## Approved change reconciliation

Review the affected records together before saving:

| Change | Required reconciliation |
| --- | --- |
| Add or split an item | Use stable new IDs; transfer only facts supported for each resulting item; preserve provenance. |
| Delete or replace an item | Remove or explicitly redirect `dependsOn`, `children`, view `nodeIds`, and journey `itemIds`; review groups and retained history. Do not guess replacement edges. |
| Reorder a plan | Change presentation if requested; change prerequisites only when the plan explicitly changes them. |
| Change scope | Update acceptance criteria, milestone children, journey outcomes/boundaries/coverage, and affected evidence. Reassess whether old verification still applies. |
| Record verification | Preserve the exact result, relevant revision and evidence; do not promote it to human acceptance or delivery. |
| Receive an acceptance decision | Record the authorized decision and evidence within its stated scope. Do not extend it to unrelated tasks or journeys. |
| Change evidence/configuration | Check exact references, configured source paths and allowlist; restart the viewer after configuration changes. |

Use the project's checker when one exists, then the public `check` command. Inspect the final diff for unrelated edits and dangling references. Save coordinated record changes promptly; the snapshot reader's consistency checks cannot prove that a writer finished a multi-file update. An invalid intermediate record must remain visibly stale rather than appear current.

Open or refresh the board, confirm a successful source capture and the affected structure. If automatic refresh is paused or the page hidden, resume/return and verify a new successful read. On a failed read, retain the prior valid data and investigate the visible error; never describe that data as current. Report what was updated, what evidence supports the state, and any outstanding source gap.
