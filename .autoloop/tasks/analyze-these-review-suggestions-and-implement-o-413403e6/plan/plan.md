# Implementation Plan

## Scope
- Validate and implement only review suggestions that are correct in this codebase.
- Keep changes local to the simulation kernel, app store selection plumbing, targeted tests, and `.gitignore` if the ignored Vite outputs are truly unused.
- Document rejected or deferred review suggestions with rationale so later phases do not reopen them by drift.

## Findings
- Accepted: `src/simulation/core/engine.ts` allocates new entity IDs from array lengths. After deletions, this can recreate an existing suffix and misidentify later entities.
- Accepted: `updateClock` recomputes `day/hour/minute` from `tick` origin, which resets the seeded `Day 1 08:00` world start to midnight-based progression after the first tick.
- Likely accepted: `.gitignore` ignores `vite.config.js` and `vite.config.d.ts`, but the repo only contains `vite.config.ts`, and search found no generated counterparts referenced or committed.
- Rejected unless implementation friction proves otherwise: broad `handleWorldClick` refactor. The method is large, but current requested fixes do not require structural change, and broad extraction would add regression risk in a central interaction path. A tiny helper is acceptable only if it directly supports the ID-selection fix and reduces duplicated post-action selection logic.

## Implementation
### Milestone
- Ship one cohesive patch covering accepted fixes, any necessary store wiring, and regression tests.

### Code changes
- In `src/simulation/core/engine.ts`, replace count-based ID generation with a monotonic helper derived from the maximum numeric suffix already present for a given prefix. Apply it to every `nextId(...)` consumer, including editor-created entities, road nodes, and runtime-created events, so deletion or expiry cannot cause suffix reuse.
- In `src/app/store/appStore.ts`, stop predicting newly created entity IDs from `length + 1`. After each successful editor action that creates an entity, resolve the actual created ID from the updated world state before setting selection.
- In `src/simulation/core/engine.ts`, update clock advancement to preserve the initial `Day 1 08:00` offset while continuing to advance `tick` monotonically. Keep timeline/day rollover behavior aligned with the displayed clock.
- Remove `vite.config.js` and `vite.config.d.ts` from `.gitignore` only if no local build or TypeScript workflow in this repo emits or relies on those files.

### Interfaces and invariants
- No public type or API shape changes are planned.
- `WorldState.clock.tick` remains the monotonic simulation source of truth.
- Displayed time must advance from initial world state `Day 1 08:00`, not from `Day 1 00:00`.
- Entity IDs remain string-prefixed (`district-`, `utility-`, `road-edge-`, `road-node-`, `tram-stop-`, `tram-line-`, `ferry-dock-`, `ferry-route-`, `event-`) and must never reuse an existing suffix still present in state.
- Store selection after create actions must point at the real created entity, including after prior deletions.

## Validation
- Add kernel regression tests proving a deleted entity type does not cause suffix reuse for the next created entity, and that expired or removed runtime events do not cause later `event-*` IDs to reuse a prior suffix.
- Add store-level regression tests proving selection targets the actual created district/utility/road/transit entity after prior deletions.
- Add a clock regression test proving the first tick advances from `Day 1 08:00` to `Day 1 08:15` and day rollover still occurs after the correct number of ticks.
- Run targeted and then full relevant test suites (`vitest`) for simulation and store coverage.

## Compatibility
- Save schema should remain unchanged.
- Existing seeded starter IDs remain valid; the new helper must continue numbering from the highest existing suffix so generated starter content and hydrated saves stay compatible.
- `.gitignore` cleanup is safe only if no generated JS or declaration artifact for Vite config is expected in developer workflow.

## Regression Risks
- Store selection can silently drift if any create flow still assumes `length + 1`.
- Clock-day timeline entries could shift if day rollover logic is not checked against the preserved offset.
- Max-suffix parsing must ignore unrelated IDs and handle mixed starter/manual/runtime content without renumbering existing entities.

## Rollback
- Revert the ID helper and store selection changes together if create flows become inconsistent.
- Revert the clock adjustment independently if timeline/day progression regresses.
- Restore `.gitignore` entries if local tooling is later shown to emit those files.
