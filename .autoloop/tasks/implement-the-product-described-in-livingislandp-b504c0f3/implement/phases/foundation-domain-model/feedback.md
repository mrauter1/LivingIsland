# Implement ↔ Code Reviewer Feedback

- Task ID: implement-the-product-described-in-livingislandp-b504c0f3
- Pair: implement
- Phase ID: foundation-domain-model
- Phase Directory Key: foundation-domain-model
- Phase Title: Foundation and domain model
- Scope: phase-local authoritative verifier artifact

- IMP-001 | blocking | [src/types/editor.ts](/workspace/LivingIsland/src/types/editor.ts#L25) and [src/simulation/core/engine.ts](/workspace/LivingIsland/src/simulation/core/engine.ts#L145): The canonical editor-action surface does not cover all required P0 transit entities. `BuildTramAction` only references pre-existing stop node IDs but `applyBuildTram` never materializes `world.tramStops`, and `BuildFerryAction` assumes two existing dock node IDs even though there is no action that creates `world.ferryDocks`. That means the foundation contract cannot represent tram-stop placement or ferry-dock placement as first-class P0 actions, so AC-2 is not actually met. Minimal fix: add explicit dock/stop placement actions, or a single canonical action shape that materializes both entities, and update `applyEditorAction` to populate `tramStops` and `ferryDocks`.

- IMP-002 | blocking | [src/simulation/core/engine.ts](/workspace/LivingIsland/src/simulation/core/engine.ts#L172): `applyDemolish` removes districts and utilities from their arrays but never clears `terrain.tiles[*].districtId` or `terrain.tiles[*].utilityId`. After a demolish, the footprint remains permanently invalid because later placement checks still see those tiles as occupied. This is an unintended behavior regression in the core world-mutation path. Minimal fix: centralize occupancy writes/clears in shared helpers and invoke them from both placement and demolish actions.

- IMP-003 | blocking | [src/types/domain.ts](/workspace/LivingIsland/src/types/domain.ts#L147) and [src/simulation/core/engine.ts](/workspace/LivingIsland/src/simulation/core/engine.ts#L113): The road-graph mutation path writes structurally inconsistent graph state. `RoadNode` advertises `connectedEdgeIds`, but `applyBuildRoad` always creates fresh endpoint nodes, never reuses matching grid intersections, and never appends the new edge ID to either endpoint. Any future transport/pathfinding code that trusts the canonical graph will read empty adjacency and fail to traverse roads, which makes the supposed foundation contract unstable. Minimal fix: centralize road-edge insertion in one helper that snaps/reuses nodes by coordinate and updates adjacency lists whenever an edge is added.

- IMP-004 | non-blocking | Follow-up verification: the latest implementation resolves IMP-001 through IMP-003. The editor contracts now cover tram-stop and ferry-dock creation, demolish clears tile occupancy, and connected roads reuse nodes while maintaining adjacency. No additional phase-scope findings remain after re-review.

- IMP-005 | non-blocking | Reviewer verification reran the kernel-facing regression suite (`npm run test -- --run src/simulation/core/engine.test.ts`) against the current repository state. All six engine tests passed, including the new invalid-transit and dock-to-dock route coverage, and no new phase-scope issues were identified.

- IMP-006 | non-blocking | Reviewer verification reran the full foundation validation surface (`npm run test`, `npm run lint`, `npm run build`) against the current repository state after the shell-selector and terrain-typing fixes. The app-shell regression is resolved, strict TypeScript compilation passes, and no additional phase-scope findings were identified. The remaining Vite large-chunk warning is already documented as a later-phase tuning item rather than a foundation blocker.
