# Test Strategy

- Task ID: implement-the-product-described-in-livingislandp-b504c0f3
- Pair: test
- Phase ID: ui-persistence-and-debug
- Phase Directory Key: ui-persistence-and-debug
- Phase Title: HUD, overlays, persistence, and debug tooling
- Scope: phase-local producer artifact

## Behavior-to-test coverage map

- AC-1 / desktop HUD visibility:
  - `src/app/App.test.tsx`
  - Covers baseline desktop shell render and photo-mode hiding of top bar, build panel, inspector, and overlay legend while preserving the world viewport mount.
- AC-2 / autosave and named manual slots:
  - `src/app/store/appStore.test.ts`
  - Covers manual save/load round-trip restoring world/event/camera state through the store boundary.
  - `src/persistence/storage.test.ts`
  - Covers the Vitest-only save backend contract, slot listing, clone-on-read behavior, and ensures save payloads do not spill into localStorage.
- AC-3 / overlay and debug canonical derivation:
  - `src/simulation/core/engine.test.ts`
  - Covers `PresentationDistrict.overlayMetrics` derivation from canonical district/traffic state.
  - `src/ui/components/WorldViewport.test.tsx`
  - Covers traffic and district overlay rendering from derived presentation data.

## Preserved invariants checked

- Save payload storage remains IndexedDB-only in production; localStorage is limited to preferences.
- Photo mode hides the HUD without unmounting the world viewport.
- Test-mode persistence returns cloned data so save/load assertions cannot pass via accidental shared references.

## Edge cases and failure paths

- Invalid or missing save preference JSON falls back to default manual slot labels in `src/persistence/storage.test.ts`.
- Overlay regression coverage includes both road-based (`traffic`) and district-based (`satisfaction`) paths.

## Stabilization approach

- Shell photo-mode coverage mutates canonical store state directly instead of depending on keyboard event timing.
- Persistence tests use the explicit Vitest in-memory backend and clear localStorage per test to avoid browser-environment flake.

## Known gaps

- No browser-level IndexedDB failure-path test is added; runtime failure handling continues to be covered indirectly through the store error paths and build/test validation.
