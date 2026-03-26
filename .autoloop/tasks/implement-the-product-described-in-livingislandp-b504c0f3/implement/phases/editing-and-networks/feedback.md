# Implement ↔ Code Reviewer Feedback

- Task ID: implement-the-product-described-in-livingislandp-b504c0f3
- Pair: implement
- Phase ID: editing-and-networks
- Phase Directory Key: editing-and-networks
- Phase Title: Editing modes and infrastructure networks
- Scope: phase-local authoritative verifier artifact

- IMP-001 [blocking] [src/ui/components/WorldViewport.tsx:308-315,378-401] Inspect-mode single-click selection is currently impossible. `onPointerDown` always classifies primary inspect input as `orbit`, and `onPointerUp` only dispatches `handleWorldClick` for `click` drags. Result: the PRD-required "clicking an entity selects it and opens an inspector panel" path never runs in inspect mode; users must double-click to select/focus instead. Minimal fix: keep inspect primary input in a click-or-orbit state and, when pointerup occurs without meaningful movement, route the tile through the centralized selection path before treating larger drags as orbit.

- IMP-002 [blocking] [src/app/store/appStore.ts:398-425,478-501; src/ui/components/WorldViewport.tsx:272-283] The PRD-supported road gesture "click to add bends, Enter or double-click to finish" is broken on the double-click path. Each click appends the current tile to `roadDraft`; double-clicking the finish node appends that same endpoint twice, then `finalizeActiveDraft` validates the duplicated path and rejects it as "Road bends must advance to a new intersection." Minimal fix: centralize road-draft finalization so the finish action trims a terminal duplicate or suppresses the extra append before validation, and cover that exact double-click workflow with a regression test.

- Review cycle 2: verified `IMP-001` and `IMP-002` fixed in the current implementation and corresponding regression coverage added. No remaining findings in scoped code review.
