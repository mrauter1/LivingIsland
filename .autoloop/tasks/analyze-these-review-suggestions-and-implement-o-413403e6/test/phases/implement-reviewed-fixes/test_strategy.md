# Test Strategy

- Task ID: analyze-these-review-suggestions-and-implement-o-413403e6
- Pair: test
- Phase ID: implement-reviewed-fixes
- Phase Directory Key: implement-reviewed-fixes
- Phase Title: Implement validated review suggestions with regression coverage
- Scope: phase-local producer artifact

## Behavior-to-coverage map
- Kernel next-ID allocation after deletion: `src/simulation/core/engine.test.ts`
  Covers deleted district and deleted road/road-node rebuild paths.
- Runtime event next-ID allocation after expiry: `src/simulation/core/engine.test.ts`
  Covers same-session expiry/recreation and cold-load persistence.
- Backward-compatible hydrate fallback for older saves without `runtime.nextIds`: `src/simulation/core/engine.test.ts`
  Covers deriving live suffix defaults from a stripped serialized payload.
- App-store selection after create actions: `src/app/store/appStore.test.ts`
  Covers district, utility, road, tram line, ferry route, and save/load round-trip state preservation.
- Clock offset and rollover: `src/simulation/core/engine.test.ts`
  Covers first tick from `Day 1 08:00` and midnight day rollover/timeline entry.
- `.gitignore` cleanup safety: indirect repo validation via full `npm test`
  No runtime behavior tied to the removed ignore entries.

## Preserved invariants checked
- Save/hydrate remains deterministic for current saves.
- Older saves without persisted next-ID state still hydrate successfully.
- Starter/custom test fixtures keep deterministic IDs by explicitly syncing bespoke `nextIds` when tests overwrite world arrays outside kernel APIs.

## Edge cases and failure paths
- Expired runtime events removed before a later recreated event.
- Cold-load recreation after a deleted entity.
- Legacy payloads missing the newly persisted runtime field.
- Invalid transit actions remain rejected in existing engine tests.

## Flake controls
- All added coverage is deterministic and synchronous.
- Cold-load tests use `JSON.parse(JSON.stringify(...))` to simulate persisted payloads and remove in-memory references.

## Known gaps
- Older saves that already deleted the highest suffix before this feature existed can only resume from highest live suffix, because that historical counter data was never persisted.
