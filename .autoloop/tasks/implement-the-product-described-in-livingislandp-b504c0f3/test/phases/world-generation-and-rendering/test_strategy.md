# Test Strategy

- Task ID: implement-the-product-described-in-livingislandp-b504c0f3
- Pair: test
- Phase ID: world-generation-and-rendering
- Phase Directory Key: world-generation-and-rendering
- Phase Title: Seeded world generation and base rendering
- Scope: phase-local producer artifact
- Behavior-to-test coverage map:
  AC-1 deterministic generation:
  `src/world/terrain/terrain.test.ts` asserts deterministic terrain generation for a fixed seed.
  `src/world/generation/createInitialWorld.test.ts` asserts full starter world determinism for a fixed seed.
  AC-2 sampled-seed validity:
  `src/world/terrain/terrain.test.ts` checks ten representative seeds for 128x128 output and viable starter basin coverage.
  `src/world/generation/createInitialWorld.test.ts` checks those representative seeds for buildable district and utility footprints, valid seeded road tiles, starter tram presence, and tram edge references that resolve to real road edges.
  AC-3 immediate alive-on-load presentation plumbing:
  `src/ui/components/WorldViewport.test.tsx` verifies the viewport starts a continuous `requestAnimationFrame` loop, forwards the latest derived presentation after store changes, and disposes/cancels the loop on unmount.
- Preserved invariants checked:
  128x128 terrain size, deterministic seed-to-layout mapping, starter basin viability floor, starter occupancy markers matching seeded entities, and seeded transit referencing canonical road edges.
- Edge cases covered:
  Representative seeds whose transformed starter footprints require deterministic relocation, repeated animation-frame scheduling, and frame refresh after `newWorld` plus overlay changes.
- Failure paths covered:
  Invalid starter footprints fail buildable assertions, broken starter tram seeding fails edge-resolution assertions, and viewport cleanup regressions fail the cancel/dispose expectations.
- Flake-risk controls:
  Seed lists are fixed, renderer behavior is isolated behind a deterministic mock, and animation timing is stabilized by stubbing `requestAnimationFrame`/`cancelAnimationFrame` rather than relying on real browser frame timing.
- Known gaps:
  These tests do not snapshot or pixel-verify the Three.js scene itself; visual legibility remains covered indirectly through renderer-loop plumbing plus manual phase validation rather than image-based assertions.
