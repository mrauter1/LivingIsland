# Implementation Notes

- Task ID: implement-the-product-described-in-livingislandp-b504c0f3
- Pair: implement
- Phase ID: ui-persistence-and-debug
- Phase Directory Key: ui-persistence-and-debug
- Phase Title: HUD, overlays, persistence, and debug tooling
- Scope: phase-local producer artifact

## Files changed

- `src/app/routes/ShellRoute.tsx`
- `src/app/store/appStore.ts`
- `src/persistence/storage.ts`
- `src/types/save.ts`
- `src/simulation/core/contracts.ts`
- `src/simulation/core/engine.ts`
- `src/ui/components/WorldViewport.tsx`
- `src/ui/panels/TopBar.tsx`
- `src/ui/panels/RightInspectorPanel.tsx`
- `src/ui/panels/BottomTimeline.tsx`
- `src/ui/overlays/OverlayLegend.tsx`
- `src/debug/DebugPanel.tsx`
- `src/index.css`
- `src/app/App.test.tsx`
- `src/app/store/appStore.test.ts`
- `src/ui/components/WorldViewport.test.tsx`
- `src/simulation/core/engine.test.ts`

## Symbols touched

- `useAppStore`, `deriveWorldVitals`, `deriveRecentAlerts`, `deriveSaveSlotEntries`
- `saveSlot`, `loadSlot`, `listSlots`, `loadSavePreferences`, `saveSavePreferences`
- `useTestSaveStore`
- `PresentationDistrict.overlayMetrics`, `simulationKernel.derivePresentation`
- `ShellRoute`, `WorldViewport`, `TopBar`, `RightInspectorPanel`, `BottomTimeline`, `OverlayLegend`, `DebugPanel`

## Checklist mapping

- Plan milestone 5 / desktop HUD: completed via rebuilt top bar, inspector summary, timeline/alerts strip, photo-mode HUD hiding, cinematic/timelapse indicators, and overlay legend.
- Plan milestone 5 / overlays: completed via presentation-backed district and traffic overlays rendered in the viewport from canonical simulation data.
- Plan milestone 5 / persistence: completed via autosave interval, slot refresh/load/save flows, 3 named manual slots, camera restore, and lightweight local preferences for slot labels.
- Plan milestone 5 / debug tooling: completed via development-only diagnostics panel with required world, utility, congestion, district, selection, and speed data.

## Assumptions

- A 15 second autosave interval is an acceptable P0 throttle for the fixed 0.5 second simulation loop.
- Named manual slots are satisfied by persistent per-slot labels rather than freeform save-file export/import.

## Preserved invariants

- Save payloads still serialize from canonical `WorldState` plus optional camera state only; no migration path was introduced.
- Simulation code remains UI-framework-free; viewport overlays consume `derivePresentation(...)` output instead of recomputing simulation formulas in React.
- Photo mode hides all product HUD panels and suppresses the dev debug panel.

## Intended behavior changes

- Desktop HUD now exposes save/load slot controls, citywide metrics, recent alerts, timelapse/cinematic indicators, and richer inspector/world summary content.
- Autosave now runs on a fixed interval after shell mount and slot metadata is refreshed into store state for the HUD.
- Manual save slots can be named, saved, and loaded from the HUD, while production save payloads remain IndexedDB-only.

## Known non-changes

- No mobile editing parity, save migration, or export/import support was added.
- No simulation formulas or event trigger thresholds were retuned in this phase.

## Expected side effects

- First shell mount performs an async save-slot refresh and starts the autosave interval.
- Tests use an isolated in-memory save backend instead of a second runtime browser storage source.
- Vite production build still emits a large-chunk warning for the monolithic bundle, but the build succeeds.

## Validation performed

- `npm test`
- `npm run build`

## Deduplication / centralization

- Centralized HUD/debug/alert summaries in store-level derivations instead of panel-local recomputation.
- Centralized overlay values in `PresentationDistrict.overlayMetrics` so viewport fills and legends read the same canonical presentation contract as the renderer.
