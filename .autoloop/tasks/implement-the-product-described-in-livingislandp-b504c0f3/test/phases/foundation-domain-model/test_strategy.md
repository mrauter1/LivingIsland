# Test Strategy

- Task ID: implement-the-product-described-in-livingislandp-b504c0f3
- Pair: test
- Phase ID: foundation-domain-model
- Phase Directory Key: foundation-domain-model
- Phase Title: Foundation and domain model
- Scope: phase-local producer artifact

## Behavior-to-Test Coverage Map

- AC-1 / bootable foundation shell:
  `src/app/App.test.tsx` covers shell rendering with the phase-required panels and catches the React 19 selector-loop regression surface at render time.
  `src/world/terrain/terrain.test.ts` covers deterministic starter-terrain generation, seed variation, and starter-basin viability so the default boot world remains buildable and stable.
- AC-2 / canonical editor-action coverage:
  `src/simulation/core/engine.test.ts` covers tram-stop creation, ferry-dock creation, valid tram/ferry assembly, invalid transit references, and dock placement rejection on non-coastline nodes.
- AC-2 / mutation safety on demolish:
  `src/simulation/core/engine.test.ts` covers district occupancy clearing, utility occupancy clearing, and road-edge demolish adjacency cleanup plus orphan-node pruning while preserving nodes still referenced by transit entities.
- AC-2 / road-graph contract stability:
  `src/simulation/core/engine.test.ts` covers connected-road node reuse and adjacency updates at shared intersections.
- AC-3 / simulation-render separation:
  `src/app/store/appStore.test.ts` covers deterministic world summarization and single-boundary ticking without importing renderer internals.
  Preserved indirectly by keeping terrain, store, and kernel tests scoped to data contracts rather than Three.js objects.

## Preserved Invariants Checked

- `WORLD_GRID_SIZE`, `GROWTH_CHECK_INTERVAL`, and `SIMULATION_UPDATE_ORDER` remain fixed.
- Save serialization/hydration preserves canonical world identity and district counts.
- World mutations flow through `simulationKernel.applyEditorAction`.
- `summarizeWorld` returns stable aggregate counts and zero-district satisfaction behavior for UI consumers without requiring direct selector allocation.
- Starter terrain stays deterministic for a fixed seed, varies across distinct seeds, and maintains a viable starter basin for representative foundation seeds.

## Edge Cases And Failure Paths

- Tram lines reject unknown stop or edge references.
- Ferry docks cannot be placed on non-coastline nodes.
- Ferry routes reject unknown dock IDs.
- Road-edge demolish drops unreferenced nodes but preserves nodes still referenced by transit entities.
- `summarizeWorld` returns `averageSatisfaction = 0` when a world snapshot has no districts.
- Starter terrain changes cannot silently collapse the guaranteed starter basin below the current viability threshold on representative seeds.

## Flake Risk And Stabilization

- Tests are deterministic and data-only except for the existing shell render smoke test: no network, no real renderer, and no browser automation.
- World state is built from explicit seeds or inline fixtures so ordering stays stable.
- Terrain coverage uses explicit representative seeds instead of randomized sampling to avoid nondeterministic failures while still protecting the seeded generator contract.

## Known Gaps

- Browser bootability beyond the current shell render smoke test and command-level build remains outside E2E scope for this phase.
- Placement-rule completeness beyond the currently implemented foundation contracts remains out of scope until later phases add the full validators.
