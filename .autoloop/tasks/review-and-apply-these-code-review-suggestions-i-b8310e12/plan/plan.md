# Review Suggestions Plan

## Scope
- Evaluate the four review suggestions against current code in `src/simulation/core/engine.ts`, `src/app/store/appStore.ts`, and `.gitignore`.
- Implement only the suggestions that are correct, with regression tests.
- Record rejected suggestions and rationale in plan artifacts so later turns do not widen scope.

## Applicability Assessment
- Suggestion 1 is correct. `nextId(prefix, currentCount)` in [engine.ts](/workspace/LivingIsland/src/simulation/core/engine.ts#L117) reuses IDs after deletions because several editor actions derive IDs from current array length.
- Suggestion 2 is correct. `updateClock` in [engine.ts](/workspace/LivingIsland/src/simulation/core/engine.ts#L1070) recomputes hour/minute from tick zero and discards the generated world’s initial Day 1 08:00 offset from [createInitialWorld.ts](/workspace/LivingIsland/src/world/generation/createInitialWorld.ts#L589).
- Suggestion 3 is correct. `.gitignore` currently ignores `vite.config.js` and `vite.config.d.ts`, but the repo only contains `vite.config.ts`; the ignored outputs are not present and the entries are stale/confusing.
- Suggestion 4 is not justified as a standalone change. `handleWorldClick` is large, but the current concern is maintainability, not a demonstrated correctness bug. A broad refactor would expand regression surface without clear payoff. Only local edits that are necessary for the accepted fixes are in scope.

## Implementation Plan
### Milestone
- Update engine-side ID generation to preserve the existing `prefix-<number>` format while choosing the next numeric suffix from the current max suffix plus one, not from collection length.
- Cover all engine-created entities that use `nextId`: districts, utilities, road nodes, road edges, tram stops, tram lines, ferry docks, ferry routes, and events.
- Update store selection logic that currently predicts new IDs from array length so post-build selection targets remain correct after deletions. Prefer selecting the actual created entity from the returned world state instead of duplicating ID-generation rules in the store.
- Preserve the initial clock offset when stepping the world. The first tick from a new world should advance from Day 1 08:00 to Day 1 08:15, and later day rollover behavior must remain consistent.
- Remove the stale `.gitignore` entries for `vite.config.js` and `vite.config.d.ts`.

## Interface And Compatibility Notes
- No save-schema change is planned.
- Entity IDs remain string IDs in the same `prefix-<number>` shape; the intentional behavior change is uniqueness after deletion, not a new identifier format.
- Store/UI code must not assume gapless IDs or derive future IDs from collection length once engine ID allocation becomes monotonic.
- Clock semantics stay quarter-hour per tick and day-based, but the initial generated offset becomes part of the invariant instead of being overwritten on first simulation step.

## Validation
- Extend [engine.test.ts](/workspace/LivingIsland/src/simulation/core/engine.test.ts) with regression coverage that deleting an entity and creating another of the same kind does not reuse an existing ID.
- Extend [engine.test.ts](/workspace/LivingIsland/src/simulation/core/engine.test.ts) with regression coverage for initial clock progression from Day 1 08:00 to Day 1 08:15 and for day rollover with the preserved offset.
- Extend [appStore.test.ts](/workspace/LivingIsland/src/app/store/appStore.test.ts) for any store selection path changed by the ID fix, especially cases where a build follows a deletion and the selected entity must match the created world entity.
- Run the focused Vitest suites covering simulation core and app store behavior.

## Regression Risks And Controls
| Risk | Why it matters | Control |
| --- | --- | --- |
| Partial ID fix | Engine IDs can become unique while store-selected IDs still point at nonexistent entities. | Update and test store selection paths in the same change. |
| Incorrect max-suffix parsing | Non-target IDs or malformed IDs could cause skipped or reused values. | Keep parsing local, prefix-scoped, and default to zero when no matching suffix exists. |
| Clock rollover drift | Preserving the initial offset could accidentally break `day`, `hour`, or `minute` transitions. | Add tests for first tick and a rollover boundary, and keep `tick` as the source for elapsed simulation time. |
| Unnecessary refactor churn | Restructuring `handleWorldClick` without a defect can introduce editor regressions. | Reject standalone refactor; allow only minimal edits required by the accepted fixes. |

## Rollback
- Revert the monotonic-ID helper and any dependent store selection changes together if created-entity selection proves unstable.
- Revert the clock-offset change together with its tests if it breaks established timing assumptions elsewhere.
- Restore the `.gitignore` lines only if a verified toolchain step in this repository starts generating those files again.
