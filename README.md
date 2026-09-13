# Delivery Board

**See what is happening now, where it belongs, and what depends on it.**

A local, read-only dependency board that evolves with your saved project records. It shows current work, task/group progress, blockers, and independent journey verification. It does not run your application or infer progress from unrecorded conversations.

[中文说明](README.zh-CN.md) · [Source contract](docs/ADAPTER-CONTRACT.md) · [Companion skill](skills/delivery-board/SKILL.md)

![Fictional Wayfarer project](launch/assets/demo-overview.png)

Every public screenshot and demo uses **Wayfarer**, an entirely fictional travel-planner project. No private project data is required.

## Try it

Requires Node.js 22+ and npm. Download this repository using **Code → Download ZIP**, extract it, then open a terminal in that directory:

```sh
npm ci
npm run demo
```

The browser opens automatically. The terminal prints the actual local URL and viewer PID. A busy port is left untouched; the viewer chooses another available port. No background service is installed. Repeat the command to reopen/reuse the viewer. `--no-open` prints the URL without opening a browser.

## Connect your project

From the downloaded board directory (replace the example path):

```sh
npm run init -- "/path/to/your-project"
npm run open -- "/path/to/your-project"
```

This creates only `.delivery-board/config.json`, `graph.json`, and `WORKFLOW.md` inside that project. Existing setup is never overwritten. The initial graph is intentionally empty: `init` does not scan your code or invent a roadmap.

Populate that graph from your agreed task records using the [schema and examples](docs/ADAPTER-CONTRACT.md), or let your coding agent use the bundled [delivery-board skill](skills/delivery-board/SKILL.md). Review uncertain statuses and dependencies. Then validate:

```sh
node src/entry.js check "/path/to/your-project"
```

For a shorter optional command, run `npm link` once in the downloaded board directory. Then `delivery-board open "/path/to/your-project"` works from other directories. This is a local link, not an npm-registry installation.

## Keep it current

Agreed plan changes → update authoritative records → validate → the visible board refreshes automatically, five seconds after the previous read completes. Pause using the checkbox; manual Refresh is always available. Hidden tabs pause polling. Unchanged sources do not redraw the graph. Zoom, selection and exploration are retained on updates where the selected items still exist.

Try the fictional plan change while its board is open:

```sh
node scripts/evolve-demo.js examples/travel-demo
# Restore the original fictional state:
node scripts/evolve-demo.js examples/travel-demo --reset
```

This adds a recovery task, changes dependencies and moves current work. It is an actual saved-record update, not a prerecorded UI animation. The script refuses non-demo projects and custom-modified demo states.

**The board reflects the latest successfully read records, not everything said in chat.** The companion skill maintains those records as plans change; it is not a continuously running agent. Explicit adapter mappings must also be maintained. Failed reads retain the last valid graph with a visible stale warning.

## Read the graph

Blue: active. Green: complete. Purple: partial. Orange: awaiting acceptance. Red: blocked. White: pending. Gray: unknown. Selection has a dark double border. Group X/Y counts completed member tasks, not ordinal execution steps or overall delivery.

Technical/documentation verification can complete those task kinds. Product verification alone does not imply acceptance. Journey verification, acceptance and delivery remain separate from linked task counts. Scope without explicit records remains unknown.

Use the minimap and **Locate current**, expand groups, filter a journey, or drag the detail panel divider. Full overview is available without making tiny labels the default.

## Local by default

The viewer binds to loopback, reads only configured files and explicitly allowlisted evidence, and exposes no source-writing route. There are no model calls or telemetry in rendering/refresh. Git metadata and remote CI records are not proof of business completion. Installing dependencies requires network access; ordinary local viewing does not.

`init` writes setup files only; the optional demo-evolution script writes only fictional demo records. Decide whether to commit your `.delivery-board` records according to your project's privacy policy; they are not automatically Git-ignored.

## Skill, development and removal

Copy `skills/delivery-board` into your agent's skill directory if it supports SKILL.md. For Codex, the usual user directory is `$CODEX_HOME/skills` (default `~/.codex/skills`). Provide the downloaded board directory to the agent. The skill uses this tool; installing instructions alone does not install Node or the app.

```sh
npm test
npm run test:browser
node tests/evolution-browser.mjs
node tests/auto-refresh-browser.mjs
```

Browser checks require Chrome; set `CHROME_PATH` for its location. macOS is the verified desktop environment for this preview. Windows/Linux behavior needs independent acceptance before being advertised as tested.

To stop a detached viewer, use the PID printed by its launch in your system's process tools. Remove the downloaded tool directory after stopping it; remove only its `.delivery-board` directory if you also want to delete your saved board records. Undo an optional global link with `npm unlink -g delivery-board`. Remove the copied skill separately.

MIT licensed. See [dependency notices](THIRD-PARTY-NOTICES.md). This preview is prepared for GitHub distribution; no npm registry package or public demo URL is assumed.
