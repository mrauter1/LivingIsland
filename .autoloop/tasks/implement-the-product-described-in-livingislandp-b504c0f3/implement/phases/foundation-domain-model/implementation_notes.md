# Implementation Notes

- Task ID: implement-the-product-described-in-livingislandp-b504c0f3
- Pair: implement
- Phase ID: foundation-domain-model
- Phase Directory Key: foundation-domain-model
- Phase Title: Foundation and domain model
- Scope: phase-local producer artifact
- Files changed:
  `src/app/App.test.tsx`, `src/app/store/appStore.ts`, `src/debug/DebugPanel.tsx`, `src/ui/panels/BottomTimeline.tsx`, `src/ui/panels/RightInspectorPanel.tsx`, `src/world/terrain/terrain.ts`, `.autoloop/tasks/implement-the-product-described-in-livingislandp-b504c0f3/implement/phases/foundation-domain-model/implementation_notes.md`, `.autoloop/tasks/implement-the-product-described-in-livingislandp-b504c0f3/decisions.txt`
- Symbols touched:
  `summarizeWorld`, `BottomTimeline`, `RightInspectorPanel`, `DebugPanel`, `getHeightSample`
- Checklist mapping:
  Milestone 1 / Foundation and domain model: preserved the single Zustand store boundary while stabilizing shell subscriptions, kept the canonical world-generation contracts bootable under strict TypeScript checks, and repaired the phase validation harness so scaffold, contracts, and routing shell continue to pass lint/test/build.
- Assumptions:
  The newer terrain generator and starter-basin helpers already present in the worktree are intentional foundation-scope state for the repository, so this turn only repaired their type-safety and did not roll them back.
- Preserved invariants:
  128x128 logical grid, fixed simulation update order constants, P0-only entity set, single local save schema, no backend/auth/network integration, simulation/render separation by typed interface, and a single Zustand ownership boundary for app/session state.
- Intended behavior changes:
  Store-connected shell panels now derive summaries and timeline slices after subscribing to stable store branches, preventing React 19 render-loop failures without changing user-visible panel content. Starter terrain sampling now uses a bounded helper so the deterministic generator builds cleanly under strict array-index checks.
- Known non-changes:
  No changes to core editor-action contracts, no new simulation formulas, no complete placement validation, no final camera controls, and no cinematic/timelapse behavior beyond store flags and speeds.
- Expected side effects:
  Production build still emits a large main chunk warning because Three.js and the current shell bundle together; this remains non-blocking for the foundation phase and should be addressed during later rendering/performance tuning.
- Validation performed:
  `npm run lint`, `npm run test`, `npm run build`
  Verified the app-shell test no longer hits a React maximum-update-depth loop and that the stricter starter-terrain implementation compiles cleanly.
- Deduplication / centralization decisions:
  Reused the existing `summarizeWorld` store helper across shell/debug consumers instead of reintroducing duplicated summary logic, and centralized terrain array reads behind `getHeightSample` so generator call sites stay consistent.
