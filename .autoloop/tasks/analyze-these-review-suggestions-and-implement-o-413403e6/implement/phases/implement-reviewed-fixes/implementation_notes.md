# Implementation Notes

- Task ID: analyze-these-review-suggestions-and-implement-o-413403e6
- Pair: implement
- Phase ID: implement-reviewed-fixes
- Phase Directory Key: implement-reviewed-fixes
- Phase Title: Implement validated review suggestions with regression coverage
- Scope: phase-local producer artifact

## Files changed
- `.gitignore`
- `src/types/domain.ts`
- `src/world/generation/createInitialWorld.ts`
- `src/simulation/core/engine.ts`
- `src/simulation/core/engine.test.ts`
- `src/app/store/appStore.ts`
- `src/app/store/appStore.test.ts`
- `.autoloop/tasks/analyze-these-review-suggestions-and-implement-o-413403e6/decisions.txt`

## Symbols touched
- `SimulationRuntimeState.nextIds`
- `nextId`, `deriveNextIds`, `getOrCreateNextIds`, `updateClock`, `finalizeTimeline`, `hydrateSave`
- `applyBuildZone`, `applyPlaceUtility`, `applyBuildRoad`, `applyPlaceTramStop`, `applyBuildTram`, `applyPlaceFerryDock`, `applyBuildFerry`, `updateEventState`
- `findCreatedEntityId`

## Checklist mapping
- ID allocation fix for all kernel `nextId` consumers: done in `engine.ts`
- Store create-selection fix using real created IDs: done in `appStore.ts`
- Clock offset preservation and rollover alignment: done in `engine.ts`
- `.gitignore` cleanup for stale Vite config outputs: done in `.gitignore`
- Regression coverage for kernel/store/runtime events/clock: done in `engine.test.ts` and `appStore.test.ts`
- Document deferred `handleWorldClick` refactor: done below

## Intended behavior changes
- Kernel-created district, utility, road node, road edge, tram stop, tram line, ferry dock, ferry route, and runtime event IDs now advance monotonically across deletes, expiries, and cold save/load boundaries instead of deriving from current array length.
- Store selection after successful create flows now resolves the entity that was actually added to the post-action world.
- Simulation clock advances from the seeded `Day 1 08:00` start, and daily timeline entries fire when the displayed clock reaches midnight.

## Preserved invariants
- Public kernel/store interfaces are unchanged, and older saves hydrate by deriving missing next-ID counters from live IDs.
- `WorldState.clock.tick` remains monotonic and remains the tick source for simulation sequencing.
- Existing starter IDs and hydrated live IDs remain valid; new IDs continue from the persisted per-prefix counter or, for older saves, the highest live suffix at hydrate time.

## Assumptions
- Stale `.gitignore` entries for `vite.config.js` and `vite.config.d.ts` are safe to remove because the repo builds with `tsc --noEmit` and only tracks `vite.config.ts`.
- The explicit YES clarification authorizes the minimal backward-compatible persisted runtime field needed to satisfy AC-1 across cold loads.

## Known non-changes
- No broad `handleWorldClick` decomposition was applied. Only the small `findCreatedEntityId` helper was added to support the accepted selection fix with low risk.
- No save version bump or stricter save-validator change was introduced; the added runtime field is backward-compatible and defaults during hydrate for older payloads.

## Expected side effects
- IDs may skip deleted suffixes instead of filling gaps.
- Saved worlds now persist next-ID counters, so reloading a world preserves non-reusing suffixes for later creates.

## Validation performed
- `npm test -- src/simulation/core/engine.test.ts src/app/store/appStore.test.ts`
- `npm test`

## Rejected or deferred review suggestions
- Broad `handleWorldClick` refactor: deferred. The requested fixes only needed one focused helper for post-action selection. Wider extraction would increase risk in a central interaction path without improving correctness for this task.
