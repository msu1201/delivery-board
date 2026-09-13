# Project workflow template

[Documentation](README.md) · [Workflow guide](WORKFLOW.md)

Copy this into your project's workflow. Replace every bracketed value before use.

## Project settings

| Setting | Value |
| --- | --- |
| Authoritative ledger | `[relative ledger path]` |
| Acceptance/specification source | `[relative specification path]` |
| Handoff and active writer | `[relative handoff path; owner/process]` |
| Board configuration | `[relative configuration path]` |
| Source checker | `[project checker command]` |
| Code version convention | `[commit, tree, or other reproducible revision]` |

## Start a task

1. Read the workflow, ledger, prerequisites, acceptance criteria and handoff.
2. Run the checker. Open the evidence and confirm its result and code version.
3. Check active writers and running processes before changing state.
4. Record the selected outcome, allowed scope, required gates and owner.

## Record a result

Wait for relevant processes to finish. Update the authoritative records with:

| Fact | Record |
| --- | --- |
| Task and outcome | `[ID and observed result]` |
| Local verification | `[command/review, result, time, code version]` |
| Evidence | `[relative path or recorded external reference]` |
| Acceptance | `[decision, authorized reviewer, time; or still pending]` |
| Delivery | `[pending integration or recorded merge/CI facts and revision]` |
| Blockers and deferrals | `[state, owner, next action, scope]` |
| Follow-up | `[next permitted work and remaining uncertainty]` |

Keep local verification, acceptance and delivery separate. Passing local checks does not establish human approval or remote CI success.

## Before commit or handoff

- Run `[project checker command]`.
- From the board directory, run `npm run check -- --config [relative configuration path]`.
- Check changed evidence links, dependencies, code versions, files and writer ownership.
- Refresh the board, confirm its source facts and investigate stale warnings.

## Before milestone acceptance

Review scope, prerequisites, unresolved blockers, human gates, delivery and evidence. Record the authorized decision in the ledger. Leave unknown scope and unresolved gates visible; a completion percentage is not acceptance.

## When plans change

1. Update task IDs, status, dependencies, groups, milestone scope and journey membership when the change is agreed.
2. Remove or redirect deleted-task references. Preserve history and evidence; update adapter mappings where needed. List order is not execution order.
3. Validate records. Check the board's changed structure and successful read time/hash.
4. Note any unreconciled changes. Chat or code edits alone do not update the ledger.

Automatic refresh is off by default. When enabled, visible pages reread records five seconds after each request finishes. Automatic refresh can be paused; manual Refresh remains available. Hidden pages pause polling. This does not run an agent or watch the filesystem.

The board is read-only and replaceable. Refresh makes no model calls, uses saved CI records and reads only configured sources and allowlisted evidence. Valid structure does not prove the evidence is true or sufficient.
