# Delivery workflow template

Copy this procedure into the project's own workflow and replace bracketed values before use.

## Authority and ownership

- Authoritative ledger: `[relative ledger path]`
- Acceptance/specification source: `[relative specification path]`
- Execution handoff and active writer: `[relative handoff path; owner/process]`
- Board configuration: `[relative configuration path]`
- Source checker: `[project checker command]`
- Code version convention: `[commit, tree, or other reproducible revision]`

## Start a work item

Read the workflow, ledger, prerequisites, acceptance criteria, and handoff. Run the checker. Open the actual evidence and confirm what result and code version it supports. Respect active writer ownership and running processes before changing state. Record the selected outcome, allowed scope, required gates, and owner.

## Record a terminal result

After all relevant processes finish, update the authoritative state with:

| Fact | Record |
| --- | --- |
| Work item and outcome | `[ID and observed result]` |
| Local verification | `[command/review, result, time, code version]` |
| Evidence | `[relative path or recorded external reference]` |
| Acceptance | `[decision, authorized reviewer, time; or still pending]` |
| Delivery | `[pending integration or recorded merge/CI facts and revision]` |
| Blockers and deferrals | `[state, owner, next action, scope]` |
| Follow-up | `[next permitted work and remaining uncertainty]` |

Keep locally verified, accepted, and delivered states separate. Do not infer human approval from passing checks or remote CI from local results.

## Before commit or handoff

Run `[project checker command]` and `npm run check -- --config [relative configuration path]` from the board directory. Check all changed evidence links, dependencies, and code-version references. Review changed files and active writer ownership. Refresh the board, confirm its source facts, and investigate any stale warning.

## Before milestone acceptance

Review explicit scope, every prerequisite, unresolved blockers, required human gates, delivery state, and supporting evidence. Record the authorized decision in the ledger. Unknown scope or an unresolved gate remains visible; percentage completion is not acceptance.

The board is a replaceable, read-only view. Refresh makes zero model calls, remote CI is recorded-only, and file access is limited to configured sources and allowlisted references. A valid schema does not establish that evidence is true or sufficient.

## When the plan or structure changes

Record agreed changes when they happen, not only at task completion. Update affected task IDs, statuses, dependency references, group membership, milestone scope, and journey membership in the authoritative source. Remove or redirect references to deleted tasks; do not treat list position as an execution order. Preserve evidence/history according to the project's own procedure. Update explicit adapter mappings when required.

Validate the revised records, then refresh the running board and verify the changed structure and successful read time/hash. A conversation or code edit alone does not update a ledger. If records are not yet reconciled, state that gap rather than claim the board reflects those changes. While the page is visible, enabled automatic refresh rereads records five seconds after the previous request completes. It can be paused; manual Refresh remains available. Hidden pages pause polling. This is browser polling, not a filesystem watcher or execution heartbeat.
