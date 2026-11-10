# G2 Live Data and Optional Routing Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

> **Legacy evidence:** Historical RELIC names, paths, storage keys, and
> transport identifiers in this record are preserved exactly as they appeared at
> the time. Current main-branch identifiers use Sandevistan.

Date: 2026-07-27
Status: Approved
Target route: `/hud-canvas-fast`

## Goal

Replace the static weather, map, and news samples with useful live data while
preserving the hardware-proven fast Canvas layout:

- fixed `576 x 288` frame;
- left `288 x 288` map on image containers 2 and 4;
- right page content on image containers 3 and 5;
- initial four-tile serial transmission;
- right-side-only serial transmission during page navigation;
- double-tap black-frame display toggle;
- SDK image behavior proven on the physical G2.

All general features must work without third-party API keys. Turn-by-turn
routing is the only feature that may require a user-provided key.

## Decisions

### SDK version

The live-data baseline is pinned to `@evenrealities/even_hub_sdk` `0.0.11`.

SDK `0.0.11` adds `getAppLocation`, `startAppLocationUpdates`, `onAppLocationChanged`, and `stopAppLocationUpdates`.
SDK `0.0.12` adds LZ4 image transport and produced `SENDFAILED` on the physical G2.
Use version `0.0.11` for the official location bridge and the pre-LZ4 image path closest to the proven `0.0.10` transport.

The hardware gate ran in two stages. SDK-only build `fast-live-011` first
established bilateral display, row-major `2/3/4/5` four-tile rendering, normal
scrolling, and no `SENDFAILED`. After the user requested right-column-first
loading,
`fast-right-first-011` at commit
`df19655a40dc72a088fb702c8d3e1cade7e0274d` combined SDK `0.0.11` with
`3/5/2/4` fast full transfers. The physical G2 approved that combined build,
including `3/5` paging and double-tap hide/restore, as the live-data baseline.
SDK `0.0.12` remains blocked until separately proven.

### Key policy

| Capability | Provider | Key policy |
| --- | --- | --- |
| Phone location | Even Hub SDK `0.0.11` | No key |
| Current weather | Open-Meteo | No key for personal, non-commercial use |
| News | Allowlisted publisher RSS | No key |
| Local road map | OpenStreetMap data via Overpass | No key |
| Turn-by-turn route | OpenRouteService | Optional `ORS_API_KEY` |

`ORS_API_KEY` is a server-side environment secret. It must never be added to
Vite client environment variables, the `.ehpk`, logs, query strings returned
to the client, or source control.

When the key is absent, the navigation page remains available but reports that
routing is disabled. Map, location, weather, news, TODO, battery, paging, and
display toggle continue to work normally.

## Runtime architecture

```text
Even Realities phone WebView
├── Even SDK 0.0.11
│   ├── one-shot location for initial map and weather
│   ├── 15 s / 15 m location for live map movement
│   └── 2 s / 5 m location during active navigation
├── Open-Meteo forecast API
│   └── current weather JSON, fetched directly with CORS
├── GET /api/news?feed=sbs-latest
│   └── RELIC Worker fetches an allowlisted RSS document
├── GET /api/map?lat=...&lng=...
│   └── RELIC Worker fetches bounded OSM road geometry via Overpass
└── POST /api/route
    └── RELIC Worker calls ORS only when ORS_API_KEY exists

Normalized live state
        ↓
Existing 576 x 288 Canvas renderer
        ↓
Serialized G2 image updates
```

The production Worker and local Vite server expose the same API contract.
Before deployment, the Tailscale hardware URL can therefore test the same news and map flows.

## Live state model

The client maintains one immutable dashboard snapshot:

```ts
type LiveDashboardState = {
  location: LocationState;
  weather: WeatherState;
  news: NewsState;
  map: MapState;
  route: RouteState;
};
```

Each state records its value, fetch time, and status:

- `loading`: no successful value yet;
- `fresh`: latest request succeeded;
- `stale`: a refresh failed and the last successful value is displayed;
- `unavailable`: no live or cached value can be used;
- `disabled`: optional service is not configured.

The renderer receives plain normalized data and performs no network calls.
Network providers, persistence, rendering, and G2 transport remain separately
testable.

## Location

### Initial fix

After the Even bridge is ready, request one medium-accuracy location with a
five-second timeout. Do not block initial display indefinitely.

Fallback order:

1. new SDK location;
2. last successful location from Even local storage;
3. a clearly labeled Hongdae demo coordinate.

