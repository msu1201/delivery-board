# Guide a project to its first baseline

The user's coding agent runs this conversation. Installing the viewer does not start it. `init` only creates empty files.

## 1. Read before asking

Resolve the tool and project paths. Inspect existing configuration, records and active writers before creating anything. Read the adapter contract and relevant plans, requirements, code, tests, handoffs and local Git history. Use relevant remote records only with available access and existing authorization.

Summarize what the project does, what appears implemented and which evidence is missing. Keep these categories explicit:

| Category | Meaning |
| --- | --- |
| Observed fact | Supported by an inspected source or actual check; include its path/revision and limits |
| Agreed plan | User decision or approved project record; cite its scope |
| Proposal | Agent suggestion awaiting agreement |
| Unknown or risk | Unanswered question, failure possibility or untested assumption |

Code presence does not prove acceptance. Tests support their actual tested scope. Missing history calls for today's baseline, not invented historical tasks.

## 2. Discuss the gaps

Use [discovery-template.md](discovery-template.md) as a worksheet, not a questionnaire to paste at the user. Read existing answers first. Ask one or two material questions per round in the user's language. Explain the consequence and offer a concrete suggestion when useful; accept free-text answers and corrections.

Cover the areas relevant to the project:

- Who needs it, what outcome they need, and the boundary of the first useful version.
- The path from starting a user action to getting its result, including failure, retry, interruption and recovery.
- What observable behavior would count as acceptance, and who can confirm it.
- Data, integrations, permissions, budget/time constraints and technical unknowns that could change the route.

For example, ask “If saving fails, should their text still be there?” rather than “What is your resilience strategy?” Do not ask for secrets or demand a technical design from a beginner.

If a risk needs investigation, propose a bounded test with an observable result. Leave untested assumptions visible. Do not create an exhaustive security or engineering checklist unrelated to the project.

## 3. Build a reviewable draft

Record the discussion in `.delivery-board/DISCOVERY.md`, using the worksheet. Maintain exact source references, open questions and decision scope. Existing authoritative project records take precedence; link them rather than creating a competing ledger.

Use `.delivery-board/draft.graph.json` and a separate `draft.config.json` for an optional visual draft. Keep existing formal graph/configuration unchanged. A new `init` graph stays empty until baseline agreement.

- Put `DRAFT — awaiting route confirmation` in the draft project name, translated to the user's language. Also mark it at the top of DISCOVERY.md.
- Group tasks around useful outcomes, not folders. Phases are proposals until adopted.
- Explain each proposed dependency: which prerequisite result does the later task require? List position is not a dependency.
- Link tasks to journeys through `itemIds`; write outcomes, boundaries and acceptance criteria for each journey.
- Use milestone `children` for explicit scope. Unknown scope stays `scopeUnknown`.
- Use supported `checkpoint.summary` and `references` to identify each task's fact/plan/proposal and unresolved risk. Do not add invented schema fields or turn confidence into progress percentages.
- Proposed future work stays `unknown` until adopted; evidenced existing work keeps only its supported status. No fabricated acceptance, tested revision or CI result.

Validate the draft using the tool's `src/cli.js --config` source checker. Show the draft with `src/launcher.js --config ... --port 0` if useful. These use the separate draft configuration; ordinary `open` still reads the formal configuration.

## 4. Confirm the route, then establish the baseline

Present a short review with a dated revision or file hash: goal, first-version scope, journeys, tasks/dependencies, acceptance criteria and remaining risks. Ask the user to confirm or adjust this concrete route. Reuse an earlier decision only if it actually covers this route and scope. “Install it” or “start investigating” is not route confirmation.

Unanswered questions can remain in an accepted baseline if their consequences are clear. Silence is not confirmation. A user can stop with the draft and resume later without repeating answered questions.

After agreement:

1. Record who confirmed what, when, the reviewed draft revision/hash, and any exclusions in DISCOVERY.md. Route agreement is planning approval, not product acceptance.
2. Recheck that the draft and formal records have not changed since review. Reconcile competing writes before promotion.
3. Save the agreed graph to the configured formal source, remove the draft label there and retain the review history. For a fresh sidecar, use its existing `graph.json`; inspect custom configurations before writing.
4. Inspect and allowlist exact evidence files, validate the formal configuration, then open it. Restart and verify the viewer if configuration changed.
5. Report the baseline location and remaining unknowns. Follow maintenance.md for later changes.

This confirmation step is an agent workflow, not a server-enforced approval lock. Manual JSON edits remain possible. Do not claim the application enforces decisions it cannot verify.
