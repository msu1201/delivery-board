# Working from an evidence-backed ledger

The ledger records intended outcomes and their state. Evidence supports those records. The board helps inspect them and is replaceable; it is not a second authority or an automatic acceptance engine.

## Before work

1. Read the applicable workflow, ledger, dependencies, acceptance criteria, and latest execution handoff. Run the source checker for the configuration in use.
2. Inspect the actual referenced evidence and the code version it covers. A valid JSON graph, a link label, or an old passing result is not enough to establish readiness.
3. Identify any active writer or running process. Respect its ownership and existing work; do not overwrite intermediate state, claim its changes, or infer a terminal result while it is still running.
4. Choose work whose prerequisites and required human decisions permit it. Keep deferred gates visible with their scope, owner, and next action.

## After work reaches a terminal result

Wait for the relevant checks, jobs, and writing processes to finish before recording a final outcome. Update the authoritative ledger and evidence together as far as the source workflow allows. Record the outcome, command or review performed, result, timestamp, code version, and the evidence location. Record failed or blocked results as carefully as passing ones.

Separate local verification from acceptance and delivery. For example, a local check can pass while integration remains blocked; preserve `localVerification: verified`, the blocked status, and `delivery.status: pending_integration`. Human acceptance requires the actual authorized review result. Recorded merge or CI facts must identify the corresponding revision and source; a local check does not establish remote success.

## Before a commit or handoff

Run the ledger's own checker, if one exists, and the board's source check:

```sh
npm run check -- --config examples/synthetic/config.json
```

Use the configuration for the source you are reviewing. Check evidence links, node references, dependencies, and recorded code versions. Ensure referenced local evidence is present and deliberately allowlisted if it should be readable in the board. Review the actual changed source files and any active-writer ownership before committing. A clean checker result proves the checked structure, not the claims inside it.

Refresh the board and inspect its source hash, modification times, stale warning, and Git facts. Git dirtiness shown here covers configured source files only. If the source is stale or a writer is still active, resolve that uncertainty before relying on the displayed state.

## Milestone review

Review the milestone's explicit children and prerequisites, unmet dependencies, propagated blockers, human gates, delivery records, and evidence. An empty or unknown scope needs clarification; it cannot count as complete. Do not replace this review with a percentage or assume a locally verified product is accepted. Close the milestone only through the authoritative workflow and evidence-backed decision.

Refresh uses deterministic local reads and zero model calls. Remote CI is recorded-only. The board cannot edit source state or read arbitrary source paths, and schema validity cannot prove evidence truth.

If the viewer service is stopped or the tool is unavailable, continue through the repository's own ledger/checker and evidence procedure. Starting this display service is never a prerequisite for development, acceptance or a release. Its source-check command can run without a server.

## Journey review

At a checkpoint, update affected journey records only when their own evidence supports the claim. Record the whole journey's local verification, acceptance, and delivery separately from its tasks. A partial slice result can support `partial`; it does not establish complete journey acceptance. After saving and validating the source, refresh, select the journey, inspect its prerequisites and open each stage's evidence. Legacy narrative-only journeys remain unknown until explicitly assessed.

## When the plan or structure changes

Record agreed changes when they happen, not only at task completion. Update affected task IDs, statuses, dependency references, group membership, milestone scope, and journey membership in the authoritative source. Remove or redirect references to deleted tasks; do not treat list position as an execution order. Preserve evidence/history according to the project's own procedure. Update explicit adapter mappings when required.

Validate the revised records, then refresh the running board and verify the changed structure and successful read time/hash. A conversation or code edit alone does not update a ledger. If records are not yet reconciled, state that gap rather than claim the board reflects those changes. While the page is visible, enabled automatic refresh rereads records five seconds after the previous request completes. It can be paused; manual Refresh remains available. Hidden pages pause polling. This is browser polling, not a filesystem watcher or execution heartbeat.
