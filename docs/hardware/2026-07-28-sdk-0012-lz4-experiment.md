# SDK 0.0.12 G2 LZ4 image transmission experiment

> Historical G2 record: Scope and results apply to the stated date and versions.
> See the [documentation index](../index.md) for current behavior.

> **Legacy evidence:** Historical RELIC names, paths, storage keys, and
> transport identifiers in this record are preserved exactly as they appeared at
> the time. Current main-branch identifiers use Sandevistan.

Date: 2026-07-28

SDK: `0.0.12`

Build: `sdk-lz4-030`

Result: `FAIL`

branch: `feature/g2-ors-routing`

Remote baseline commit: `90a9421`

Local SDK replacement commit: `588c9fc`

Local SDK recovery commit: `21c20c9`

URL:
`http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.12&build=sdk-lz4-030`

## Purpose

Preserve the hardware-approved SDK `0.0.11` build remotely. Change only the SDK to `0.0.12`, then compare LZ4 image-transfer speed and stability.

## Maintained transmission conditions

- Encode 576×288 Canvas into four 288×144 PNGs
- Total transmission order `3 → 5 → 2 → 4`
- Right page conversion order `3 → 5`
- Only tiles within one refresh are transmitted serially
- Prohibit simultaneous image calls
- Immediately discard busy refresh requests
- Prohibit failed update retries and overdue event processing
- Maintain 12 second time limit per tile

## Identified SDK differences

The app's `ImageRawDataUpdate` argument did not change. SDK `0.0.12` automatically adds `compressMode: 2` to the `toJson()` result. A unit test fixes this contract. The Canvas renderer and transfer scheduler did not change.

## Automatic verification

- SDK version, app minimum version, QR mark test: 2/2 passed
- `npm test`: 37 files, 371 tests passed
- `npm run test:sites`: 4 tests passed
- `npm run typecheck`: Passed
- `npm run build`: Converted 67 modules, passed production build.
- Check installation: `@evenrealities/even_hub_sdk@0.0.12`
- Check payload: `compressMode: 2`
- Tailscale experiment URL: HTTP 200

The above commands were not executed simultaneously but were executed sequentially in one process.

## Actual G2 results

On the first run, four-tile Canvas encoding completed in 55ms. The first `relicTR` transfer returned `sendFailed` in 7ms. The app did not send the remaining three tiles. Neither eye showed an image.

```text
[15:35:46.275] [ENCODE] start · 4 tiles
[15:35:46.330] [ENCODE] complete · 4 tiles · 55ms
[15:35:46.330] [TILE] relicTR start · 1/4
[15:35:46.337] [ERROR] relicTR failed · sendFailed · 7ms
[15:35:46.338] [ERROR] app startup failed · Error
```

The scheduler and Canvas source matched the `0.0.11` baseline. The only observed payload difference was SDK `0.0.12` adding `compressMode: 2`. Failure occurred before a normal BLE transfer could complete and matched the earlier `0.0.12` hardware failure. This suggests that the tested Even app image bridge did not support LZ4 mode. The observation does not isolate the failing native component.

## Actual G2 serial confirmation sequence

- [x] The first tile failure time of the first run is left in the diagnostic log.
- [ ] In the first run, four tiles and binocular display are completed. (`sendFailed`)
- [ ] General page next/previous movement moves only one page at a time.
- [ ] The update times for the two tiles on the right remain in the diagnostic log.
- [ ] Overview, News, TODO, Weather details entry and return are activated.
- [ ] Map zoom, news body page, and TODO check/uncheck work.
- [ ] HUD hiding and restoration works.
- [ ] Additional input during transmission ends with `dropped · busy` and is not re-executed later.
- [ ] `SENDFAILED` does not occur.
- [ ] WebView does not stop when left still.

## Judgment

The initial display failure stopped subsequent behavior tests. The SDK `0.0.12` experiment was not pushed remotely. Restore SDK `0.0.11` with a new cache marker, then verify recovery at the following URL.

`http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=sdk-lz4-fallback-031`
