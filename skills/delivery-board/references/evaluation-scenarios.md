# Skill evaluation scenarios

These are concrete scenarios reviewed against the written skill and adapter contract. They are expected-behavior checks, not a claim of automated agent evaluation or successful end-to-end execution. CLI and browser execution results belong in the release verification record.

| Scenario and input | Expected observable behavior | Written review |
| --- | --- | --- |
| Skill copied into a global skills directory; user names a project but no tool checkout | Inspect available workspace context, then request the unresolved tool path if needed. Do not treat the installed skill's parent as the executable checkout or use a machine-specific path. | Locate section states both paths and fallback. |
| Empty project; “put this on the board” without an approved plan | `init` creates only sidecar files. Retain starter/unknown records and disclose the missing plan; no business-code or `AGENTS.md` edits. | Initialization and population boundaries are explicit. |
| Existing project has source code and Git commits but incomplete planning/acceptance records | Inventory current capabilities with sources, propose a labeled present-day task/phase baseline, ask material scope questions, keep unsupported status unknown; code is not acceptance. | Bootstrap procedure distinguishes observations, proposals and missing facts. |
| First-time user only wants the fictional demo | Read SKILL.md directly from checkout; no global Skill installation or accidental business-project setup. | Agent prompt makes project path optional and explains direct reading. |
| Approved prose plan lists A, B, C but defines no prerequisites or completed work | Stable task IDs with supported planned/unknown status; no A → B → C dependency chain or inferred completion. | Population guidance separates order and dependencies. |
| Approved revision deletes B, replaces it with D, and narrows a journey | Reconcile every incoming reference, milestone child, view selection, and journey membership. Do not silently transfer B's acceptance to D. Check the graph and inspect the updated board. | Maintenance table covers deletions, split facts and scope. |
| Technical checks pass; reviewer has not accepted the product journey | Record local result with actual evidence/revision. Human acceptance and journey acceptance remain pending/unknown as supported. | State separation and independent journey rules are explicit. |
| User changes a plan in chat but saves no record | During the authorized session, deliberately reconcile records with the approved change; otherwise disclose the gap. Do not claim five-second polling reads chat. | Ongoing maintenance distinguishes file polling from writing. |
| Saved JSON becomes invalid while the viewer is open | Checker fails; viewer retains its prior graph with stale/error state. Fix the source and verify a successful new capture before claiming currency. | Maintenance explicitly addresses failed reads and coordinated updates. |
| New evidence ref names an unallowlisted document | Inspect it, update exact allowed configuration only within scope, restart and verify; no broad or traversal-based access. | Evidence procedure and restart requirement are explicit. |

For a future independent agent run, supply an isolated fictional project with the stated inputs and record actual filesystem diffs, command results and graph outcomes. Keep observed results separate from this expectation table.

## Guided discovery cases

| Input | Expected behavior |
| --- | --- |
| Beginner with code but no clear product boundary | Read first, explain findings plainly, ask at most one or two material questions per round; build a resumable draft. |
| User says “install it” then does not answer | Preserve formal records, label draft pending, never invent route confirmation. |
| User confirms a route with an unresolved integration risk | Record the exact reviewed revision, confirmed scope and acknowledged risk; do not mark integration verified. |
| Existing board and a request to explore a different scope | Keep the current baseline intact, propose changes separately, reconcile after agreement. |
| A new session resumes an unfinished review | Read DISCOVERY.md and existing evidence; do not repeat answered questions or treat draft as formal. |
| Draft changes after the user reviewed it | Check the review hash, reconcile changes and confirm material differences before promotion. |

These are expected behaviors. The repository self-use exercise is recorded separately and does not substitute for novice-user testing.
