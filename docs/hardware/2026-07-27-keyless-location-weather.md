# G2 Keyless Location and Weather Success

> Historical record: Scope and results apply to the stated date and versions.
> See the [documentation index](../index.md) for current behavior.

Date: 2026-07-27
Branch: `feature/g2-fast-content`
Tested commit: `1da29615713c6e3f730ad0c61341d7dbe0e88435`
SDK: `0.0.11`
Build: `live-weather-012`
URL: `http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=live-weather-012`
Path: `/hud-canvas-fast?sdk=0.0.11&build=live-weather-012`
Result: PASS

## Physical G2 confirmation

The checkpoint requested checks of initial HUD output, all four tiles in both eyes, and the location-source or fallback display. It also requested checks of live weather replacement in the right panel, normal page scrolling, and double-tap hide and restore. The
user confirmed the checklist as a whole:

> Yes, everything works fine.

Recorded results:

- Initial HUD display: PASS
- Bilateral four-tile output: PASS
- Location source or fallback display: PASS
- Live Open-Meteo weather replacement: PASS
- Normal page scrolling: PASS
- Double-tap black-frame hide and restore: PASS

The record omits the exact location label (`LIVE`, `LAST FIX`, or `DEMO`) and numeric weather values. No image-transfer trace was supplied. Automated tests cover exact `3/5` targeting, hidden-state refresh suppression, and restoration of values changed while hidden. The physical confirmation does not independently establish those internal behaviors.

## Truthful pre-OSM scope

This checkpoint covers keyless Even Hub location and Open-Meteo weather only.
The G2 header deliberately identifies the location source while keeping the map
as `MAP DEMO`, and the phone WebView credit reads:

```text
Weather: Open-Meteo · Maps: Demo Schematic
```

The schematic is not presented as live OpenStreetMap data. OSM fetching,
projection, attribution, and its physical checkpoint remain deferred to the
dedicated OSM implementation plan.

## Automated evidence

The tested build and its documentation/QR update were checked with:

- `npm test`: 15 files, 184 tests passed;
- `npm run typecheck`: exit 0;
- `npm run build`: exit 0;
- `npm run test:sites`: 4/4 tests passed;
- `git diff --check`: no whitespace errors.

The automated transport suite verifies that weather-only refreshes target IDs
`3/5`, hidden refreshes do not transmit, and restore sends the newest complete
frame. Those internal conditions were not separately instrumented in the
physical checkpoint above.

## Active QR identity

At this checkpoint, `npm run qr` pointed to the approved Tailscale URL and build tag shown above. The SDK remains pinned to the hardware-approved pre-LZ4 `0.0.11`
transport baseline.
