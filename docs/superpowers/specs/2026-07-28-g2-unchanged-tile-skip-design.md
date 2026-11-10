# G2 design to skip tile transmission without change

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

Date: 2026-07-28

Status: Approved for custom implementation

## Target

Preserve the PNG four-tile serial transfer verified on the glasses with SDK `0.0.11`.
If a new encoded tile exactly matches its last successfully transmitted payload, omit the `updateImageRawData` call.

## Selected method

Keep the last successful `Uint8Array` for each tile ID.
Compare its length and every byte with the new encoded payload.

- The dirty flag is excluded because all update callers must know exactly the changed area.
- Hashes reduce memory slightly, but are excluded because they require collision handling and separate calculations.
- Accurate comparison is the simplest, with only a maximum of four tiles and a small PNG size.
  no conflict

Keep Canvas encoding, which currently takes 20–55ms.
Focus on reducing SDK image calls, which take hundreds of ms to seconds.

## Transport Rules

1. On initial display, send every target tile because the cache is empty.
2. After encoding, compare each tile exactly with its last successful bytes.
3. If the bytes match, skip the SDK call and log `[TILE] <name> skipped · unchanged`.
4. If the bytes differ, send the tile serially in the existing order.
5. Immediately after SDK success, replace only that tile's cached bytes.
6. On failure, exception, or timeout, keep its cache unchanged.
7. If a later tile fails, retain earlier successful tiles in the cache.
   On the next input, send only tiles that do not match the glasses' last successful payloads.
8. If all requested tiles are skipped, complete the refresh normally and commit the display state.

## Hide and restore

Black tiles differ from the current HUD, so hiding sends all four tiles.
After success, the cache contains black tiles. Restoring then sends all four HUD tiles because those bytes differ.
Continue dropping external updates while hidden.

## Life cycle and memory

Keep the cache inside each `transmitCanvas` instance.
Discard it during app-effect cleanup or page-instance replacement to avoid skipping updates for newly created containers.
Store at most four PNGs.

## Maintaining stability contract

- SDK `0.0.11`
- 288×144 PNG four tiles
- Overall sequence `3 → 5 → 2 → 4`
- Serial transmission inside one update
- Immediately discard busy requests
- Prevent retry of failed requests and wait queues
- 12 second time limit per tile

## Diagnostic log

After each refresh, log the actual SDK-call count and skipped-tile count.

```text
[REFRESH] image refresh complete · sent 1 · skipped 1
```

During repeated clock, battery, location, and same-screen updates, check for `skipped · unchanged`.
Only tiles whose pixels changed should produce the existing success log.

## Automatic testing

- First display sends all tiles
- SDK call omitted for identical tiles
- If only part of the change is made, only the changed tile is sent
- Failed tiles are sent again in the next independent event
- Partial success cache is maintained so success tiles are not sent redundantly.
- Black hiding and HUD restoration each transmit four tiles
- All SDK calls have a maximum concurrent execution count of 1
- No regression in existing busy-drop, timeout, page rollback, or detailed screen input
