---
name: delivery-board
description: Guide users through an existing project, clarify goals, journeys and risks, confirm a first Delivery Board roadmap, or maintain its saved records as work changes.
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

## Guide the first baseline

Read [references/bootstrap.md](references/bootstrap.md) for first onboarding or when the user asks to rethink an existing project. It covers evidence inventory, a short guided conversation, a reviewable route draft, and confirmation before the first formal baseline. Use [references/discovery-template.md](references/discovery-template.md) to retain findings and decisions between sessions.

Read project materials before asking questions. Explain choices in ordinary language; ask only one or two material questions at a time. Reuse answers and decisions already supplied. Cover goals, scope, user outcomes, failure recovery, acceptance and relevant technical risks.

Keep observed facts, agreed plans, proposals and unknowns distinct. Keep the draft separate from existing formal records. The user confirms the concrete route before it becomes the baseline; asking to install or investigate is not that confirmation. A baseline may contain acknowledged unknowns. Planning approval never implies product acceptance.

Read the tool's `docs/ADAPTER-CONTRACT.md` and inspect configured source paths before writing graph records. Use stable IDs, supported fields and exact references. List order or group/journey membership does not create dependencies. Missing status is `unknown`; verification, acceptance and delivery stay separate. Follow [references/maintenance.md](references/maintenance.md) when creating or revising records.

Validate and inspect the displayed source freshness. Structural checks do not verify evidence truth. This Skill provides a workflow; the viewer does not enforce the route-confirmation step.

## Keep records current

When authorized work changes an approved plan or its delivery facts, reconcile the saved graph in that same work session, including references, deletions, scope, and journeys. Follow existing project ownership and approval rules. Record uncertainties instead of silently resolving them. Report any unreconciled gap.

Automatic refresh is off by default and costs no model tokens. When enabled, the visible page polls saved sources every five seconds while automatic refresh is enabled. This reads files; it makes no model calls and performs no ongoing source maintenance. A chat reply, code edit, or heartbeat alone cannot update graph facts. After configuration or evidence allowlist changes, restart the viewer and verify the new configuration.

For maintainers reviewing this skill, [references/evaluation-scenarios.md](references/evaluation-scenarios.md) records concrete cases and expected outcomes, with the limits of the review stated explicitly.
