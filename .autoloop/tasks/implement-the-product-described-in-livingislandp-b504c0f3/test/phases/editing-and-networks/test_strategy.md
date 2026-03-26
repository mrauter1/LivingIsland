# Test Strategy

- Task ID: implement-the-product-described-in-livingislandp-b504c0f3
- Pair: test
- Phase ID: editing-and-networks
- Phase Directory Key: editing-and-networks
- Phase Title: Editing modes and infrastructure networks
- Scope: phase-local producer artifact
- Behaviors covered:
  AC-1 zone placement accepts valid 4x4+ rectangles and rejects undersized footprints through the store workflow.
  AC-1 road placement rejects water crossings in shared validators, reuses graph nodes in the kernel, and accepts the PRD double-click finish gesture through store and viewport regressions.
  AC-1 tram planning validates connected road-edge paths and rejects invalid transit actions in the kernel.
  AC-1 ferry dock and route creation accept valid coastline-node flows and reject invalid dock/route actions in the kernel.
  AC-2 inspect-mode single-click selection routes into the shared inspector contract, and focused viewport regression covers the click-selection path directly.
  AC-3 demolish clears district and utility occupancy in the kernel, preserves protected road nodes on road-edge demolish, and removes one selected district through the store demolish workflow.
- Preserved invariants checked:
  Fixed PRD constants and update order remain locked.
  Editor actions continue to mutate canonical world state deterministically for a fixed seed.
  Road/tram/ferry graph invariants remain intact after placement and demolish operations.
- Edge cases and failure paths:
  Water-crossing roads fail validation.
  Duplicate-terminal road drafts still finalize correctly without weakening interior-duplicate validation semantics.
  Missing tram stops/edges and invalid ferry dock/route inputs do not mutate world state.
  Inspect-mode pointer clicks do not depend on renderer internals or animation timing.
- Flake controls:
  Viewport tests mock `requestAnimationFrame`, renderer lifecycle, and `getBoundingClientRect`.
  The focused road viewport test flattens terrain/buildability to avoid seed-specific projection or land/water variance.
- Known gaps:
  No end-to-end viewport regression yet for ferry route creation, tram stop placement, or utility placement.
  Event-hotspot selection remains covered only at the shared inspector helper layer because full event interaction is out of phase scope.
