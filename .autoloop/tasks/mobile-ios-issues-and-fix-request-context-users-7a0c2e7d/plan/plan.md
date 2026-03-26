# Mobile / iOS Fix Plan

## Scope
- Fix `WorldViewport` so primary touch and pen interactions can drive the existing build/select click path instead of being blocked by mouse-only button checks.
- Add a touch zoom path that reuses the current camera zoom behavior and coexists with desktop wheel zoom.
- Remove desktop-only width/height constraints that currently push the shell off-center on phones, then add narrow-screen breakpoints that keep the viewport centered and usable.
- Add regression coverage for the new touch behavior and responsive/mobile shell path, then run the automated test suites already used by the repo.

## Milestones

### 1. Viewport Input And Gesture Handling
- Update `src/ui/components/WorldViewport.tsx` pointer classification so desktop pan remains limited to right-click and `Shift` + primary mouse, while primary touch/pen/mouse input is allowed to enter the existing inspect/build click flow.
- Preserve current single-pointer behaviors by mode: inspect can still orbit on drag, build-zone can still drag a zone rectangle, and tap/click still resolves through `handleWorldClick`.
- Add local pinch tracking inside `WorldViewport` for two active touch pointers. When a pinch is active, suspend any pending click/zone/orbit completion for those pointers and translate pinch distance changes into calls to the existing `zoomCamera(deltaY)` store action rather than widening the store API.
- Keep `touch-action` aligned with the implemented gestures. If the component fully handles drag and pinch, retaining a restrictive touch-action value is acceptable; if native gesture handling is relied on anywhere, relax only the minimum CSS needed.

### 2. Mobile Layout And Centering
- Update `src/index.css` to remove the global `min-width: 1280px` constraint from `html`, `body`, and `#root`.
- Add phone-width and short-height breakpoints for `.app-shell`, `.top-bar`, `.bottom-strip`, `.world-shell`, `.world-viewport`, and `.overlay-legend` so the desktop three-column shell collapses into a centered single-column/mobile-friendly layout instead of overflowing horizontally.
- Replace rigid desktop viewport minimums with breakpoint-aware values so short phone screens do not clip the map while desktop sizing remains intact.
- Preserve existing desktop layout density and photo-mode (`.app-shell.hud-hidden`) behavior after the breakpoint changes.

### 3. Regression Coverage And Verification
- Extend `src/ui/components/WorldViewport.test.tsx` with focused tests for:
  - touch/pen primary down/up reaching the existing build or selection path;
  - pinch gestures calling `zoomCamera` through the viewport without triggering unintended placement/selection completion;
  - desktop pan affordances remaining tied to secondary mouse or `Shift` + primary mouse.
- Add responsive/mobile shell coverage in the lightest existing test layer that can assert it reliably. Prefer Playwright mobile-viewport coverage in `tests/e2e` for narrow-screen overflow/viewport visibility, because jsdom is a poor fit for CSS layout validation.
- Run `npm test` and `npm run test:e2e` after implementation and report the results.

## Interfaces And Compatibility Notes
- Keep the existing store zoom contract (`zoomCamera(deltaY)`) as the camera mutation interface. Gesture code should normalize pinch movement into that existing input instead of introducing a parallel zoom API unless implementation proves that impossible.
- No routing, persistence, save-schema, or domain-model changes are in scope.
- Desktop behavior must stay intact: wheel zoom remains available, right-click pan remains available, and `Shift` + primary mouse pan remains available.
- Mobile support is expanded within the existing shell and viewport components; do not fork a separate mobile UI flow unless implementation uncovers a blocker that cannot be solved locally.

## Validation
- Unit-test viewport touch and gesture behavior in `src/ui/components/WorldViewport.test.tsx`.
- Add at least one Playwright narrow-screen/touch-enabled smoke that verifies the app renders without horizontal drift and the viewport stays visible on phone-like dimensions.
- Re-run the existing shell/viewport Playwright coverage to catch desktop regressions from the CSS changes.
- Report any gaps that automated Chromium-based testing cannot cover for iOS Safari specifically.

## Regression Risks And Controls
| Risk | Why it matters | Control |
| --- | --- | --- |
| Touch classification regresses desktop controls | Relaxing button checks can accidentally let secondary mouse input place or select entities. | Keep explicit mouse-vs-touch/pen gating and preserve right-click / `Shift` + primary mouse pan as separate branches with regression tests. |
| Pinch zoom causes accidental build/select actions | Two-finger gestures can look like tap or drag completion if existing click state is left active. | Give active pinch state precedence over single-pointer click/orbit/zone completion and cover that behavior in tests. |
| Pinch sensitivity bypasses camera limits or feels inverted | Reusing `zoomCamera(deltaY)` without normalization can produce unstable zoom steps. | Normalize pinch deltas locally and rely on the existing store clamp for distance bounds. |
| Mobile CSS fix regresses desktop shell layout | Removing global min-width can collapse desktop columns or photo mode unexpectedly. | Use explicit mobile breakpoints rather than weakening desktop grid rules globally, and re-run desktop shell tests/e2e. |
| Automated mobile checks miss Safari-specific quirks | Chromium mobile emulation will not perfectly match iOS Safari pointer/touch behavior. | Keep automated coverage in repo, then call out any residual Safari-only risk in implementation/test reporting. |

## Rollback
- Revert viewport gesture-state changes and the related tests together if touch/pinch handling destabilizes build interactions.
- Revert the mobile breakpoint block separately if layout changes introduce broader shell regressions, keeping the input fixes if they remain sound.
- Revert any Playwright mobile smoke additions only if they prove nondeterministic; do not drop the unit-level touch regression tests with them.
