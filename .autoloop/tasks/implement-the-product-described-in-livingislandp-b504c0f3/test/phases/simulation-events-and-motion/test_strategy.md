# Test Strategy

- Task ID: implement-the-product-described-in-livingislandp-b504c0f3
- Pair: test
- Phase ID: simulation-events-and-motion
- Phase Directory Key: simulation-events-and-motion
- Phase Title: Simulation loop, events, and representative motion
- Scope: phase-local producer artifact

## Behavior-To-Test Coverage Map

- Fixed simulation order and cadence:
  covered in `src/simulation/core/engine.test.ts`
  via PRD constant assertions and the six-hour growth-check cadence regression.
- Save/schema compatibility for new runtime fields:
  covered in `src/simulation/core/engine.test.ts`
  via `p0-v2` serialization expectation and rejection of stale `p0-v1` payloads through `isSavePayload`.
- Utility/event trigger progression:
  covered in `src/simulation/core/engine.test.ts`
  via blackout trigger after sustained severe power deficit and traffic-collapse trigger after sustained severe congestion.
- Multi-tick sequencing at higher speeds:
  covered in `src/simulation/core/engine.test.ts`
  via a batched-versus-repeated timelapse regression that exercises blackout and traffic-collapse progression under `stepWorld(..., dtTicks > 1)`.
- Weather-conditioned ferry behavior:
  covered in `src/simulation/core/engine.test.ts`
  via clear-vs-storm ferry transport bonus and derived presentation ferry-efficiency assertions.
- Fire and traffic-collapse district efficiency effects:
  covered in `src/simulation/core/engine.test.ts`
  via fire driving district efficiency to `0` and traffic collapse reducing affected commercial/industrial efficiency.
- Event recovery and renderer-facing event flags:
  covered in `src/simulation/core/engine.test.ts`
  via blackout recovery expiry, resolved timeline entry, active-event cleanup, and cleared presentation blackout flags.
- Representative motion and live presentation updates:
  covered in `src/simulation/core/engine.test.ts` and `src/ui/components/WorldViewport.test.tsx`
  via actor-target scaling at timelapse speed, presentation exposure of actor counts, and the viewport frame-loop regression that re-renders the latest derived presentation every animation frame.
- Inspectable district outcomes:
  covered in `src/simulation/core/editing.test.ts`
  via inspector contract assertions for district selection and the new `Operational efficiency` field.
- Preserved editor/network invariants adjacent to this phase:
  kept under regression in `src/simulation/core/engine.test.ts` and `src/app/store/appStore.test.ts`
  for occupancy clearing, road-node adjacency reuse, transit entity creation, invalid transit rejection, and editor workflow continuity.

## Preserved Invariants Checked

- The PRD simulation update-order constant remains unchanged.
- Batched stepping with `dtTicks > 1` remains equivalent to repeating single-tick simulation updates with the same speed config.
- Multi-step simulation still preserves canonical save/hydrate behavior for the current schema.
- Existing road/tram/ferry editor mutations continue to reject invalid actions without mutating world state.
- Inspector derivation stays stable for selected districts while exposing the new efficiency metric.
- Renderer-facing presentation continues to mirror live actor-target counts and district blackout/fire state derived from simulation events.

## Edge Cases And Failure Paths

- Invalid old-version save payloads are rejected.
- Ferry bonuses are not asserted from standalone docks; the weather-penalty test uses an active route to match intended service behavior.
- Fire trigger coverage forces deterministic overload/storm conditions instead of relying on ambient random chance.
- Traffic-collapse coverage seeds the counter to the threshold edge so the test would fail if the trigger condition or recovery bookkeeping drifted.
- Blackout recovery coverage uses a pre-existing active event plus stable power to assert expiry and cleanup, rather than depending on random storm-driven recovery paths.
- Timelapse sequencing coverage compares full world state between batched and repeated stepping so runtime counters, timeline entries, and actor targets all stay locked to the mandated per-tick order.

## Flake Controls

- Tests are pure/data-driven and avoid timers, requestAnimationFrame dependence, or real renderer assertions.
- Weather/event cases use deterministic seeds and explicit world-state setup rather than probabilistic loops.
- Inspector coverage stays at the helper-contract layer instead of mounting broader UI trees.
- Motion coverage uses actor-target and viewport-contract assertions rather than pixel snapshots, keeping the suite deterministic and environment-stable.

## Known Gaps

- Visual fidelity of rain/fire/blackout rendering and ferry slowdown is still covered by build plus manual inspection, not pixel/assertion tests.
- Bundle-size/performance warnings remain out of scope for this phase’s automated coverage.
- End-to-end save/load behavior through IndexedDB is not expanded here; this phase locks schema acceptance/rejection at the save-schema/kernel boundary instead.
