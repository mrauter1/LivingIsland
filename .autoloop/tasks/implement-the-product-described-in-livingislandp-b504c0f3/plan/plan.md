# Living Island P0 Implementation Plan

## Scope And Guardrails

- Implement the PRD's P0 only for a browser-native desktop-first app using TypeScript, React, Vite, Three.js, Zustand, IndexedDB, and plain CSS/CSS modules.
- Treat the repository as greenfield: create the app scaffold and all product code under the PRD structure, without backend services, third-party APIs, economy/progression systems, or P1/P2 features.
- Preserve the fixed contracts from the PRD: 128x128 logical tile grid, deterministic seeded generation, fixed interaction modes, fixed simulation tick/update order, aggregate traffic simulation, representative actors only, autosave plus 3 manual slots, and local-only persistence.

## Milestones

### 1. Foundation And Domain Model

- Create Vite/React/TypeScript app shell and repo structure under `src/app`, `src/ui`, `src/world`, `src/simulation`, `src/persistence`, `src/debug`, `src/types`, and `src/assets`.
- Define canonical domain types for terrain, districts, utilities, roads, tram lines, ferry routes, events, overlays, camera state, save payloads, and editor actions.
- Build a single app store boundary that owns user mode, selected entity, world state, simulation speed, camera flags, overlay state, and persistence status.

### 2. Seeded World Generation And Base Rendering

- Implement deterministic island generation for the 128x128 tile grid using seeded noise, radial falloff, smoothing, terrain classification, and a guaranteed starter basin.
- Create stylized terrain/water/sky/cloud/day-night rendering with world lighting and emissive night lighting driven from derived simulation state rather than simulation objects.
- Seed a viable starting settlement, starter utilities, and starter network so the world is alive on first load.

### 3. Editing And Build Systems

- Implement orbit camera, inspect/build/demolish modes, keyboard shortcuts, and selection/inspector behavior exactly as specified.
- Implement grid-snapped rectangle zoning, road polyline placement over road graph intersections, road-aligned tram lines with stops, dock-to-dock ferry routing, fixed-footprint utility placement, and targeted demolish actions.
- Enforce build validation from terrain, occupancy, network, coastline, and minimum/maximum footprint rules before mutating state.

### 4. Simulation, Events, And Motion

- Implement the fixed 0.5-second tick loop, time controls, growth-check cadence, and the PRD's ordered simulation update pipeline.
- Implement district demand formulas, utility supply/deficit rules, service coverage, aggregate transport load/congestion, district satisfaction/attractiveness, growth/decline, and freeze conditions.
- Implement weather states, event triggers/durations/effects, timeline entries, and representative actor targets for cars, trams, ferries, clouds, rain, fire, and blackout presentation.

### 5. UI, Overlays, Persistence, And Debug

- Implement desktop layout with top bar, left build panel, right inspector/stats panel, bottom event timeline, HUD hide/photo mode, cinematic mode, timelapse indicator, and polished overlays for traffic/power/water/satisfaction.
- Implement IndexedDB save layer with autosave plus 3 named manual save slots, deterministic reload of world/simulation state, and lightweight local preferences.
- Implement development-only debug panel exposing the PRD-required diagnostics without coupling simulation code to rendering internals.

### 6. Integration, Tuning, And Verification

- Tune visuals and actor density to keep the world visibly alive while meeting the PRD performance target on desktop-class hardware.
- Validate determinism, save/load reliability, placement rules, event visibility, overlay readability, and cross-browser behavior on latest Chrome first, then Safari/Firefox smoke coverage.
- Tighten rough edges rather than expanding features: preserve the vertical slice and defer any P1/P2 temptation.

## Interfaces And Module Boundaries

### Simulation Core

- `createInitialWorld(seed: string): WorldState`
- `stepWorld(state: WorldState, dtTicks: number, config: SimConfig): WorldState`
- `applyEditorAction(state: WorldState, action: EditorAction): WorldState`
- `derivePresentation(state: WorldState): PresentationState`
- `serializeSave(state: WorldState, meta: SaveMeta): SavePayload`
- `hydrateSave(payload: SavePayload): WorldState`

Constraints:
- Simulation modules remain pure/data-driven and never import Three.js or React components.
- Rendering consumes `PresentationState` and selection/overlay inputs only.
- Editor actions are the only mutation entry points outside simulation ticking and persistence hydration.

### State And Persistence

- Single Zustand store orchestrates app/session state and holds the current `WorldState`.
- Save payload schema is versioned only for identification, not migration; incompatible future changes should invalidate old P0 saves instead of silently migrating them.
- Autosave runs on a throttled interval and on critical transitions like explicit load/new-world.

### Rendering And UI

- World renderer owns scene composition, materials, particles, and representative actor animation.
- UI panels consume derived selectors and never compute simulation formulas independently.
- Overlays use shared derived metrics to avoid drift between inspector values and rendered heat/coverage states.

## Compatibility And Operational Notes

- Primary support target is latest Chrome at desktop viewport `1280x800`; Safari and Firefox receive smoke-tested compatibility fixes where platform APIs differ.
- Mobile is view-only best effort; full editing parity is out of scope for P0.
- No network, backend, auth, SSR, or external content dependencies are introduced.
- Save compatibility is strictly local to this MVP implementation; there is no migration requirement across future schema changes.

## Regression Prevention And Validation

- Lock the PRD's fixed behaviors behind central constants/tests: terrain size, district formulas, utility thresholds, weather durations, event triggers, growth cadence, and simulation update order.
- Keep build validation centralized so zone, road, tram, ferry, utility, and demolish actions cannot drift in occupancy/buildability rules.
- Add deterministic tests for world generation and repeatable simulation stepping for a fixed seed and scripted action sequence.
- Add targeted tests for utility deficit thresholds, event triggering/recovery, district growth/decline, and save/load round-tripping.
- Add manual verification passes for first-10-seconds visual legibility, photo mode HUD hiding, cinematic mode behavior, timelapse readability, and overlay clarity.

## Risk Register

| Risk | Why it matters | Control |
| --- | --- | --- |
| Performance collapse from combined rendering and simulation load | P0 requires a continuously alive world with weather, lights, and actors | Phase work keeps aggregate simulation simple, caps actor density, and treats derived presentation as cacheable selectors |
| Visual quality falling into debug-scene territory | PRD prioritizes polished presentation over raw system breadth | Establish stylized art direction early in rendering phase and tune before adding secondary niceties |
| Build interactions becoming inconsistent across tools | Multiple placement modes can easily diverge on validation and selection rules | Use shared editor action contracts and central placement validators |
| Simulation/render coupling causing technical debt | The PRD explicitly forbids simulation depending on render objects | Enforce data-only simulation interfaces and derived presentation boundary from the first phase |
| Persistence corruption or nondeterministic reloads | Save/load is core P0 functionality with no backend recovery path | Round-trip tests, explicit payload schema, and serialization from canonical world state only |

## Rollback Strategy

- If an individual subsystem destabilizes the slice, prefer disabling only that feature branch behind a local constant while keeping the world bootable and the core loop intact.
- If performance regresses, reduce actor density and non-essential particle counts before removing required P0 systems.
- If a save schema change breaks reliability during implementation, clear local saves and re-baseline the single P0 schema rather than introducing migration machinery.
