# Test Author ↔ Test Auditor Feedback

- Task ID: implement-the-product-described-in-livingislandp-b504c0f3
- Pair: test
- Phase ID: foundation-domain-model
- Phase Directory Key: foundation-domain-model
- Phase Title: Foundation and domain model
- Scope: phase-local authoritative verifier artifact

- Added deterministic kernel regressions in `src/simulation/core/engine.test.ts` for road-edge demolish cleanup, protected-node preservation, invalid transit references, and dock-to-dock ferry length. Updated `test_strategy.md` with an explicit AC-to-test coverage map, preserved invariants, failure paths, and known gaps.

- TST-001 | non-blocking | Audit verification: the current foundation-phase tests cover the material mutation-contract regressions in scope, including transit entity creation, invalid transit references, occupancy clearing, shared-road adjacency reuse, and road-edge demolish cleanup with protected-node preservation. `npm run test -- --run src/simulation/core/engine.test.ts src/app/store/appStore.test.ts` passed with 9/9 tests, and no additional blocking coverage gaps were identified.

- Added deterministic regressions in `src/world/terrain/terrain.test.ts` for seeded terrain determinism, cross-seed variation, and starter-basin viability, plus `src/app/store/appStore.test.ts` coverage for `summarizeWorld` aggregate behavior and the zero-district edge case. Updated `test_strategy.md` to map the new shell/store/terrain coverage back to AC-1 and AC-3 and to document the deterministic seeding strategy used to avoid flake.

- TST-002 | non-blocking | Audit verification reran the newly added regression surface directly: `npm run test -- --run src/app/store/appStore.test.ts src/world/terrain/terrain.test.ts` passed with 7/7 tests, and the existing shell smoke test `npm run test -- --run src/app/App.test.tsx` also passed. The added store and terrain coverage is deterministic, aligned with the latest shared decisions, and does not introduce new flake or scope drift.
