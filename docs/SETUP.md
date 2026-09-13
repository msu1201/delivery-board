# Setup guide

[Documentation](README.md) · [中文说明](SETUP.zh-CN.md)

Want your agent to handle setup? Use the [README prompt](../README.md#try-it-with-your-agent). The steps below are for manual setup.

## Try it

Requires Node.js 22+ and npm. Run:

```sh
git clone https://github.com/msu1201/delivery-board.git
cd delivery-board
npm ci
npm run demo
```

For a ZIP download, choose **Code → Download ZIP**, extract it, then run `npm ci` and `npm run demo` in that folder.

- The browser opens automatically; the terminal prints the URL and viewer PID.
- Busy ports are left alone. Repeat the command to reuse the viewer.
- Use `--no-open` to print the URL without opening a browser.
- The viewer is a detached process, not an installed system service.

## Connect your project

Before populating the first formal graph, follow the [guided review](DISCOVERY.md): read the project, discuss gaps and confirm a concrete route. Keep an optional draft separate until agreement.

Run from the tool directory, replacing the example path:

```sh
npm run init -- "/path/to/your-project"
```

This creates three files inside your project's `.delivery-board` directory:

| File | Purpose |
| --- | --- |
| `config.json` | Source and access settings |
| `graph.json` | Empty task graph |
| `WORKFLOW.md` | Record maintenance instructions |

Existing setup is preserved. `init` does not scan code; ask your agent to follow the [Skill](../skills/delivery-board/SKILL.md), or fill the graph using the [data format](ADAPTER-CONTRACT.md).

Review uncertain statuses and dependencies, then validate and open:

```sh
node src/entry.js check "/path/to/your-project"
npm run open -- "/path/to/your-project"
```

Optional: run `npm link` in the tool directory to use `delivery-board open "/path/to/your-project"` from elsewhere. This creates a local command link.

## Review an existing project

| Available information | How the agent uses it |
| --- | --- |
| Roadmap, specifications, tasks and handoffs | Draft tasks, groups and scope |
| Local Git history | Establish what changed and when |
| Relevant, authorized issues, PRs and CI | Add supporting records |
| Code and tests, but incomplete history | Inventory current capabilities and propose today's baseline |

Ask about missing goals or priorities. Mark proposed phases as proposals and uncertain status as `unknown`. Record unresolved questions in setup notes and task records, then update them as facts become available.

Code shows an implementation exists; tests support only their tested scope. Neither proves human acceptance. Dependency arrows need evidence or an explicit planning decision. Groups do not automatically define chronological phases.

The first graph can be partial. Avoid guessed percentages or claims that all past tasks were recovered. See the [bootstrap procedure](../skills/delivery-board/references/bootstrap.md).

## Keep it current

Agree on the change, update the source records and adapter mappings, then validate. The board displays the latest successfully read records.

| Refresh behavior | What to expect |
| --- | --- |
| Visible page | Reads again five seconds after the previous read finishes |
| Hidden page | Pauses polling |
| Unchanged records | Keeps the existing graph |
| Changed records | Retains zoom and selections where the selected items still exist |
| Failed read | Keeps the last valid graph with a stale warning |

You can pause automatic refresh or click Refresh manually. Chat alone does not update records; the Skill is a workflow for your agent, not a continuously running agent.

### Try a plan change

With the fictional demo open, run:

```sh
node scripts/evolve-demo.js examples/travel-demo
```

A recovery task appears, dependencies change and current work moves. These changes come from saved demo records. The script refuses non-demo projects and custom-edited demo states.

Restore the demo:

```sh
node scripts/evolve-demo.js examples/travel-demo --reset
```

## Read the graph

🔵 Active · 🟢 Complete · 🟣 Partial · 🟠 Awaiting acceptance · 🔴 Blocked · ⚪ Pending · ◻ Unknown

- A dark double border marks selection. **4/7 means four completed member tasks out of seven**, not the fourth step or overall delivery.
- Technical/documentation tasks can complete through verification. Product tasks require acceptance.
- Journey verification, acceptance and delivery have separate records. Linked task counts cannot replace them; unrecorded scope stays unknown.
- Use the minimap, Locate current, group expansion and journey filters to navigate. Drag the details divider to widen the panel. Fit graph shows the full overview.

## Use the Skill

The application runs the board. The Skill tells an agent how to prepare and maintain its records.

| Use | Setup |
| --- | --- |
| First session | Ask the agent to read `skills/delivery-board/SKILL.md` in the checkout. No installation needed. |
| Repeated use | Optionally copy the whole `skills/delivery-board` folder to its supported skill directory. Tell it where the application lives. Discovery depends on the agent's settings. |
| Agent without Skill support | Keep referencing the file directly. |

Copying the Skill does not install the application or dependencies. It also does not start a background process or guarantee record maintenance in future sessions.

## Local files and privacy

- The viewer binds to loopback and reads configured files and allowlisted evidence. It has no source-writing route, model calls or telemetry.
- Git facts and recorded CI results do not prove business completion. The viewer does not query remote CI.
- Installation needs network access; ordinary viewing does not.
- `init` writes setup files; the evolution script writes fictional demo records only.
- Decide whether to commit `.delivery-board` records. They are not automatically Git-ignored.

## Test the installation

```sh
npm test
npm run test:browser
node tests/evolution-browser.mjs
node tests/auto-refresh-browser.mjs
```

Browser checks need Chrome; set `CHROME_PATH` if needed. This preview has been verified on macOS. Windows and Linux still need validation.

## Stop or remove it

1. Verify the launch PID still belongs to your viewer, then stop it using your system's process tools. See [launcher recovery](LAUNCHER.md).
2. Delete the tool directory to remove the application.
3. Keep or delete your project's `.delivery-board` records separately.
4. Remove any copied Skill. If you used `npm link`, undo it with `npm unlink -g delivery-board`.

[MIT license](../LICENSE) · [Dependency notices](../THIRD-PARTY-NOTICES.md). Distribution is through GitHub; there is no npm package or hosted demo.


Use the top-right Graph / Work records control to switch between dependencies and saved work history. Task links return to the graph. Missing history or timestamps stay explicitly unrecorded; ask your agent to maintain workLog each round.
