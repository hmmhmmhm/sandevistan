# G2 WebView Operation Console Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

> **Legacy evidence:** Historical RELIC names, paths, storage keys, and
> transport identifiers in this record are preserved exactly as they appeared at
> the time. Current main-branch identifiers use Sandevistan.

Date: 2026-07-27  
Branch: `feature/g2-ors-routing`  
Status: APPROVED

## Goal

Add a diagnostic console only to the phone WebView.
Show the running Sandevistan operation, its start and finish times, and its duration.
If the WebView later freezes, these records identify the last successful boundary without relying on glasses behavior.

The console must not appear in the 576×288 glasses Canvas or trigger an Even Hub
image update.

## Evidence

- The fast HUD works initially and slows down even when the user does not
  interact with it.
- Eventually the entire phone WebView becomes unresponsive after the glasses
  reports a completed hide operation.
- A hidden-input callback cannot update the phone status after the freeze.
- Frequent image transmission is only one hypothesis. Continuous location
  callbacks, native storage calls, Promise queues, Canvas encoding, native image
  calls, timers, or main-thread stalls could produce the same symptom.

The next build therefore observes every relevant boundary without changing
refresh frequency or gesture behavior.

## Architecture

### Bounded diagnostic log

Create `src/diagnostic-log.ts` as a dependency-free, session-scoped logger.
Every entry contains:

- a sequence number;
- a wall-clock timestamp formatted as `HH:mm:ss.SSS`;
- one fixed category;
- a concise message;
- an optional duration in milliseconds.

The allowed categories are:

`APP`, `INPUT`, `LOCATION`, `STORAGE`, `LIVE`, `REFRESH`, `ENCODE`, `TILE`,
`TIMER`, and `ERROR`.

The logger stores only the newest 300 entries. Appending the 301st entry removes
the oldest entry and increments a dropped-entry counter. It never stores an
unbounded Promise, callback, payload, Canvas, byte array, location coordinate,
news body, or storage value.

The logger exposes append, snapshot, clear, and version operations. Production
code imports the append function directly so operation boundaries can be
recorded without threading callbacks through every layer.

### Phone console component

Create `src/DiagnosticConsole.tsx` and render it only on
`/hud-canvas-fast`, directly below the phone HUD preview and before route
controls.

The component:

- polls the logger version every 250ms;
- updates React state only when the version changes;
- renders all visible lines as one `<pre>` text node;
- automatically scrolls to the newest line;
- displays retained and dropped counts;
- provides `CLEAR` and `COPY` buttons;
- stops its timer during unmount.

The 250ms poll caps UI work at four renders per second even if a native callback
floods the logger. A single text node avoids creating hundreds of React child
elements on every update.

`COPY` copies the current bounded snapshot. A clipboard failure is recorded as
an `ERROR` entry and leaves the console usable.

### Heartbeat and global errors

The fast HUD starts a five-second heartbeat. Each callback records the expected
interval and actual event-loop delay. A delayed callback records the size of the
stall once the WebView resumes.

The app also observes `window.error` and `unhandledrejection` while mounted and
records a sanitized error name/message. Both listeners and the heartbeat are
removed during cleanup.

## Instrumented boundaries

### App and timers

- fast HUD effect start and cleanup;
- initial bridge and live-session readiness;
- minute callback;
- battery change accepted or ignored;
- live snapshot target received;
- view mode and page changes;
- heartbeat and event-loop delay.

### Even Hub input and raster transport

- raw input type/source and current hidden state;
- operation queued, started, completed, or failed;
- display hide/restore start and completion;
- external refresh request, target merge, start, and completion;
- Canvas encode start/completion with target tile count and duration;
- each `updateImageRawData` start/result/completion with tile name and duration.

Image bytes and bridge payloads are never logged.

### Live location and storage

- raw location callback count and reported accuracy/speed availability;
- location queue start;
- invalid or below-threshold rejection;
- accepted movement distance and chosen refresh target;
- map refresh start/completion;
- persistence start/completion/failure;
- cache read/write/clear key and duration.

Coordinates, cache values, TODO text, route destinations, and news content are
never logged.

### Live providers

- weather, news, and map refresh start;
- cache hit/stale/unavailable outcome;
- fetch completion or timeout;
- emitted refresh target.

Network response bodies are never logged.

## Log format

Examples:

```text
[22:31:08.427] #0042 [LOCATION] ignored · movement 4m · threshold 15m
[22:31:10.103] #0043 [REFRESH] request left · pending left
[22:31:10.112] #0044 [ENCODE] start · 2 tiles
[22:31:10.184] #0045 [ENCODE] complete · 2 tiles · 72ms
[22:31:10.185] #0046 [TILE] relicTL start
[22:31:10.371] #0047 [TILE] relicTL success · 186ms
[22:31:13.430] #0048 [TIMER] heartbeat · drift 3ms
```

## Error behavior

Logging is observational and must never break app behavior. Every logging call
is synchronous, payload-free, bounded, and non-throwing. Clipboard, global
error, and formatting failures degrade to an `ERROR` line when possible.

The console does not attempt to recover a frozen WebView. Its purpose is to
leave the last completed boundary visible and quantify callback rates before
the freeze. Recovery remains a manual WebView refresh until the measured root
cause is fixed.

## Verification

Automated tests will prove:

- timestamps include hour, minute, second, and millisecond;
- the buffer retains only the newest 300 entries and counts dropped entries;
- clear resets retained entries without leaking subscribers or timers;
- the component renders one console text block and refreshes no more frequently
  than 250ms;
- copy contains the bounded formatted snapshot;
- heartbeat reports event-loop drift and stops during cleanup;
- representative location, storage, encoding, tile, refresh, input, and error
  boundaries produce the expected categories;
- logging creates no additional Canvas encode or image update call.

Type checking, production build, focused diagnostic tests, and the full serial
test suite must pass. The final gate is leaving the physical G2 app idle until
the slowdown begins and reporting the last visible console lines.

## Scope

This step adds bounded observation only. It does not throttle location, change
image frequency, alter input ordering, rebuild containers, change live provider
semantics, or attempt automatic recovery.
