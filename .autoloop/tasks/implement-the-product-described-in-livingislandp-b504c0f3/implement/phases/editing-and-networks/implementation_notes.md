# Implementation Notes

- Task ID: implement-the-product-described-in-livingislandp-b504c0f3
- Pair: implement
- Phase ID: editing-and-networks
- Phase Directory Key: editing-and-networks
- Phase Title: Editing modes and infrastructure networks
- Scope: phase-local producer artifact
- Files changed:
  `src/app/routes/ShellRoute.tsx`, `src/app/store/appStore.ts`, `src/app/store/appStore.test.ts`, `src/index.css`, `src/simulation/core/editing.ts`, `src/simulation/core/editing.test.ts`, `src/simulation/core/engine.ts`, `src/simulation/core/engine.test.ts`, `src/types/editor.ts`, `src/ui/components/WorldViewport.tsx`, `src/ui/components/WorldViewport.test.tsx`, `src/ui/panels/LeftBuildPanel.tsx`, `src/ui/panels/RightInspectorPanel.tsx`, `.autoloop/tasks/implement-the-product-described-in-livingislandp-b504c0f3/implement/phases/editing-and-networks/implementation_notes.md`, `.autoloop/tasks/implement-the-product-described-in-livingislandp-b504c0f3/decisions.txt`
- Symbols touched:
  `validateZonePlacement`, `validateRoadPlacement`, `planTramLine`, `resolveSelectionAtTile`, `deriveInspectorTarget`, `selectionToDemolishAction`, `trimTerminalDuplicateRoadPoints`, `AppStoreState`, `startZoneDrag`, `finishZoneDrag`, `handleWorldClick`, `focusSelectionAt`, `handleShortcut`, `WorldViewport`, `LeftBuildPanel`, `RightInspectorPanel`
- Checklist mapping:
  Milestone 3 / Editing And Build Systems: implemented centralized placement and connectivity validation for zone, road, tram, ferry, utility, select, focus, and demolish workflows; added editor-mode store state plus keyboard shortcuts; and wired viewport pointer handling, preview overlays, and inspector targeting around the shared contracts.
- Assumptions:
  Build tools use primary pointer input for placement and draft editing while inspect mode keeps the PRD's left-drag orbit behavior; right-drag or Shift-drag pan remains available in every mode. Double-click focuses the selected entity in inspect/build modes, while Enter finalizes road and tram drafts and Escape clears the active draft.
- Preserved invariants:
  Editor mutations still flow through canonical editor actions, road nodes/edges remain the source of truth for tram and ferry graph references, demolish removes one selected entity or segment at a time, and rendering still consumes derived world/editor state without importing mutation logic.
- Intended behavior changes:
  The app now exposes mode-specific editing workflows for all P0 build tools, camera/timelapse/HUD keyboard shortcuts, build previews with validation feedback, inspector content derived from a consistent selection contract, focus-camera behavior, and centralized rejection of invalid placements before kernel mutation. Roads now reject water crossings, tram creation requires connected road-edge paths between chosen road nodes, and ferry routes are created by picking coastline docks only. Inspect mode single-click selection now works alongside orbit controls, and road draft finalization now accepts the PRD's double-click finish gesture by trimming only a terminal duplicate endpoint.
- Known non-changes:
  No bridge implementation, no freeform ferry routing, no undo/redo, no fine-grained animation polish beyond phase-required overlays/focus behavior, and no event-hotspot clicking beyond the shared inspector contract support.
- Expected side effects:
  The viewport now renders an SVG interaction overlay on top of the Three.js scene for preview/highlight feedback. Production build still emits the existing large main chunk warning because the app remains a single client bundle.
- Validation performed:
  `npm run test`
  `npm run lint`
  `npm run build`
  Added regression coverage for central editing validators/inspector routing, store-level zone/shortcut workflows, terrain-aware road test fixtures, inspect-mode single-click selection, and duplicated-terminal-point road finalization.
- Deduplication / centralization decisions:
  Centralized editor validation, graph routing, hit-testing, and inspector derivation in `src/simulation/core/editing.ts` so UI/store code does not duplicate build rules. Kept transient draft state in the store so the panels and viewport share the same preview/status contract instead of maintaining separate local interaction models.
