# G2 Maximum Display-Area Calibration Test Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

> **Legacy evidence:** Historical RELIC names, paths, storage keys, and
> transport identifiers in this record are preserved exactly as they appeared at
> the time. Current main-branch identifiers use Sandevistan.

## Target

On the actual glasses, compare the Even Hub plugin's maximum `576×288` perimeter with the G2 system dashboard perimeter.
This test distinguishes the plugin display area from the size of the Sandevistan concept content.

## Discrimination range

This test answers the following questions:

- How far outward are the plugin's outermost pixels visible?
- Do the four `288×144` tiles join seamlessly at their edges and center?
- When switching to the dashboard, does native content extend beyond the Canvas edge?

This test does not set the consumer specification's `640×350` area directly in the plugin.
It also does not determine the dashboard's exact render resolution.

## Approach

Add `/calibration-max` without changing the existing root HUD or diagnostic route.
Draw the `576×288` calibration pattern directly on browser Canvas.
Reuse the 4-tile SDK `0.0.10` image-transfer function already verified on the actual G2.

Do not add separate image files or dependencies.
Drawing the calibration pattern in code makes coordinates testable.
It also prevents original-image scaling or margins from affecting the results.

## Calibration pattern

Draw the following elements at maximum brightness signal on a black background:

1. A 4-pixel outer band touching the coordinates `0` and the final coordinates `575` and `287`.
2. 2-pixel secondary border coming in 8 pixels from the outside
3. 2-pixel central cross covering `x=287~288`, `y=143~144`
4. 32-pixel interval grid in horizontal and vertical directions
5. `TL`, `TR`, `BL`, `BR` markings in each quadrant
6. `576×288 MAX` mark in the center

Draw all lines with `fillRect` at integer coordinates to avoid half-pixel anti-aliasing.
Use a fixed-width Canvas font for character markers.
Judge the display perimeter by outer bands and scale marks rather than glyph shapes.

## App behavior

- When `/calibration-max` opens, draw the calibration pattern on the Canvas.
- The existing `transmitCanvas()` divides the Canvas into four `288×144` PNGs.
- Serially transmit in the following order: `relicTL`, `relicTR`, `relicBL`, and `relicBR`.
- The status text on the web screen displays the current transmission progress and failure point.
- The existing `/`, `/diagnostic-v10` operation and SDK version contract are not changed.

## Judgment procedure

1. Open the `/calibration-max` URL with the Even app developer QR scanner.
2. Check the transfer completion status of the four tiles.
3. Without moving the glasses, observe the outer band, secondary rim, and central cross.
4. Switch to the dashboard on G2 and compare to the outermost position of the content.

The results are interpreted as follows.

| Observation | Interpretation |
|---|---|
| Dashboard content extends beyond the Canvas perimeter | Native dashboards likely use wider viewports |
| Both perimeters match | Content density, brightness, or stereoscopic layers likely explain the perceived difference |
| Part of the Canvas perimeter is cut off | First check wearing position and the app's screen-height setting |
| Central cross is broken or misaligned | Check 4-tile placement and image-transfer boundaries |

## Error handling

If page creation or an image transfer fails, display the existing error message and container name on the web screen.
Do not retry automatically or change the SDK.
Keep SDK `0.0.10` to preserve the initial successful configuration.

## Automatic verification

- Check that `/calibration-max` selects calibration mode.
- Check that the calibration function sets the Canvas to `576×288`.
- Check integer coordinates for the outer bands, secondary border, and central cross.
- Check that calibration mode uses four image containers and the existing serial transmission path.
- Run the full Vitest suite, type checking, production build, and site-packaging tests.

## Completion conditions

- Pass all automated checks, including existing tests.
- Confirm that the Tailscale URL returns HTTP 200.
- Complete four tile transfers on the actual G2.
- Record the user's comparison of the Canvas perimeter and dashboard perimeter.
