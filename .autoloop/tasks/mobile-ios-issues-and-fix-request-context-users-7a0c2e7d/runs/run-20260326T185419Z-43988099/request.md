# Mobile / iOS Issues and Fix Request

## Context
Users reported critical usability issues on iOS Safari and phones:
1. Can select tools/entities but cannot apply build actions on map.
2. Cannot zoom on touch devices.
3. Island/viewport appears shifted to the side; expected centered map on phone.

## Findings (for implementation team)

### Issue 1 — iOS Safari build actions not applying from map
`WorldViewport` currently gates pointer handling with strict mouse-button checks (`event.button === 0`).
On touch/pen devices this can block primary interaction, preventing build actions from reaching `handleWorldClick`.

### Issue 2 — No zoom path on touch devices
Zoom is currently wired to wheel events only (`onWheel -> zoomCamera(deltaY)`).
At the same time, `.world-viewport.interactive { touch-action: none; }` suppresses native touch gestures (including pinch) without a full replacement.

### Issue 3 — Phone layout is desktop-locked causing off-center viewport
Global min width and desktop grid constraints force horizontal overflow on phones:
- `html, body, #root { min-width: 1280px; }`
- `.app-shell` desktop columns with large minimum widths
- no true phone/mobile breakpoint behavior
This makes map appear shifted/cropped rather than centered.

## Request to fix
Please implement and verify all of the following:

1. **Touch-primary interaction support**
   - Update pointer gating so touch/pen primary interactions work for build/placement actions.
   - Preserve right-click/shift mouse pan behavior for desktop.

2. **Touch zoom support**
   - Add pinch-to-zoom (or equivalent touch zoom controls) that call into existing camera zoom behavior.
   - Keep desktop wheel zoom.
   - Align `touch-action` policy with implemented gestures.

3. **Mobile responsive centering**
   - Add mobile breakpoints that remove desktop-only min-width constraints.
   - Ensure viewport is centered and usable on phone widths.
   - Reduce rigid viewport minimum sizing that causes clipping on short screens.

4. **Tests**
   - Add/adjust tests for touch interaction behavior (including build apply path and zoom path).
   - Run test suite and report results.

## Execution mode requested
Run in **autoloop** with pair flow:
- `plan`
- `implement`
- `test`

Do not stop early if execution appears temporarily stalled; allow completion.
