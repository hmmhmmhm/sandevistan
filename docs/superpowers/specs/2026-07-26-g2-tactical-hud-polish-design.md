# G2 Tactical HUD Policy Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

## Background

On the actual G2, the first `576×288` Canvas HUD appeared as large as the existing dashboard.
Large text and maps were clearly readable.
However, thick closed panels and a filled central turn arrow made the design resemble an instrument panel rather than a HUD.

Improve the information hierarchy and graphic style while preserving the successful size and transmission path.

## Target

- Remove the `ACC` panel and X/Y/Z values.
- Combine the lower-right area `404,142,164×138` into one large news and mission card.
- Increase key Korean news and mission phrases to at least 17 pixels.
- Preserve map size, time size, the central guide area, and `576×288` logical resolution.
- Use open corners, cut lines, index marks, and brightness levels instead of repeated closed squares.
- Keep SDK `0.0.10` tile transmission unchanged.

## Design direction

### 1. Open tactical frame

Do not draw a complete border around each main area.
Use corner brackets and short edges of 10 to 16 pixels.
Emphasize one selected corner in white.
Between frames, add small section indices such as `01`, `02`, `03` and short scale marks.

Keep the areas visually separate without repeated closed boxes.
Use low brightness for frames and medium brightness for auxiliary information.
Reserve maximum brightness for the current action and route.

### 2. Map depth

Keep the map area `8,72,184×172` and bottom legend `8,252,184×28`.
Draw roads as single low-brightness lines.
Draw the active path with a 6-pixel medium-bright base and a 2-pixel white center line.
Mark the current location with an arrowhead and small central notch.
Mark the destination with a double-square target.

### 3. Central direction guidance

Keep the central area `204,72,188×130`, but remove the large filled arrow.
Draw the bent route with an 8-pixel medium-bright base line and a 3-pixel white center line.
Match the map-route style and add an open arrowhead at the right end.
Use this information order: `NAV // ROUTE 01`, `120m`, and `turn right`.

The bottom guide '204,214,188×66' contains 'next intersection', large 'right turn', and small direction.
Place symbols separately.

### 4. Right information structure

The microphone area '404,72,164×62' is maintained, but the waveform and baseline are further refined.

Remove `ACC` and all existing 50-pixel-high news boxes,
Combine into a single card of `404,142,164×138`.

- Top: `NEWS // 02`, `MISSION ACTIVE`
- Body: ‘To subway station’ 17 pixels, ‘Move’ 24 pixels
- Bottom: `ROUTE UPDATED`, `02:14`

Use large text and ample line spacing for immediate readability on the actual glasses.
Place a vertical status line and small progress scale along the card's left edge to identify it as a mission card.

## Fixed palette and typography

- Background: `#000000`
- Key information: `#ffffff`
- Line below the active path and auxiliary information: `#aaaaaa`
- Frame, road, decoration: `#555555`
- Monospace font: `"SFMono-Regular", Consolas, monospace`
- Time: 26 pixels
- Core action: 22-24 pixels
- News body: 17 pixels or more
- General information: 11 to 14 pixels
- Fine label: 8-10 pixels

Do not add colors, blur, shadows, or transparency effects.
Prioritize monochrome raster conversion and the G2's near-1-bit display characteristics.

## Compatibility and off-target

- The `/hud-canvas` path and the `drawDenseCanvasHud()` public function name are maintained.
- Root image HUD, diagnosis, and correction path do not change.
- Real-time sensor connectivity, news API, and location data binding are out of scope.
- Do not replace Canvas with image assets or SVG.
- Transmission retry and BLE protocol do not change.

## Automatic verification

- Check that the Canvas is exactly `576×288`.
- Check that `ACC` and X/Y/Z strings are absent.
- Check that `NEWS // 02`, `MISSION ACTIVE`, `To the subway station`, and `Move` use text of at least 17 pixels.
- Check right-card corners against the boundary from `404,142` to `568,280`.
- Check for medium-bright base lines and white center lines on both the map route and central guidance.
- Check that the palette uses only the four existing colors.
- Pass the full tests, type checking, production build, and Sites package checks.

## Judgment of practical equipment

Change the build identifier of the Tailscale URL to `tactical-hud-002`. In G2
Check the following items.

- Does it maintain the same size and clarity as the existing version?
- Are the news and mission statements easy to read at a glance?
- Did the visual space and hierarchy of the right area improve after ACC removal?
-Aren't open corners and dual paths blurry?
- Don't the compass, map path, and central directions look disconnected at the boundaries of the four tiles?
