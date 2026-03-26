# Implement ↔ Code Reviewer Feedback

- Task ID: analyze-these-review-suggestions-and-implement-o-413403e6
- Pair: implement
- Phase ID: implement-reviewed-fixes
- Phase Directory Key: implement-reviewed-fixes
- Phase Title: Implement validated review suggestions with regression coverage
- Scope: phase-local authoritative verifier artifact

- IMP-001 | blocking | [src/simulation/core/engine.ts](/workspace/LivingIsland/src/simulation/core/engine.ts#L108) / `getOrCreateIdCounters`, `cloneWorld`, `serializeSave`, `hydrateSave`: the new monotonic ID strategy is only monotonic while the in-memory `WeakMap` survives. After a cold save/load, counters are rebuilt from the live arrays, so deleting the highest existing suffix in one session and then loading that save in a later session will reuse the deleted suffix on the next create. I reproduced this with the current code path: delete `district-5`, serialize to a plain payload, hydrate, create a new zone, and the new district becomes `district-5` again. That violates AC-1 for persisted worlds and leaves runtime-created event IDs with the same hole after reload. Minimal fix: persist per-prefix next-ID state with the saved world (or another persisted world field that survives cold load) and add a regression test covering delete -> save -> cold load -> create for at least one editor entity and one runtime event.
- IMP-001 | non-blocking | Follow-up review: resolved. The implementation now persists per-prefix `runtime.nextIds`, hydrates older saves by deriving missing counters from live IDs, and adds explicit cold-load regressions for deleted districts and expired runtime events. No remaining request-scoped findings.
