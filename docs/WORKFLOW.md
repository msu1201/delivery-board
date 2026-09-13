# Keeping project records current

[Documentation](README.md) · [Copyable workflow template](WORKFLOW-TEMPLATE.md)

The project ledger is the source of truth. Keep outcomes, status and evidence there; the board displays those records.

## Before work

1. Read the workflow, task, prerequisites, acceptance criteria and latest handoff. Run the project's source checker.
2. Open the evidence and check which code version it covers. A valid graph or an old passing result does not establish readiness.
3. Identify active writers and running processes. Preserve their work and wait for results before recording a final outcome.
4. Choose work permitted by its prerequisites and required human decisions. Keep deferred gates visible with their scope, owner and next action.

## Record the result

Wait for relevant checks, jobs and writers to finish. Then update the ledger and evidence together as the project workflow allows. Record failures and blockers too.

| Record | Include |
| --- | --- |
| Outcome | What happened and which task it affects |
| Verification | Command or review, result, time and code version |
| Evidence | File path or recorded external reference |
| Acceptance | Authorized review result, or pending |
| Delivery | Integration status, merge/CI source and revision |
| Blockers | Owner, unresolved condition and next action |

Keep verification, acceptance and delivery separate. A local check may pass while integration is blocked: preserve `localVerification: verified`, the blocked status and `delivery.status: pending_integration`. Local checks do not prove remote CI success or human acceptance.

## Before a commit or handoff

Run the project's checker, if available, then the board's source check from the tool directory. Replace this sample configuration with your own:

```sh
npm run check -- --config examples/synthetic/config.json
```

- Check evidence links, task references, dependencies and code versions.
- Allowlist local evidence deliberately if the board should open it.
- Review changed files and active-writer ownership before committing.
- Refresh and inspect the source hash, modification times, Git facts and any stale warning. Git dirtiness covers configured source files only.

A passing checker validates structure. Review the evidence before relying on the claims. Resolve stale records or unfinished writes first.

## Review a milestone or journey

| Review | What to check |
| --- | --- |
| Milestone | Explicit children and scope, prerequisites, propagated blockers, human gates, delivery and evidence |
| Journey | Its own verification, acceptance and delivery records, plus prerequisites and evidence for each stage |

Unknown milestone scope needs clarification. Close a milestone through the project's authorized review; a percentage cannot replace that decision.

Update journey stages only when their evidence supports it. A partial slice can support `partial`, but not acceptance of the whole journey. After saving and validating, select the journey and inspect each stage's evidence. Narrative-only journeys stay unknown until assessed.

## When the plan or structure changes

Update records when a change is agreed, rather than waiting for task completion:

- Tasks: IDs, status and dependencies; remove or redirect references to deleted tasks.
- Structure: group membership, milestone scope and journey membership.
- Adapters: explicit mappings affected by the change.
- History: preserve evidence and previous results according to the project workflow.

List order does not define execution order. Validate, then check that the board shows the new structure and a successful read time/hash. If records still need reconciliation, say so; chat and code edits alone do not update the ledger.

## Refresh and availability

- Visible pages reread records five seconds after the previous request finishes. Refresh can be paused; manual Refresh remains available. Hidden pages pause polling.
- This is browser polling, not a filesystem watcher or agent heartbeat.
- Refresh makes no model calls. Remote CI comes from saved records; file access is limited to configured sources and allowlisted evidence.
- If the viewer is unavailable, continue with the project's ledger, checker and evidence. The checker runs without a server. Opening the board is not required for development, acceptance or release.
