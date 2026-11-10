# G2 Quick Split Canvas HUD Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

> **Legacy evidence:** Historical RELIC names, paths, storage keys, and
> transport identifiers in this record are preserved exactly as they appeared at
> the time. Current main-branch identifiers use Sandevistan.

## Target

Preserve the existing multi-section `/hud-canvas`.
In `/hud-canvas-fast`, control the font size, weight, brightness, and position independently.
Reduce scroll image transfers from four tiles to two.

## Preservation criteria

- The rendering and four tile transfer of `/hud-canvas` are not modified.
- `/hud-hybrid` and `/hud-hybrid-z` are also maintained for comparison experiments.
- New renderer and transport selection are only used in `/hud-canvas-fast`.
- You can always view the existing screen with the Git baseline `325eab1` and subsequent Canvas HUD history.
  You can check again.

## Identified performance causes

At startup and on scroll, `refreshImages()` in `transmitCanvas()` encodes all four tiles as PNG.
It transmits them serially in the order "2, 3, 4, 5".
Each page change redraws and retransmits the entire Canvas, including the unchanged map on the left.

SDK `0.0.10` can update individual images without replacing the four existing image containers.
Send the unchanged left half only at startup.
On scroll, update only containers `3, 5` in the dynamic right half.

## Approaches reviewed

### 1. Update the fixed map on the left and the two tiles on the right

This approach halves scroll image transfers while preserving full Canvas design control.
The left map must be identical on all pages.
Adopt this approach to retain the large map that the user prefers.

### 2. Update Canvas for all four tiles

You can freely change the entire screen for each page, but it has already been confirmed to be slow.
Same as existing transmission. The existing `/hud-canvas` continues to serve as the basis for this comparison.

### 3. Mixing Canvas and native text

This approach has the fastest transitions.
However, the SDK has no font-size, weight, or brightness properties, so it cannot provide the visual control required by this experiment.
Keep the existing hybrid route for comparison.

## Screen composition

The entire screen is 576×288, the same as before.

- Left `0–287px`: Fixed map area unrelated to the page.
- Right `288–575px`: Information area that changes depending on the page
- On the left is a `272×272` map frame, road network, current route in bold, and destination marker.
  Place it.
- On the right, there are three sections: common status header, large core information, and short auxiliary information.
  Place it.
- The time is displayed in seconds and the weather and page number are placed in the same header.
- Core information is drawn in the `20–28px` range, and auxiliary information is drawn in the `10–16px` range.
- Bright information is `#ffffff`, auxiliary information is `#d0d0d0`, structural lines are `#808080`,
  For the background, use `#000000`.
- Bold paths, arrows, checkboxes, and corner markers add depth and depth to your game HUD.
  Create direction.

## Page

The page order is the same as before: `overview`, `navigation`, `news`, and `todo`.

- `overview`: Traffic conditions, congestion, weather and current TODO
- `navigation`: `120m`, big right turn arrow, guidance to next intersection
- `news`: Big traffic headlines, Hongik University Station status, weather briefing
- `todo`: two incomplete items, completed items, G2 and R1 connection status

The left map pixels are identical on all four pages.
All page differences are confined to the right half.

## Transmission flow

At startup, create four image containers and send all four tiles as before.
On scroll, use the existing circular page calculation and serial queue to draw the next page.
Encode only the top-right `relicTR` and bottom-right `relicBR` tiles.
Transmit them to containers `3, 5` in order.

Optimization of the fast path only specifies a different list of update tiles during navigation.
`/hud-canvas` continues to use the default of four tiles.

## Error handling

If a startup tile fails, report the existing error.
If a right-side tile fails on scroll, display the container name and failure result.
Keep the existing error recovery so the next queued navigation request can run.
Do not add automatic retries or replacement sends for left-side tiles.

## Verification

- Pass the existing `/hud-canvas` rendering test without changing its expected pixels.
- Check that the new renderer uses `576×288` and a high-brightness four-level palette.
- Check that every page draws the same left-side `288×288` area.
- Check for key text of at least `20px`, time with seconds, weather, and a page number.
- At startup, send only image IDs `2, 3, 4, 5`.
- On scroll down or up, send only IDs `3 and 5`.
- Even during continuous scrolling, send images serially.
- Run the full unit tests, type checks, production build, and Sites checks.
- On the G2, compare transition speed with the existing four-tile path.
