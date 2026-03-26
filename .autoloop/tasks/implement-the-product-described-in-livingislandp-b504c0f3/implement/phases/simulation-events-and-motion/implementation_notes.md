# Implementation Notes

- Task ID: implement-the-product-described-in-livingislandp-b504c0f3
- Pair: implement
- Phase ID: simulation-events-and-motion
- Phase Directory Key: simulation-events-and-motion
- Phase Title: Simulation loop, events, and representative motion
- Scope: phase-local producer artifact

## Files Changed

- `src/types/domain.ts`
- `src/types/save.ts`
- `src/simulation/core/constants.ts`
- `src/simulation/core/contracts.ts`
- `src/simulation/core/engine.ts`
- `src/simulation/core/engine.test.ts`
- `src/simulation/core/editing.ts`
- `src/world/generation/createInitialWorld.ts`
- `src/world/rendering/WorldRenderer.ts`
- `src/ui/panels/RightInspectorPanel.tsx`
- `src/debug/DebugPanel.tsx`
- `.autoloop/tasks/implement-the-product-described-in-livingislandp-b504c0f3/decisions.txt`

## Symbols Touched

- `SimulationRuntimeState`, `TrafficState.highTrafficAverageCongestion`
- `District.operationalEfficiency`
- `SAVE_SCHEMA_VERSION`
- `PresentationDistrict.activity`, `PresentationDistrict.efficiency`, `PresentationDistrict.onFire`
- `PresentationState.averageCongestion`, `PresentationState.ferryEfficiency`
- `simulationKernel.stepWorld`, `simulationKernel.derivePresentation`
- tick-stage helpers in `src/simulation/core/engine.ts`:
  `updateEventState`, `recalculateDistrictDemands`, `computeTransportLoads`,
  `computeServiceCoverage`, `computeAttractivenessAndSatisfaction`,
  `applyEventPenalties`, `applyUtilityDeficits`, `updateGrowthDecline`,
  `updateActorTargets`, `finalizeTimeline`
- `deriveInspectorTarget`
- `WorldRenderer` district/fire/traffic presentation paths

## Checklist Mapping

- Plan milestone 4 / fixed tick loop and ordered pipeline: completed in `src/simulation/core/engine.ts`
- Plan milestone 4 / district demand, utility deficit, service, transport, and growth formulas: completed in `src/simulation/core/engine.ts`
- Plan milestone 4 / weather states, storm-blackout-traffic-fire events, and timeline entries: completed in `src/simulation/core/engine.ts`
- Plan milestone 4 / representative actor and weather/fire/blackout presentation: completed in `src/world/rendering/WorldRenderer.ts` and `simulationKernel.derivePresentation`
- Plan milestone 4 / deterministic regression coverage: completed in `src/simulation/core/engine.test.ts`

## Assumptions

- Blackout trigger and congestion-collapse trigger counters persist in canonical world state because save payloads must preserve active simulation progression, not just visible world objects.
- Storm pressure is represented as both weather effects and an explicit active `storm` event so the timeline and event inspector stay aligned with the PRD.
- Fire remains P0 single-district only; at most one new fire is spawned per simulation tick.
- Active ferry service is route-backed, not dock-backed, so districts only gain ferry bonuses from docks participating in an actual route.

## Preserved Invariants

- Simulation remains pure/data-driven; rendering still consumes only derived presentation data.
- Editor/build mutation paths and existing placement validation contracts were preserved.
- The PRD update order constant remains the source of truth and the engine executes it per tick even when `dtTicks > 1`.

## Intended Behavior Changes

- Utility deficits, congestion, weather, and service coverage now materially change district satisfaction, growth score, actor density, and event triggers.
- Storm, blackout, traffic collapse, and fire events now create timeline entries and district-level visible/inspectable consequences.
- Representative traffic slows visually under congestion, ferry motion slows under rain/storm efficiency loss, and burning districts render animated fire/smoke while blackout districts lose emissive lighting.
- Fire now drives district operational efficiency to `0`, and traffic collapse reduces affected commercial/industrial districts to partial efficiency that is inspectable in the district inspector/debug panel.

## Known Non-Changes

- No P1 spatial weather fronts, citizen-level path simulation, or replay/history systems were added.
- Old pre-phase saves are intentionally invalidated by the schema bump instead of being migrated.
- Overlay rendering polish was not expanded in this phase beyond keeping the derived simulation metrics inspectable.

## Expected Side Effects

- Save payloads now include runtime event counters and the extended traffic state.
- Existing `p0-v1` local saves no longer load because this pass intentionally invalidates them with `p0-v2`.
- Bottom-timeline activity increases because event starts/resolutions and daily summaries now emit entries.
- Build output still reports the existing large client chunk warning.

## Validation Performed

- `npm run test`
- `npm run lint`
- `npm run build`

## Deduplication / Centralization Decisions

- Centralized all simulation stage math inside `src/simulation/core/engine.ts` instead of duplicating formulas in store/UI code.
- Reused derived presentation flags for fire/blackout visibility so renderer-only effects do not leak simulation-specific branching into React panels.
- Reused one district-level `operationalEfficiency` contract for both fire and traffic-collapse outcomes instead of scattering separate ad hoc penalties across inspector, renderer, and demand logic.
