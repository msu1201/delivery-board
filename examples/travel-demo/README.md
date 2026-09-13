# Wayfarer · Fictional travel planner

An entirely invented bilingual public demo: 18 tasks in five groups, three
independent journey records, one active task and explicit fictional evidence.
Technical verification, product verification, human acceptance and delivery are
represented separately. The accepted packing journey still awaits integration.

From the delivery-board package directory:

```sh
node src/cli.js --config examples/travel-demo/config.json --check
node src/cli.js --config examples/travel-demo/config.json
```

## Repeatable source evolution

Keep the board open, then run these commands from another terminal:

```sh
node scripts/evolve-demo.js examples/travel-demo
node scripts/evolve-demo.js examples/travel-demo --reset
```

The after state adds DRAFT-RECOVERY, adds its dependency to REORDER, moves active
work from DAY-PLAN to REORDER and updates the planning journey. The board's normal
source refresh detects the replacement. `--reset` restores the packaged before
state. Both operations are repeatable and atomically replace only `graph.json`.

To preserve the original fixture, copy this whole directory to a temporary demo
directory and pass that directory to both the CLI and evolution script. The script
refuses symbolic-link directories/files, non-demo configurations, other project
IDs and graphs that differ from either packaged state. It never changes the
packaged before/after snapshots or launches a service.

All evidence is in `demo-evidence.md`; no external evidence or Git repository is
required. Nothing in this example reports a real travel product's delivery.