The fallback must be identified as `DEMO` in the map header. Cached data is
identified as `LAST FIX`; only a new device fix is identified as `LIVE`.

### Continuous updates

After the later physical map test, continuous location tracking remains active
at a restrained `15 s / 15 m` rate so the keyless map follows meaningful
movement. An active ORS route temporarily raises it to `2 s / 5 m`. Ending
navigation restores the general map rate; disposing the app stops updates.

Active-navigation options:

- medium accuracy;
- two-second interval;
- five-meter distance filter.

Raw location history is not retained. Only the latest successful fix and its
timestamp are persisted.

## Weather

Fetch current weather directly from Open-Meteo using the resolved coordinates.
Request only fields visible in the HUD:

- current temperature;
- apparent temperature;
- WMO weather code;
- relative humidity;
- wind speed;
- current or next-hour precipitation probability.

Map WMO codes to short Korean labels. Refresh at most once every 15 minutes and
when the app returns to the foreground with stale data. Show cached data
immediately, refresh in the background, and retain the last successful value
on errors.

The overview page shows the richer weather values. The common right-side
header keeps a compact temperature and condition. A weather refresh redraws
and sends only the right tiles needed by the currently visible page.

Open-Meteo attribution is displayed in the phone WebView credits and recorded
in project documentation. Public distribution or monetization requires a new
licensing review.

## RSS news

The first feed is the SBS latest-news RSS feed, used only for this personal,
non-commercial prototype.

The browser calls a same-origin Sandevistan endpoint using a stable feed ID:

```text
GET /api/news?feed=sbs-latest
```

The endpoint rejects arbitrary target URLs.
The Worker maps each supported ID to a hard-coded HTTPS feed.
It rejects unsupported IDs and disables redirects.
It enforces an eight-second timeout and a one-megabyte response limit.
It returns XML with a five-minute shared cache.

The client parses RSS with `DOMParser`, tolerating absent `guid`, `link`, or
`pubDate`. It:

1. derives identity from `guid`, then `link`, then a deterministic title hash;
2. strips markup and normalizes whitespace;
3. removes duplicates;
4. sorts valid dates newest first;
5. keeps six titles for the HUD.

The client refreshes at most once every 10 minutes and on foreground return
when stale. Page scrolling never triggers a network request. Last successful
headlines are persisted; a failed refresh keeps them visible with a subtle
`STALE` state. With no cached result, the page shows a concise unavailable
message rather than static fake headlines.

## Keyless OSM map

The map is not a WebView screenshot and does not embed Google Maps. The Worker
submits a bounded road query to a configured public Overpass endpoint and
returns normalized OpenStreetMap line geometry around a validated coordinate.
The client projects the returned line geometry into the existing left
`288 x 288` Canvas area.

The visual renderer:

- preserves the approved monochrome tactical treatment;
- draws minor roads dimly and major roads more brightly;
- draws the current-position arrow above roads;
- draws an active route above the base roads when available;
- includes legible `© OSM CONTRIBUTORS` attribution;
- avoids dense native map labels that become noise after 4-bit conversion.

Map requests use a fixed radius and rounded cache cell. The Worker rejects
unbounded queries. Road geometry may be cached for 24 hours because it changes
slowly. The client requests a new map only when the resolved location leaves
the current cache cell, not on every position update.

When a new map frame is ready, redraw the shared source Canvas and send only
left container IDs 2 and 4. Map updates and page updates share one serialization
queue so no two image sends overlap.

The public OSM infrastructure is suitable only for the personal prototype and
must not be treated as a production CDN. Public distribution requires a
reviewed tile/data provider or self-hosted data service.

## Optional ORS navigation

### Disabled state

If `ORS_API_KEY` is absent, `/api/route` returns a machine-readable
`ROUTING_DISABLED` response. The navigation page shows:

```text
NAV // READY
Path key required
Use after connecting to OpenRouteService
```

This is an expected configuration state, not a global application error.

### Enabled state

When configured, the phone companion UI accepts a destination search. ORS
geocoding and directions requests are proxied through the Worker. The server
allows only walking, cycling, and driving profiles and validates coordinates,
result sizes, and timeouts.

The client stores only the active destination, normalized route geometry,
current maneuver, remaining distance, and route timestamp. It does not persist
precise movement history.

During active navigation:

- the right navigation page updates only when the maneuver or displayed
  distance bucket changes;
- the left map updates on a meaningful movement threshold or maneuver change,
  not at the raw GPS frequency;
- an off-route threshold may request a new route, with cooldown and one request
  in flight;
- ending navigation stops continuous location immediately.

