# G2 Minute Clock, Moving Map, and Battery Refresh Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

Date: 2026-07-27
Status: Approved
Target route: `/hud-canvas-fast`

## Goal

Keep the hardware-proven fast Canvas HUD current while it remains open:

- advance the `HH:MM` clock at each minute boundary;
- follow meaningful movement on the left map;
- replace the displayed battery value when the connected device reports a
  different percentage or charging state;
- preserve strict serial G2 image transfers, fast page navigation, and the
  double-tap black display toggle.

This document amends the clock, battery, continuous-location, and map-cell
sections of
`docs/superpowers/specs/2026-07-27-g2-live-data-design.md`. Other provider,
rendering, cache, and optional-routing decisions remain unchanged.

## Approved behavior

The user approved minute-aligned clock refresh and movement-aware map refresh,
then explicitly added battery-change refresh. The SDK exposes a device-status
event, so battery updates use that event instead of the initially proposed
60-second polling. This is more responsive while avoiding unnecessary bridge
queries.

## Refresh targets

The existing `576 x 288` source Canvas and four G2 image containers remain:

| Content change | Image containers |
| --- | --- |
| Minute clock | right-top ID `3` |
| Visible overview battery | right-top ID `3` |
| Accepted location or map geometry | left IDs `2`, `4` |
| Page navigation | right IDs `3`, `5` |
| Hide or restore | full right-first IDs `3`, `5`, `2`, `4` |

Add `right-top` as an external refresh target.
If clock or battery refresh and left-map refresh arrive during another send, the existing latest-state queue may combine them as `all`.
Keep every image update serial. Timers and SDK callbacks must not send images directly.

## Clock lifecycle

The source Canvas still formats time only while drawing. A small scheduler:

1. computes the delay to the next exact local minute boundary;
2. requests `right-top`;
3. schedules the next boundary again from the current time to avoid interval
   drift;
4. cancels its pending timeout during React effect cleanup.

The scheduler never sends seconds. If the display is black, the transport
suppresses the image request. Restore redraws the Canvas with the newest time
before sending the four current tiles.

## Battery lifecycle

The initial `getDeviceInfo()` snapshot remains the source of the device model
label (`G2`, `G1`, or `R1`) and serial number. After the initial HUD transfer,
the fast transport subscribes to `onDeviceStatusChanged()`.

A status event is accepted only when:

- it belongs to the initial device serial number;
- the normalized battery percentage or charging state differs from the last
  accepted value.

Retain the new value in App state.
When `OVERVIEW` is visible, App requests `right-top` to redraw the clock and battery together.
On other pages, retain the state without sending images. Render it on the next navigation to `OVERVIEW`.
Missing initial device information, foreign serial numbers, duplicate values, and event failures must neither blank the HUD nor trigger transfers.

The device-status subscription is removed exactly once during transport
cleanup.

## Location lifecycle

The one-shot medium-accuracy location remains the startup fallback gate. Once
the dashboard session has resolved it, the session uses the official SDK
continuous-location API:

```ts
{
  accuracy: AppLocationAccuracy.Medium,
  intervalMs: 15_000,
  distanceFilter: 15,
}
```

The client also checks coordinates and applies a 15-meter Haversine threshold
against the last accepted fix. This protects against hosts that emit more
frequently than requested. Each accepted fix:

1. replaces and persists only the latest location;
2. requests a left refresh so the existing map geometry is reprojected around
   the new position;
3. requests new OSM geometry only when the new map cell differs.

No movement history is retained. Invalid fixes and movement below 15 meters
are ignored. Dashboard disposal unsubscribes from location events and calls
`stopAppLocationUpdates()` once. If continuous updates are unsupported or
fail to start, the one-shot startup location remains usable.

## Map refresh distance and failure behavior

Change the map cell from `0.005` degrees to `0.0018` degrees.
Around Seoul, this spans approximately 159 meters east-west and 200 meters north-south.
That matches the approved 150–200-meter geometry refresh interval while retaining a stable server cache key.

The Overpass query radius remains 650 meters. Movement within a cell redraws
only the left tiles against cached geometry; crossing a cell requests a new
bounded map. Server and client cache identities advance together so old and
new cell formats cannot be confused.

When a new-cell Overpass request times out or fails, the last valid map is kept
as stale and reprojected around the latest accepted fix. A map failure never
replaces visible geometry with a blank map.

## Visibility and black-display behavior

This feature does not bypass the existing display state:

- external clock, battery, and location refresh requests are suppressed while
  the G2 display is black;
- live state may continue to advance;
- double-tap restore redraws once from the latest time, battery, location, and
  map state;
- scroll remains ignored while hidden.

The dashboard and transport cleanup paths cancel all timers, SDK event
subscriptions, and continuous-location updates so no late callback can encode
or send a tile.

## Failure isolation

- Clock scheduler failure cannot stop paging or live providers.
- Device lookup or status failure keeps the last battery value or
  `BATTERY --`.
- Continuous-location startup failure keeps the startup fix.
- A malformed location event is ignored.
- OSM failure keeps the last valid map as stale.
- `SENDFAILED` releases the existing serialized queue for later refresh or
  restore attempts.

## Automated verification

Tests must prove:

- exact delay calculation and repeated minute re-alignment;
- clock refresh targets only image ID `3`;
- duplicate, foreign-device, and unchanged battery events send nothing;
- changed battery percentage and charging state update App state and request
  ID `3` only when `OVERVIEW` is visible;
- the device-status subscription is cleaned up;
- continuous location starts with the exact 15-second/15-meter options;
- invalid and sub-15-meter fixes are ignored;
- accepted fixes persist the latest value and request IDs `2`, `4`;
- a changed map cell requests geometry while same-cell movement does not;
- failed new-cell geometry retains the prior map as stale;
- cleanup stops and unsubscribes location exactly once;
- hidden refresh suppression and newest-state restore still pass;
- all project tests, typecheck, build, Sites tests, and map API tests run
  serially and pass.

## Hardware checkpoint

The hardware build must confirm:

- the clock advances after crossing a minute boundary without scrolling;
- a real battery percentage change appears without reopening the app;
- walking movement shifts the map while labels and roads remain readable;
- no simultaneous transfer or `SENDFAILED` appears;
- bilateral output, page speed, and double-tap hide/restore remain intact.

