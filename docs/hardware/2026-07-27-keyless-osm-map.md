# G2 Keyless OSM Map Success

> Historical record: Scope and results apply to the stated date and versions.
> See the [documentation index](../index.md) for current behavior.

Date: 2026-07-27
Branch: `feature/g2-fast-content`
Tested commit: `72ebbce825e1df3d52612215ddd269b59bc38013`
SDK: `0.0.11`
Build: `live-map-014`
URL: `http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=live-map-014`
Path: `/hud-canvas-fast?sdk=0.0.11&build=live-map-014`
Result: PASS

## Physical G2 confirmation

The physical checkpoint opened the map build URL above after the
same-origin Overpass endpoint had returned live road geometry. The user
confirmed that the map was clearly visible:

> Yes, it looks good.

The user also observed that nearby names were absent. That is the expected
scope of `live-map-014`; its approved implementation plan explicitly excluded
OSM street labels. The separately approved `map-labels-015` design addresses labels.

The confirmation establishes visible live road geometry on G2. It does not establish an exact heading or a physical `2/4` transfer trace. It also does not establish cache-cell request suppression or measured page-transition time.

## Automated and endpoint evidence

Before the physical checkpoint:

- `npm test`: 19 files, 211 tests passed with serial execution;
- `npm run typecheck`: exit 0;
- `npm run build`: exit 0;
- `npm run test:sites`: 4/4 tests passed;
- Tailscale HUD request: HTTP 200;
- live map response for the test cell: 180 roads, including 45 major and 135
  minor roads, with 1,373 total geometry points;
- attribution: `© OSM CONTRIBUTORS`.

The automated suite verifies the 650-meter fixed query, response limits,
projection bounds, left-only map refresh targeting, unchanged right-side page
transport, and hidden-frame restoration. Those internal conditions remain
automated evidence rather than separate physical observations.
