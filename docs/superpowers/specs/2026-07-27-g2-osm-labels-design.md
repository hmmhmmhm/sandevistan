# G2 Balanced OSM Labels Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

Date: 2026-07-27
Status: Approved revision
Target build: `map-labels-large-016`

## Goal

Add readable nearby names to the proven `live-map-014` tactical map.
Keep label density low on the G2 display.
Continue rendering through Sandevistan's Canvas code with the current fast page transport.
Keep the map usable when label data is absent.

The physical `live-map-014` checkpoint established that the live road geometry
is clearly visible. The user then identified the intentional lack of labels as
the next gap.

## Chosen approach

Use a balanced label set:

1. stations and major named places;
2. major named roads;
3. parks and selected public landmarks;
4. minor named roads only when space remains.

The server returns at most 24 normalized candidates. The Canvas collision
layout displays at most 10. Cafes, ordinary shops, entrances, platforms, and
other high-volume POIs are excluded.

Road-only labels do not identify nearby destinations.
Dense POI labels would reduce legibility on the fixed `288 x 288` left panel.
Prefer the selected label mix for these reasons.

## OSM naming and feature sources

Use `name:ko` first and fall back to `name`. OpenStreetMap documents `name` as
the primary real-world feature name expected to be exposed by labels, and
`name:ko` as the Korean-language name tag:

- https://wiki.openstreetmap.org/wiki/Ko:Key:name
- https://wiki.openstreetmap.org/wiki/Ko:Key:name:ko

Station candidates use `railway=station`, `railway=halt`, or
`public_transport=station`. Selected landmarks use bounded values from
`place`, `leisure`, `tourism`, and `amenity`:

- https://wiki.openstreetmap.org/wiki/Railway_stations
- https://wiki.openstreetmap.org/wiki/Tag:public_transport=station

## Server contract

Keep the fixed 650-meter radius, eight-second timeout, one-megabyte upstream
limit, and cell cache. Extend the fixed Overpass query with two logical sets:

- named highway ways, already returned with geometry;
- named stations, places, parks, and selected public landmarks, returned as
  nodes or element centers.

The endpoint remains same-origin and does not accept arbitrary Overpass text or
an upstream URL.

The normalized response adds:

```json
{
  "labels": [
    {
      "kind": "transit",
      "name": "Hongik University Station",
      "point": [37.5572, 126.9245]
    },
    {
      "kind": "road",
      "name": "Yanghwa-ro",
      "point": [37.5569, 126.9211]
    }
  ]
}
```

Allowed kinds are `place`, `transit`, `landmark`, and `road`. Names are
whitespace-normalized, stripped of control characters, limited to 40 Unicode
code points, and deduplicated case-insensitively. Invalid coordinates are
dropped.

Road label anchors use a named way's middle geometry point. Area and relation
anchors use the Overpass `center` value. Candidate priority is:

1. transit;
2. place;
3. named major road;
4. landmark;
5. named minor road.

After sorting and deduplication, return no more than 24 labels. Use a versioned
server cache key so a pre-label road response cannot be served as the new
contract.

## Client parsing and cache

Extend `MapValue` with a required `labels` list and validate the same limits
again on the client. A response with an invalid kind, name, coordinate, more
than 24 labels, or more than the existing road limits is rejected.

Store labelled maps under a new local cache key. The old road-only cache is not
silently treated as labelled data. A matching fresh cell still causes no
network request; a matching stale cell renders immediately while refreshing;
failure retains the stale labelled map.

Weather, news, location, and map failures remain isolated.

## Canvas layout

Project label anchors with the existing local tangent-plane projection.
Labels are horizontal for G2 readability; no street-name rotation is added.

The layout uses a deterministic greedy collision pass:

- maximum 10 visible labels;
- transit and place labels use 14px white bold text;
- road and landmark labels use 12px secondary text;
- a black rectangular patch sits behind each label;
- text is shortened by HUD display units before measuring;
- labels remain inside `x=18..270`, `y=34..244`;
- a protected box around the current-position arrow rejects overlapping
  labels;
- accepted label boxes include four pixels of collision spacing.

Paint order is:

1. frame and source header;
2. minor roads;
3. major roads;
4. accepted labels;
5. active route;
6. current-position arrow;
7. footer and OSM attribution.

The route and position therefore remain visually dominant. If the map is
unavailable, retain the existing `SCHEMATIC` fallback and do not invent labels.

## Transport and performance

The left map refresh continues to request only left tile IDs `2/4`. Page
scrolling continues to send right tile IDs `3/5`; it does not rerun the label
query or relayout the static left panel. Full transfer order remains
`3/5/2/4`, SDK remains `0.0.11`, and double-tap black hide/restore remains
unchanged.

The response caps, candidate caps, and 10-label render cap bound CPU, storage,
and Canvas work independently of local OSM density.

## Failure behavior

- Overpass or label normalization failure: use a matching stale labelled map,
  otherwise show the current schematic fallback.
- No valid label candidates: draw live roads without labels.
- Individual malformed candidates: reject the normalized server response
  rather than painting untrusted or inconsistent text.
- Label collision: skip the lower-priority label; never overlap the position
  exclusion box.

## Verification

All test commands run serially.

Automated coverage must verify:

- the bounded Overpass query and fixed feature allowlist;
- Korean-name preference, sanitization, deduplication, priority, and caps;
- client parsing and versioned cache behavior;
- 10-label render cap, viewport bounds, collision rejection, and arrow
  exclusion;
- labels painted after roads and before route/position;
- unchanged map refresh target, page speed contract, bilateral transport,
  double-tap restore, and OSM attribution.

The physical `map-labels-015` checkpoint must confirm recognizable nearby
names, readable density, unchanged scroll speed, bilateral output, and
double-tap hide/restore.

## Physical size revision

The `map-labels-015` checkpoint confirmed that labels were present and visible,
but the user requested approximately 1.5 times larger type for comfortable
reading. The approved revision rounds `9 x 1.5` to 14px for transit/place and
uses exactly `8 x 1.5 = 12px` for road/landmark labels.

The collision layout uses measured label dimensions. Larger text therefore reduces the number of accepted lower-priority labels instead of allowing overlap.
The limit remains a maximum of 10, with no minimum.
The revised physical checkpoint is `map-labels-large-016`.
Scale ASCII fallback-name widths with the font size so Latin road names do not retain the old 8px collision area.