The first implementation may expose destination search only in the phone
WebView. Ring and glasses gestures retain page navigation and display-toggle
semantics.

## Persistence and refresh

Use the Even bridge local-storage API for compact JSON snapshots:

- last location;
- last weather response and fetch time;
- last six news items and fetch time;
- optional active destination and route summary.

Corrupt or version-incompatible cache entries are discarded individually.
Cache failures must not block the initial G2 frame.

Service refreshes are independent. A weather or RSS failure cannot erase a
valid map, and a missing ORS key cannot disable any keyless feature.

## Manifest permissions

The packaged app declares:

- `location`, explaining current-location weather and maps;
- `network`, allowlisting the Open-Meteo origin and the deployed Sandevistan Worker
  origin.

Third-party RSS, OSM, and ORS origins are reached by the Worker, not directly by
the packaged WebView. Local QR testing continues to use the Tailscale/Vite
origin.

## Transport and concurrency

One serialized image-update coordinator owns all G2 image sends.

- Startup: IDs 3, 5, 2, 4 (right top, right bottom, left top, left bottom).
- Page scroll: IDs 3 and 5.
- Map refresh: IDs 2 and 4.
- Display hide: black IDs 3, 5, 2, 4.
- Display restore: current IDs 3, 5, 2, 4.

The send-order change preserves navigation semantics.
Forward scroll advances through pages 1→2→3→4.
Backward scroll reverses that sequence.
Do not invert SDK event directions.

State changes may coalesce while a send is in flight. The newest state wins;
obsolete intermediate frames may be dropped. A failed send reports the error
but must release the queue for the next request. Scroll remains ignored while
the display is hidden.

## Failure behavior

- No SDK location: use cached or labeled demo location.
- Weather request failure: show cached weather as stale; otherwise `WEATHER --`.
- RSS failure: show cached headlines as stale; otherwise an unavailable row.
- OSM failure: retain the last map; otherwise render a labeled schematic
  fallback.
- ORS key missing: navigation disabled only.
- ORS request failure: keep the last valid route if safe, label it stale, and
  allow retry or end navigation.
- G2 image failure: preserve current app state and allow the next serialized
  update or display restore attempt.

## Verification strategy

Automated tests cover:

- SDK version and manifest permissions;
- location normalization and fallback order;
- Open-Meteo parsing, WMO labels, cache age, and stale fallback;
- RSS parsing, sanitization, deduplication, ordering, and six-item limit;
- Worker feed allowlist, request validation, timeout, size limit, and cache
  headers;
- map request bounds, projection, layer ordering, and attribution;
- ORS-disabled response and secret non-exposure;
- optional route normalization and maneuver selection;
- initial `3/5/2/4`, page `3/5`, and map `2/4` tile contracts;
- serialization across page, map, hide, and restore sends;
- existing legacy route behavior.

Required commands:

```text
npm test
npm run typecheck
npm run build
npm run test:sites
```

## Hardware gates

1. **SDK 0.0.11 transport gate**
   Completed on physical G2 build `fast-right-first-011`: bilateral fast
   startup, `3/5/2/4` full transfers, `3/5` scrolling, and double-tap
   hide/restore. SDK `0.0.11` is approved as the live-data baseline.

2. **Keyless location/weather sub-gate**
   Completed on physical G2 build `live-weather-012` at tested commit
   `1da29615713c6e3f730ad0c61341d7dbe0e88435`. The user confirmed the presented
   initial-display, bilateral four-tile, location/fallback, live-weather,
   scroll, and visible hide/restore checklist as a whole. Exact location label
   and weather numbers were not transcribed. Exact `3/5` weather refresh,
   hidden-refresh suppression, and newest-frame restore remain automated
   transport evidence rather than separately instrumented physical
   observations. This pre-OSM build truthfully renders
   `LOC // ... · MAP DEMO` and the phone credit
   `Weather: Open-Meteo · Maps: Demo Schematic`.

3. **Remaining keyless live-data gate**
   Confirm real or clearly labeled fallback location, current weather, six RSS
   headlines, map readability, refresh latency, and unchanged fast paging.

4. **Optional ORS gate**
   After a key is provided, confirm destination selection, route geometry,
   maneuver transitions, map throttling, off-route behavior, and clean stop.

Each successful gate is documented and committed before moving to the next.

## Out of scope for the first live build

- Google Maps or Google Routes;
- second-by-second weather, news, or map image transmission;
- background location tracking after the app is disposed;
- storing location history;
- traffic-aware routing guarantees;
- voice destination entry;
- public commercial deployment.
