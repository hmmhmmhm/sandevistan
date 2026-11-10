# G2 High Density Canvas HUD Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

> **Legacy evidence:** Historical RELIC names, paths, storage keys, and
> transport identifiers in this record are preserved exactly as they appeared at
> the time. Current main-branch identifiers use Sandevistan.

## Target

Recreate the existing Sandevistan HUD on the `576×288` Canvas without using the original PNG.
Preserve the time, location, compass, map, microphone, acceleration, route guidance, and quest configuration.
Enlarge the elements and text within the maximum perimeter identified by calibration.
Reduce empty space to approach the perceived size of the system dashboard.

## Success Criteria

- Render `/hud-canvas` with Canvas primitives and text without reading the original image.
- Keep the logical screen exactly `576×288`.
- Enlarge the map, central guidance, and right sensor panel relative to the existing version.
- Keep the existing `/`, `/diagnostic-v10`, and `/calibration-max` behavior unchanged.
- Reuse the four-image-container serial transmission path from SDK `0.0.10`.
- On the actual G2, display four tiles and let users compare element size with the original image concept.

## Rendering Structure

Use a new `src/canvas-hud.ts` module for rendering.
The module takes only an `HTMLCanvasElement` and does not depend on the Even Hub bridge or React.

`App.tsx` calls the new renderer for `/hud-canvas`.
After rendering, the existing `transmitCanvas()` divides the Canvas into four `288×144` pieces.
Transmit them in this order: `relicTL`, `relicTR`, `relicBL`, and `relicBR`.

## Visual principles

- Keep the background completely black to reflect the real environment.
- Use only maximum, medium, and low brightness.
- For conversion to the G2 green layer, use Canvas colors `#ffffff`, `#aaaaaa`, and `#555555`.
- Draw panels and lines with `fillRect` at integer coordinates and 1-pixel paths.
- Use a fixed-width font. The original wording lists 16 to 26 pixels for core information and 16 to 26 pixels for auxiliary information.
  It also specifies 10 to 13 pixels for auxiliary text. This size conflict remains unresolved.
- Preserve peripheral information from the existing draft. Enlarge central route guidance to reduce empty space.

## Fixed Layout

| area | Coordinates and Size | Content |
|---|---|---|
| Time/Location | `8,8,132×54` | `14:37`, `HONGDAE` |
| compass | `148,8,276×54` | scale, `N`, `NE 047°`, `E` |
| Link decoration | `432,8,136×54` | Top right frame and signal bar |
| map | `8,72,184×172` | Road network, highlighted route, current location arrow |
| Map legend | `8,252,184×28` | Show scale and destination |
| Central Information | `204,72,188×130` | Big right turn arrow, `NEXT 120m`, `right turn` |
| Bottom instructions | `204,214,188×66` | `Turn right at the next intersection` |
| microphone | `404,72,164×62` | `-24 dBFS`, level bar |
| acceleration | `404,142,164×80` | `X +0.12`, `Y -0.03`, `Z +0.98` |
| Quest·News | `404,230,164×50` | `Q. Move to subway station`, `NEWS 02` |

Maintain a gap of at least 8 pixels between panels.
Keep every area at least 4 pixels inside the Canvas boundary.

## Map and direction display

Maps are drawn as Canvas line segments, not as simple decorative images.

- Repeated placement of low-brightness horizontal, vertical, and diagonal roads.
- The path of maximum brightness is indicated by three thick lines.
- The current location is indicated by a filled triangle pointing upward.
- The destination is indicated by a small square marker.

Central guidance uses a thick arrow that bends to the right. Route guide text
It is displayed larger than the existing bottom line, and the distance and motion are divided into two steps.

## Error handling

If no 2D Canvas context is available, throw an explicit error, as the existing renderer does.
For page-creation or tile-transmission failures, keep the existing status output and `transmitCanvas()` error handling.
Do not add automatic retries or SDK changes.

## Automatic verification

- Check whether the renderer sets the Canvas to `576×288`.
- Inspect the border coordinates of the main panel and the three brightness palettes.
- Check that the map route and center right turn arrow are drawn.
- Check that all key characters and fixed mockup values ​​are rendered.
- Check that `/hud-canvas` picks up a new renderer and four image containers.
- Check whether the tests of the existing route and the three diagnostic routes continue to pass.
- Run type checking, production builds, and Sites packaging tests.

## Hardware judgment

In the Even App Developer QR scanner, open `/hud-canvas` and wait for four tiles to finish sending.
Record the following comparisons with the existing image HUD:

- Are the time, compass, map, and sensor letters larger and easier to read?
- Does the central guide make the screen feel larger without excessively blocking the field of view?
-Are there any breaks in the lines or characters at the boundaries of the four tiles?
- Is the overall information density sufficient compared to the system dashboard?
