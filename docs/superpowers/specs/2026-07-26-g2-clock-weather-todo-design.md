# G2 clock/weather/TODO HUD design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

## Target

Add the following information while preserving the size and transmission stability of the current Tactical Canvas HUD:

- Display the clock in `HH:MM:SS` format.
- Display the mock weather "HONGDAE 23°C clear" below the clock.
- Change `MISSION ACTIVE` to `TODO // ACTIVE`. Draw checkboxes for incomplete and complete items.

## Clock operation

`drawDenseCanvasHud(canvas, now?)` accepts an optional `Date`.
If the caller omits the time, the renderer uses the browser's `new Date()`.
Use two digits for each hour, minute, and second, as in `14:37:42`.

The G2 screen is static. The app divides the Canvas into four images and transmits them once.
This change displays the seconds at transmission time. It does not retransmit four images every second.
This preserves the verified single-shot transmission behavior and limits BLE traffic.

To fit the 8-digit time within the existing 132-pixel frame, reduce the font from 26 pixels to 22 pixels.
Below the clock, use one line of 9-pixel monospace text for the region, temperature, and status.
Remove the existing `// 01` decoration to prevent overlap with the weather.

## Weather

The weather is currently a static mockup, like the map, mission, and microphone values.

```text
HONGDAE 23°C Clear
```

External API, location permissions, and network failure handling are not included in this scope.
Real-time weather connection is handled as a separate feature after verifying the static UI and transmission stability.

## TODO Card

The right `404,142,164×138` frame and large text size are maintained.

- `NEWS // 02`
- `TODO // ACTIVE`
- Empty 12 pixel checkbox + ‘To subway station’
- 24 pixels indented `move`
- Checked 10 pixel checkbox + `Confirm path`
- Completion time `02:14`

Draw checkboxes with Canvas squares and lines instead of Unicode symbols.
The incomplete box has a white outline and a black interior.
The complete box has the same outline and a check drawn with two lines.
Remove the existing vertical status line and progress scale to avoid visual competition with the checkboxes.

## Automatic verification

> Unresolved wording: The TODO card says "Confirm path", but verification expects "path resolution". This record does not select the intended label.

- With a fixed time of `2026-07-26 14:37:42`, check that `14:37:42` is drawn at 22 pixels.
- Check that `HONGDAE 23°C Clear` is rendered.
- Check that `MISSION ACTIVE` and `ROUTE UPDATED` disappear.
- Check that `TODO // ACTIVE` and `path resolution` are rendered.
- Check the outer and inner coordinates of both the empty and complete checkboxes.
- Check that the completion check uses a white line.
- Preserve the existing 4-color palette, `576×288` size, and map and route rendering behavior.

## Check actual device

The build identifier is `hud-info-003`.

```text
http://100.96.68.73:4173/hud-canvas?sdk=0.0.10&build=hud-info-003
```

On the G2, check that the seconds and weather line do not overlap.
Check that the checkbox and two-line mission are distinguishable at a glance.
