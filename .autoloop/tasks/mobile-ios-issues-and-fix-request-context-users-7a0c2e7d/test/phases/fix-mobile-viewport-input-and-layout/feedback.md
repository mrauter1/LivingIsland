# Test Author ↔ Test Auditor Feedback

- Task ID: mobile-ios-issues-and-fix-request-context-users-7a0c2e7d
- Pair: test
- Phase ID: fix-mobile-viewport-input-and-layout
- Phase Directory Key: fix-mobile-viewport-input-and-layout
- Phase Title: Fix touch interaction, touch zoom, and phone layout in the existing shell
- Scope: phase-local authoritative verifier artifact

## Test additions summary

- Added a desktop wheel-zoom regression test in `src/ui/components/WorldViewport.test.tsx` so preserved desktop camera behavior is checked alongside the new touch zoom path.
- Confirmed the viewport unit file passes after the addition: `npx vitest run src/ui/components/WorldViewport.test.tsx`.
- Added pinch-regression unit coverage for the two previously missing suppression paths in `src/ui/components/WorldViewport.test.tsx`: click-driven build completion and inspect selection/orbit completion.
- Added a short-screen Playwright regression in `tests/e2e/world-viewport.spec.ts` to exercise the `max-height` mobile sizing path and assert the viewport stays below desktop-sized clipping thresholds without horizontal overflow.
- Re-ran the full suites after the additions: `npm test` passed (`8` files, `63` tests) and `npm run test:e2e` passed (`8` Playwright tests).

## Audit findings

- `TST-001` `blocking`: The pinch regression coverage only proves zone-drag suppression. `src/ui/components/WorldViewport.test.tsx` has `uses pinch gestures to zoom without finishing a zone drag`, but there is no companion test for the other two suppression requirements recorded in `decisions.txt`: preventing accidental click completion and preventing inspect-orbit completion during a two-touch pinch. A future regression that lets pinch end by firing `handleWorldClick`, `focusSelectionAt`, or inspect release logic would still pass the current suite. Minimal correction: add pinch tests in inspect mode and in a click-capable mode that assert zoom happens while selection/placement/focus side effects do not.
- `TST-002` `blocking`: The mobile layout suite does not cover the short-screen breakpoint that this phase added specifically to reduce rigid viewport clipping. `tests/e2e/world-viewport.spec.ts` only checks a `390x844` viewport, while `src/index.css` now adds a separate `@media (max-height: 820px)` path. A regression that breaks phone-height or landscape-phone visibility could ship undetected because the current browser test never exercises that branch. Minimal correction: add a narrow, short-height Playwright case that asserts the viewport remains fully visible and the page avoids overflow/clipping under the `max-height` layout.

## Re-audit result

- Re-audit after the latest test additions found no remaining blocking or non-blocking gaps in the in-scope regression coverage.
- `TST-001` is addressed by the new pinch tests for click-driven build suppression and inspect selection/orbit suppression in `src/ui/components/WorldViewport.test.tsx`.
- `TST-002` is addressed by the new short-screen Playwright coverage in `tests/e2e/world-viewport.spec.ts`.
