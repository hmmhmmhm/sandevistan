# G2 representative weather icon design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

Date: 2026-07-28

Status: Approved for custom implementation

## Target

Display a large 1-bit weather icon on the Weather dashboard and full-screen details.
The icon should identify current weather before the user reads the text.

## Visual rules

- Draw icons directly with Canvas paths. Do not use external images or font icons.
- Retain the G2 black, white, and gray palette and angular tactical HUD style.
- Do not use blur, shadows, glow, or effects that depend on anti-aliasing.
- Use approximately 72px icons on the dashboard and 104px icons in full-screen details.
- Keep icons clear of temperature, condition, perceived-temperature, humidity, precipitation, and wind text.

## Weather Code Mapping

- `0`: sun
- `1–2`: sun and clouds
- `3`: clouds
- `45–48`: Fog
- `51–67`, `80–82`: rain
- `71–77`, `85–86`: snow
- Other `95–99`: Thunderstorms

The shapes are octagonal sun, stepped clouds, parallel raindrops, cross snowflakes, and lightning.
Use geometric shapes with distinct outlines even at low resolution, such as polygons.

## Status handling

For fresh or stale data, display the icon for the weather code.
While loading or unavailable, show only status text.
Do not show an icon that could imply unsupported weather conditions.

## Test

- Icon type mapping for all Open-Meteo code groups
- Creation of Canvas path for each icon
- Call icons to correct size and location in Weather dashboard and details
- Icon not called during loading and unavailable
- No regression in existing page order, text content, input direction and update rules
