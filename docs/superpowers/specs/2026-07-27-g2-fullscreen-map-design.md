# G2 Fullscreen Map and Persistent Zoom Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

Date: 2026-07-27
Branch: `feature/g2-fast-content`
Baseline: `live-refresh-017`
Status: APPROVED

## Goal

From the overview, let the user open a full-display live map with one ring or glasses tap.
Use scroll gestures to change a shared zoom level.
Use a double tap to return to the overview.
Preserve the proven serialized four-tile Canvas transport.

## Approved interaction contract

- A single tap on the overview opens the fullscreen map.
- A single tap on news, TODO, or navigation has no effect.
- Scroll bottom zooms in by one level while the fullscreen map is open.
- Scroll top zooms out by one level while the fullscreen map is open.
- A scroll at either zoom limit is consumed without redrawing or navigating.
- A double tap on the fullscreen map returns to the overview.
- A double tap on the dashboard keeps the existing black-frame
  hide-and-restore behavior.
- Dashboard scrolling keeps the approved
  overview → news → TODO → navigation page order.

The SDK's `CLICK_EVENT`, `SCROLL_BOTTOM_EVENT`, `SCROLL_TOP_EVENT`, and
`DOUBLE_CLICK_EVENT` values are used directly. The design relies on the SDK's
single- and double-click events being distinct, as they already are for the
approved black-frame toggle.

## State model

The fast HUD owns one session-scoped map view state:

```ts
type FastMapViewState = {
  readonly mode: "dashboard" | "fullscreen";
  readonly zoomIndex: number;
};
```

The fixed zoom radii, from farthest to closest, are:

```ts
const FAST_MAP_ZOOM_RADII = [850, 650, 500, 375, 280] as const;
```

The initial radius is 650 metres, which preserves the approved dashboard map.
The 850-metre outer step is deliberately modest so the existing bounded OSM
payload remains useful without expanding the provider query or increasing
Overpass timeout risk.

The embedded and fullscreen renderers share one zoom index for the running app.
It survives page navigation, fullscreen entry and exit, movement, map refresh, minute changes, and battery changes.
On reload or restart, reset the radius to the approved 650-metre default.
Do not add persistent storage for zoom.

A pure state transition function receives the current state, current HUD page,
and normalized input. It returns the next state and one of:

- `unhandled`: let the existing dashboard fallback run;
- `consume`: stop without transmitting;
- `redraw`: redraw and send all four image tiles.

Keeping this transition pure makes gesture conflicts and zoom limits directly
testable without an Even Hub bridge.

## Rendering

The existing map renderer is parameterized with a viewport, projection centre,
pixel radius, geographic zoom radius, and label limit. Its current embedded
defaults remain pixel-compatible at the 650-metre default.

The fullscreen renderer uses the complete 576×288 Canvas:

- map projection centre at `(288, 144)`;
- roads, OSM labels, active route, and heading arrow across all four tiles;
- the approved 14px transit/place and 12px road/landmark label sizes;
- at most 18 collision-free labels;
- a compact opaque header with location/map provenance and zoom;
- a compact opaque footer with OSM attribution and `DOUBLE TAP // BACK`;
- no weather, news, TODO, battery, or dashboard panels.

The header and footer overlay the map rather than shrinking its viewport.
The location arrow remains centred. The fullscreen horizontal field is wider
than the dashboard field at the same zoom, while the vertical scale remains
consistent.

The embedded map footer also shows the selected zoom radius so the retained
state is visible after leaving fullscreen.

## Input and transport routing

`transmitFastCanvas()` gains one normalized input callback. The callback runs
inside the existing operation queue and returns `unhandled`, `consume`, or
`redraw`.

- `redraw` sends all four tiles in the approved `3/5/2/4` order.
- `consume` sends nothing.
- `unhandled` falls back to the current behavior:
  - scroll navigates with the right `3/5` tiles;
  - double tap hides or restores the full HUD;
  - single tap does nothing.

When the black frame is already visible, double tap restores it before any map
interaction is considered. Hidden-state scroll and single-tap events remain
ignored.

No page container is rebuilt. Every encode and image update remains serialized
through the current queue, including rapid tap/scroll input and concurrent live
refresh requests.

## Live-data refresh routing

The App maps provider refreshes according to the visible mode:

- dashboard: retain the existing `left`, `right`, and `right-top` targeting;
- fullscreen `left` update: promote to `all`, because location and map content
  occupy all four tiles;
- fullscreen `right` or `right-top` update: retain new weather, news, battery,
  and time state without transmitting an unchanged map.

Returning to the overview redraws the latest time, battery, weather, news,
location, and map state in one full four-tile send. Movement recentres the
fullscreen map but never changes the selected zoom.

## Failure and boundary behavior

- A zoom-limit scroll is consumed and does not accidentally navigate pages.
- A single tap outside the overview is unhandled and causes no transfer.
- A transport failure is reported through the existing progress channel and
  releases the queue for the next input.
- A failed map refresh keeps the last visible stale geometry under the existing
  `live-refresh-017` contract.
- Cleanup prevents queued gesture redraws and later live refreshes.
- The existing SDK 0.0.11 pre-LZ4 transport pin remains unchanged.

## Test strategy

All commands run serially.

1. Pure state tests cover entry, exit, zoom direction, bounds, shared zoom,
   and non-overview taps.
2. Projection and label-layout tests cover embedded compatibility, fullscreen
   coordinates, collision bounds, and zoom displacement.
3. Renderer tests prove the fullscreen map paints both display halves, uses the
   approved label fonts, centres the arrow, and includes provenance,
   attribution, zoom, and exit guidance.
4. Transport tests prove handled tap/double-tap/scroll inputs use the existing
   queue, redraw with `3/5/2/4`, consume boundaries without a send, preserve
   dashboard navigation and hiding, and never overlap image updates.
5. App tests prove one tap enters only from overview, fullscreen scroll retains
   zoom, double tap returns to overview, left live updates promote to `all`,
   and non-map updates wait for dashboard restoration.
6. The full source, typecheck, production build, Sites, API, and whitespace
   gates run before the physical G2 checkpoint.

## Physical checkpoint

The next build identity is `fullscreen-map-018`. Before push, the G2 checkpoint
must directly observe:

- single-tap overview entry;
- map content across both eyes and all four quadrants;
- bottom-scroll zoom in and top-scroll zoom out;
- zoom retention after returning to the overview and after movement;
- zoom-limit scroll not changing pages;
- fullscreen double-tap return;
- dashboard double-tap black hide and restore;
- normal four-page dashboard scrolling;
- absence of `SENDFAILED`.
