# Skill evaluation scenarios

These are concrete scenarios reviewed against the written skill and adapter contract. They are expected-behavior checks, not a claim of automated agent evaluation or successful end-to-end execution. CLI and browser execution results belong in the release verification record.

| Scenario and input | Expected observable behavior | Written review |
| --- | --- | --- |
| Skill copied into a global skills directory; user names a project but no tool checkout | Inspect available workspace context, then request the unresolved tool path if needed. Do not treat the installed skill's parent as the executable checkout or use a machine-specific path. | Locate section states both paths and fallback. |
| Empty project; “put this on the board” without an approved plan | `init` creates only sidecar files. Retain starter/unknown records and disclose the missing plan; no business-code or `AGENTS.md` edits. | Initialization and population boundaries are explicit. |
| Approved prose plan lists A, B, C but defines no prerequisites or completed work | Stable task IDs with supported planned/unknown status; no A → B → C dependency chain or inferred completion. | Population guidance separates order and dependencies. |
| Approved revision deletes B, replaces it with D, and narrows a journey | Reconcile every incoming reference, milestone child, view selection, and journey membership. Do not silently transfer B's acceptance to D. Check the graph and inspect the updated board. | Maintenance table covers deletions, split facts and scope. |
| Technical checks pass; reviewer has not accepted the product journey | Record local result with actual evidence/revision. Human acceptance and journey acceptance remain pending/unknown as supported. | State separation and independent journey rules are explicit. |
| User changes a plan in chat but saves no record | During the authorized session, deliberately reconcile records with the approved change; otherwise disclose the gap. Do not claim five-second polling reads chat. | Ongoing maintenance distinguishes file polling from writing. |
| Saved JSON becomes invalid while the viewer is open | Checker fails; viewer retains its prior graph with stale/error state. Fix the source and verify a successful new capture before claiming currency. | Maintenance explicitly addresses failed reads and coordinated updates. |
| New evidence ref names an unallowlisted document | Inspect it, update exact allowed configuration only within scope, restart and verify; no broad or traversal-based access. | Evidence procedure and restart requirement are explicit. |

For a future independent agent run, supply an isolated fictional project with the stated inputs and record actual filesystem diffs, command results and graph outcomes. Keep observed results separate from this expectation table.
