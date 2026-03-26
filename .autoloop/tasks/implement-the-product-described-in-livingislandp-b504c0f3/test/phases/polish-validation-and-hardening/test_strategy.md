# Test Strategy

- Task ID: implement-the-product-described-in-livingislandp-b504c0f3
- Pair: test
- Phase ID: polish-validation-and-hardening
- Phase Directory Key: polish-validation-and-hardening
- Phase Title: Polish, validation, and hardening
- Scope: phase-local producer artifact

## Behavior To Coverage Map

- Explicit seed generation UI:
  - Covered by `src/app/App.test.tsx`
  - Verifies the seed input is present and generating a world from the field updates canonical world seed state.
  - Edge case: local seed draft is overwritten when the canonical world changes externally, preventing stale input drift after load/new-world flows.

- Viewport interaction hardening:
  - Covered by `src/ui/components/WorldViewport.test.tsx`
  - Verifies pointer-capture cleanup on pointer cancellation, inspect-mode click selection, road-finalization via double-click, and overlay rendering from derived presentation data.
  - Failure path: cancelled drags release captured pointers cleanly instead of leaving interaction state stuck.

- Deterministic save/load continuation:
  - Covered by `src/simulation/core/engine.test.ts`
  - Verifies a scripted world state continues identically after serialize/hydrate and subsequent stepping.
  - Preserved invariant: save payload hydration does not perturb deterministic simulation outcomes.

## Preserved Invariants Checked

- Canonical world seed remains the single source of truth for the top-bar seed field.
- World viewport interaction cleanup remains deterministic under mocked pointer and resize primitives.
- Save/load does not change world progression for the same seed and scripted action sequence.

## Edge Cases / Failure Paths

- External world replacement after the user has typed a draft seed.
- Pointer cancellation while the viewport has pointer capture.
- Post-hydration simulation stepping after a representative scripted setup.

## Flake Risks / Stabilization

- UI tests use mocked renderer, fake timers, and stubbed `ResizeObserver`/`requestAnimationFrame` to avoid render-loop and layout timing flake.
- Determinism tests use fixed seeds, scripted editor actions, and pure kernel stepping instead of timer-driven app shells.

## Known Gaps

- Cross-browser smoke remains validated through manual/Playwright runtime checks documented by implementation, not through a committed browser-E2E test suite.
- The favicon addition is indirectly covered by smoke validation rather than a dedicated unit test, because the regression risk is missing-resource noise rather than app behavior logic.
