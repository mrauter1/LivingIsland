# Implementation Notes

- Task ID: mobile-ios-issues-and-fix-request-context-users-7a0c2e7d
- Pair: implement
- Phase ID: fix-mobile-viewport-input-and-layout
- Phase Directory Key: fix-mobile-viewport-input-and-layout
- Phase Title: Fix touch interaction, touch zoom, and phone layout in the existing shell
- Scope: phase-local producer artifact

## Files changed
- `src/ui/components/WorldViewport.tsx`
- `src/ui/components/WorldViewport.test.tsx`
- `src/index.css`
- `tests/e2e/world-viewport.spec.ts`
- `vite.config.ts`
- `playwright.config.ts`

## Symbols touched
- `WorldViewport`
- `PointerDragState`
- `ActivePointerState`
- `PinchState`
- `normalizePointerType`
- `pointerDistance`
- `releaseCapturedPointer`
- `beginPinchGesture`
- `updatePinchGesture`

## Checklist mapping
- Viewport touch-primary input: `src/ui/components/WorldViewport.tsx`, `src/ui/components/WorldViewport.test.tsx`
- Pinch-to-zoom via existing camera zoom path: `src/ui/components/WorldViewport.tsx`, `src/ui/components/WorldViewport.test.tsx`
- Mobile centering / min-width removal / viewport sizing: `src/index.css`, `tests/e2e/world-viewport.spec.ts`
- Regression harness updates: `vite.config.ts`, `playwright.config.ts`

## Assumptions
- Existing `zoomCamera(deltaY)` store behavior remains the authoritative zoom mutation path.
- Chromium mobile emulation is used for automated layout regression coverage; iOS Safari parity still carries normal browser-engine risk.

## Preserved invariants
- Desktop wheel zoom remains unchanged.
- Desktop pan remains limited to secondary mouse and `Shift` + primary mouse.
- No app-store API, persistence, save-schema, or shell-structure changes were introduced.

## Intended behavior changes
- Primary touch and pen input can enter the existing click/build/select flow.
- Two-touch pinch zoom suppresses click/orbit/zone completion for participating pointers and reuses `zoomCamera(deltaY)`.
- Root and shell layout no longer force desktop-only minimum width on phone screens.

## Known non-changes
- No separate mobile UI path was added.
- No native browser pinch handling is relied on inside the interactive viewport.

## Expected side effects
- Narrow screens collapse the shell to a single-column layout with the viewport kept visible and centered.
- Vitest excludes Playwright specs to avoid treating e2e tests as jsdom unit tests.
- Playwright timeout was raised to reduce false negatives from the build + preview startup path in CI-like environments.

## Validation performed
- `npm test` -> passed (`8` files, `60` tests)
- `npm run test:e2e` -> passed (`7` Playwright tests)

## Deduplication / centralization decisions
- Pinch handling is localized inside `WorldViewport` and translates to the existing zoom action instead of introducing a parallel camera API.

## Files changed
- `src/ui/components/WorldViewport.tsx`
- `src/ui/components/WorldViewport.test.tsx`
- `src/index.css`
- `tests/e2e/world-viewport.spec.ts`
- `vite.config.ts`
- `playwright.config.ts`

## Symbols touched
- `WorldViewport`
- `normalizePointerType`
- `pointerDistance`
- `createOpenBuildWorld`

## Checklist mapping
- Viewport touch-primary support: `WorldViewport` pointer classification now accepts pen/touch primary input while keeping mouse-only pan branches.
- Pinch zoom path: local two-touch pinch tracking feeds `zoomCamera(deltaY)` and suppresses click/orbit/zone completion for pinch participants.
- Mobile responsive centering: root min-width removed; shell/viewport/legend receive shrink-safe widths and narrow-screen/short-height breakpoints.
- Regression coverage: viewport unit tests cover touch build, pen select, pinch zoom suppression, and desktop pan; Playwright adds a phone-width no-overflow/centered viewport check.
- Verification: `npm test` and `npm run test:e2e` completed successfully after installing Playwright browser/system deps in the workspace.

## Assumptions
- Restrictive `touch-action: none` remains correct because drag and pinch are now fully handled inside `WorldViewport`.
- The existing `zoomCamera(deltaY)` semantics are sufficient for pinch scaling without adding new store APIs.

## Preserved invariants
- Right-click pan and `Shift` + primary mouse pan stay desktop-only.
- Wheel zoom remains unchanged.
- Photo mode / HUD-hidden shell path remains on the existing layout structure.

## Intended behavior changes
- Primary touch and pen taps now reach the existing build/select flow.
- Two-touch pinch zoom works on touch devices and does not finish zone/click/orbit interactions.
- Phone-width layouts collapse to a single-column shell without forcing horizontal drift from root or viewport minimum widths.

## Known non-changes
- No mobile-only alternate UI was introduced.
- No app-store camera API, persistence schema, or simulation logic changed.

## Expected side effects
- Overlay legend becomes part of normal flow on narrow layouts so it no longer hangs off-screen.
- Playwright suite runtime is longer in this environment; timeout was raised to match observed execution time.

## Validation performed
- `npm test`
- `npm run test:e2e`

## Deduplication / centralization
- Pointer-type normalization and pinch-distance calculation were centralized inside `WorldViewport` instead of branching ad hoc through each handler.
