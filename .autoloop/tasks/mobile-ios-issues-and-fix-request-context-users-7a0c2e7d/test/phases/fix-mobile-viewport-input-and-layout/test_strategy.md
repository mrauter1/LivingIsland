# Test Strategy

- Task ID: mobile-ios-issues-and-fix-request-context-users-7a0c2e7d
- Pair: test
- Phase ID: fix-mobile-viewport-input-and-layout
- Phase Directory Key: fix-mobile-viewport-input-and-layout
- Phase Title: Fix touch interaction, touch zoom, and phone layout in the existing shell
- Scope: phase-local producer artifact

## Behavior-to-test coverage map

- AC-1 touch / pen apply path:
  - `src/ui/components/WorldViewport.test.tsx`
  - Covers touch utility placement and pen inspect selection.
- AC-1 preserved desktop pan affordances:
  - `src/ui/components/WorldViewport.test.tsx`
  - Covers `Shift` + primary mouse pan and secondary-button pan.
- AC-2 pinch zoom and interaction suppression:
  - `src/ui/components/WorldViewport.test.tsx`
  - Covers pinch-driven zoom plus suppression of zone completion, click-driven build completion, and inspect selection/orbit completion.
- AC-3 mobile centering / no horizontal overflow:
  - `tests/e2e/world-viewport.spec.ts`
  - Covers phone-width viewport visibility, centering, single-column shell collapse, and no horizontal overflow.
  - Covers the short-screen breakpoint path so viewport min-height no longer falls back to desktop-sized clipping.
- AC-4 preserved desktop wheel zoom:
  - `src/ui/components/WorldViewport.test.tsx`
  - Covers wheel-driven camera zoom remaining active after touch zoom additions.
- AC-4 preserved photo-mode / HUD-hidden shell path:
  - `src/app/App.test.tsx`
  - Covers viewport remaining mounted while HUD and overlay legend hide.

## Edge cases covered

- Pinch starts after an in-progress zone drag has already begun.
- Pinch starts after a click-capable touch press has already begun and must not place a build action on release.
- Pinch starts from inspect mode and must not select or orbit while zooming.
- Pointer-capture cleanup still runs on cancellation.
- Narrow and short-height layout assertions use browser geometry instead of jsdom layout heuristics.

## Failure paths covered

- Renderer bootstrap failure still leaves the shell usable.
- Renderer runtime failure still swaps to the fallback error surface.

## Stabilization approach

- Pointer and wheel regressions stay in Vitest for deterministic state assertions.
- CSS layout visibility/overflow stays in Playwright where real browser geometry is available.
- Mobile e2e uses direct DOM metrics (`scrollWidth`, bounding box center) rather than visual snapshots to reduce flake.

## Known gaps

- Automated coverage still runs in Chromium, not native iOS Safari / WebKit, so Safari-only gesture quirks remain an environment gap rather than a repo test gap.
