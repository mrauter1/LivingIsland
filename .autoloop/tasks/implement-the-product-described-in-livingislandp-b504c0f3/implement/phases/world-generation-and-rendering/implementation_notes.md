# Implementation Notes

- Task ID: implement-the-product-described-in-livingislandp-b504c0f3
- Pair: implement
- Phase ID: world-generation-and-rendering
- Phase Directory Key: world-generation-and-rendering
- Phase Title: Seeded world generation and base rendering
- Scope: phase-local producer artifact
- Files changed:
  `src/world/generation/createInitialWorld.ts`, `src/world/generation/createInitialWorld.test.ts`, `src/world/rendering/WorldRenderer.ts`, `src/ui/components/WorldViewport.tsx`, `src/world/terrain/terrain.test.ts`, `.autoloop/tasks/implement-the-product-described-in-livingislandp-b504c0f3/implement/phases/world-generation-and-rendering/implementation_notes.md`, `.autoloop/tasks/implement-the-product-described-in-livingislandp-b504c0f3/decisions.txt`
- Symbols touched:
  `createDistrict`, `rectIsBuildable`, `resolveStarterRect`, `createStarterDistricts`, `createStarterUtilities`, `createStarterTransit`, `WorldRenderer`, `WorldViewport`
- Checklist mapping:
  Milestone 2 / Seeded World Generation and Base Rendering: hardened deterministic terrain/start-layout validity, seeded a starter tram corridor, replaced the placeholder box scene with animated terrain/water/sky/cloud/lighting/actor rendering, and moved the viewport onto a continuous render loop so day-night and ambient motion read immediately on load.
- Assumptions:
  Starter districts and utilities may shift within the guaranteed basin when their transformed template would land on invalid terrain, because the PRD requires a viable starter world and deterministic placement matters more than preserving an invalid raw template coordinate.
- Preserved invariants:
  128x128 logical grid, deterministic seed-driven terrain/layout/weather tendency, simulation/render separation through derived presentation data, fixed starter basin contract, and no expansion into editing/tooling beyond phase scope.
- Intended behavior changes:
  Starter districts now honor their template footprint sizes instead of collapsing to 8x8. Starter world seeding now resolves invalid transformed footprints to the nearest deterministic buildable patch in the basin and includes a seeded tram corridor so the world reads as active immediately. The renderer now presents animated water, drifting clouds, day-night lighting, emissive district night lighting, ambient rain, and representative moving actors in a persistent Three.js scene.
- Known non-changes:
  No full camera interaction system, no final performance pass, no event-specific fire/blackout presentation beyond the rendering hooks already supported by presentation state, and no starter ferry route seeding yet.
- Expected side effects:
  Production build succeeds but still warns about a large bundled main chunk due to the current monolithic Three.js app bundle. The continuous render loop keeps the world visually alive but also raises the baseline GPU cost compared with the prior static scene.
- Validation performed:
  `npm run lint`, `npm run test`, `npm run build`
  Added deterministic world-layout coverage and expanded representative seed validation to ten seeds for starter-basin viability plus starter footprint correctness.
- Deduplication / centralization decisions:
  Centralized starter footprint validation/repositioning in `resolveStarterRect` so district and utility seeding share the same buildability rule, and kept representative motion fully inside `WorldRenderer` so simulation state stays data-only while ambient animation runs continuously between ticks.
