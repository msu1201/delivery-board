# Wayfarer — fictional demonstration evidence

This entire project is invented for a delivery-board demonstration. All tasks,
reviewers, outcomes, verification states, version identifiers and blockers are
fictional. No real application tests, product acceptance or delivery are claimed.
No real customer data, credentials, external services or bookings are involved.

## Before / 初始状态

- TRIP-BRIEF and SEARCH are accepted in the fictional record.
- PLACE-DATA, TRIP-MODEL, OFFLINE-CACHE and DEPARTURE-GUIDE have fictional local verification.
- SHORTLIST and OFFLINE-READ have product verification only; human acceptance remains pending.
- DAY-PLAN is the sole active task. REORDER and TRAVEL-TIME depend on it.
- ROUTE-API waits for an invented missing route fixture. PRIVACY-REVIEW waits for an invented reviewer.
- The independent packing journey has fictional local verification and acceptance, but delivery remains pending integration.
- Planning and sharing journeys have not been accepted or delivered.

## After / 演进状态

- DAY-PLAN becomes accepted in this fictional record; REORDER becomes the sole active task.
- DRAFT-RECOVERY is added, with TRIP-MODEL as its prerequisite.
- REORDER gains DRAFT-RECOVERY as a dependency. This intentionally makes the active task's unmet prerequisite visible.
- J-PLAN includes the recovery task, an additional acceptance criterion and an updated note.
- No journey changes to delivered. These are example source edits, not real verification results.

The identifier `fictional-demo-before-v1` is an invented fixture version, not a Git commit.
