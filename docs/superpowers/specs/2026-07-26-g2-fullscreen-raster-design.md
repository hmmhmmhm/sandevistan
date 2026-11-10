# G2 full screen raster experiment design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

> **Legacy evidence:** Historical RELIC names, paths, storage keys, and
> transport identifiers in this record are preserved exactly as they appeared at
> the time. Current main-branch identifiers use Sandevistan.

## Target

Display the selected Sandevistan HUD concept as a static image across the G2's 576×288 display.
This experiment checks only information density and actual readability.
Dynamic sensor, map, and STT functions are not connected.

## Confirmed premise

- The G2 display area is 576×288.
- One image container can be 20~288×20~144.
- One page can contain up to four image containers.
- The official 16-bit RGB PNG returned `imageException` on the actual device.
- After conversion to 8-bit RGB PNG, both the original size and 200×100 returned `success`.
- The selected original Sandevistan HUD is a 1774×887, 8-bit RGB PNG. Its 2:1 ratio matches the display.

## Screen composition

The original HUD is first reduced to 576×288 and then cut into the following four areas.

| container | Location | size | Source area |
|---|---:|---:|---:|
| `relicTL` | 0, 0 | 288×144 | 0, 0 |
| `relicTR` | 288, 0 | 288×144 | 288, 0 |
| `relicBL` | 0, 144 | 288×144 | 0, 144 |
| `relicBR` | 288, 144 | 288×144 | 288, 144 |

Create all four files in advance as 8-bit RGB PNGs.
Behind the images, place one blank full-screen Text container that receives tap events.
The page has 5 containers in total.

## Transmission flow

1. Create a page with an empty event layer and four image containers.
2. Display "READY - TAP TO SEND" on the phone screen.
3. Wait for one tap on the glasses touchbar or R1.
4. Send tiles serially in this order: `relicTL → relicTR → relicBL → relicBR`.
5. Do not send two tiles concurrently.
6. Display each tile's normalized result and progress on the phone screen.
7. If all four sends succeed, display `FULLSCREEN RESULT: success`.

The page uses all four image slots, so do not add progress text on the glasses.
Read failure information on the phone screen.

## Error handling

- If page creation returns `invalid`, rebuild once with the same container configuration.
- If a tile result is not `success`, stop before the next tile. Display the failed tile name and result on the phone.
- Restore an omitted single-tap event value of 0 with the previously verified method.
- On double tap, close the app without starting image transfer.

## Verification

Automated testing checks:

- The positions and sizes of the four tiles accurately cover 576×288 without any gaps.
- The four generated PNGs are each 288×144, 8-bit RGB.
- Image transmission is in the order of TL, TR, BL, BR and is always serial.
- Transfer starts only once with a single tap.
- No follow-up tiles are sent after the first failure.

After building, use a new port and QR to avoid the previous WebView cache.
On the actual device, inspect tile boundaries, missing areas, distortion, brightness, and text readability.
