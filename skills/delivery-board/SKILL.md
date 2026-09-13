---
name: delivery-board
description: Use when setting up the local Delivery Board viewer for a project or maintaining its saved delivery graph after approved plans, scope, dependencies, evidence, or acceptance records change.
---

# Delivery Board

The board is a local, read-only view of saved project records. This skill prepares and maintains those records; the viewer does not interpret conversations, infer implementation progress, or approve work.

The user may ask an Agent to read this file directly from the checkout; copying it to a skill directory is optional and useful for repeated discovery. This instruction file does not install the application.

## Locate and open

Resolve two absolute paths: `DELIVERY_BOARD_DIR`, the downloaded tool directory containing `package.json`, `src/entry.js`, and `docs/ADAPTER-CONTRACT.md`; and `PROJECT_DIR`, the user's chosen project. Use a supplied path or inspect the current workspace. If the skill has been copied to a skill directory, its parent is not necessarily the tool checkout. Ask for the missing path if it cannot be established. Never embed a developer's machine path. Read the tool's README for current runtime and dependency setup.

With shell variables set to those resolved paths:

```sh
node "$DELIVERY_BOARD_DIR/src/entry.js" demo
node "$DELIVERY_BOARD_DIR/src/entry.js" init "$PROJECT_DIR"
node "$DELIVERY_BOARD_DIR/src/entry.js" check "$PROJECT_DIR"
node "$DELIVERY_BOARD_DIR/src/entry.js" open "$PROJECT_DIR"
```

Use `open "$PROJECT_DIR" --no-open` to leave browser opening to the user. If the user has already installed the command with `npm link`, `delivery-board` may replace `node "$DELIVERY_BOARD_DIR/src/entry.js"`. Global linking is optional. Do not install this skill or alter global configuration merely to open a board.

`init` creates only the project's `.delivery-board` sidecar files; it does not analyze code or turn a plan into a graph. Inspect existing sidecar files before initialization and preserve them. No automatic edits to business code or `AGENTS.md` are part of this workflow.

## Populate deliberately

Read `docs/ADAPTER-CONTRACT.md` from the resolved tool checkout and inspect the initialized configuration to find its actual source paths. Identify the approved plan, specification, execution records, and acceptance decisions. For initial onboarding, read [references/bootstrap.md](references/bootstrap.md). If history or plans are incomplete, inventory the present project and propose a clearly labeled baseline; ask about material gaps rather than inventing a historical roadmap.

Normalize only supported facts. Use stable IDs, explicit dependencies, actual acceptance criteria, and exact source references. List position, numbering, group membership, and journey membership do not establish execution order or dependencies. Uncertain status is `unknown`. Keep local verification, acceptance, and delivery separate; never invent human approval, milestone scope, evidence, a tested commit, or remote CI results. Read [references/maintenance.md](references/maintenance.md) when creating or revising the graph.

Run `check` after saving and inspect the displayed source freshness and relevant records. A successful structural check does not verify evidence truth.

## Keep records current

When authorized work changes an approved plan or its delivery facts, reconcile the saved graph in that same work session, including references, deletions, scope, and journeys. Follow existing project ownership and approval rules. Record uncertainties instead of silently resolving them. Report any unreconciled gap.

The visible page polls saved sources every five seconds while automatic refresh is enabled. This reads files; it makes no model calls and performs no ongoing source maintenance. A chat reply, code edit, or heartbeat alone cannot update graph facts. After configuration or evidence allowlist changes, restart the viewer and verify the new configuration.

For maintainers reviewing this skill, [references/evaluation-scenarios.md](references/evaluation-scenarios.md) records concrete cases and expected outcomes, with the limits of the review stated explicitly.
