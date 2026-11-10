# G2 No-Queue Refresh Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

## Background

During a physical-glasses test, minute-refresh callbacks fired repeatedly at
the same timestamp, producing more than 13,000 transport operations and
129,000 diagnostic log entries. At the same time, location events continued to
join a Promise chain while map requests took 6–7.5 seconds, pushing the pending
count above 50. Tile transport was slow but did complete. The WebView freeze
came from retaining refresh requests and location work for future execution.

## Core principles

Apply these rules to every event and refresh path:

- Queue 0: never retain new work behind an operation that is already running.
- Merge 0: never combine multiple refresh targets into a later operation such
  as `all`.
- Retry 0: never re-run a failed operation internally.
- Fail fast when busy: immediately drop a new request if another operation is
  running.
- Prefer the next event: only an event that arrives after the current operation
  succeeds or fails may start a refresh.
- Drop while hidden: a screen refresh received while the HUD is black creates
  no work and is discarded immediately.

The four G2 tiles within one accepted image refresh still transmit serially.
That sequence is a protocol-level transport procedure, not a queue for events
or refresh requests.

## Screen refresh coordination

Remove the Promise task chain and pending refresh target from
`fast-canvas-transport`. Keep one `busy` state instead.

1. An input, live-data, battery, minute-refresh, or restore request arrives.
2. If the HUD is hidden or the transport is `busy`, finish the request
   immediately with `hidden` or `busy`.
3. If idle, set `busy` and execute that one request.
4. Clear `busy` whether the request succeeds or fails.
5. Do not retain or reschedule a failed request.

Taps and scrolls are not retained during transport either. They are considered
again only when the user produces a new input event. Old input therefore cannot
change the screen later.

## Minute clock refresh

Replace the recursive `setTimeout` scheduler with one `setInterval` watcher. It
checks the current wall-clock minute key and allows at most one callback for
that minute. If the SDK delivers overdue timer callbacks in a burst, duplicate
minute keys are ignored without creating another timer.

After each successful screen transport, record `lastSuccessfulDisplayMinute`.
When the minute watcher runs, check whether any screen transport already succeeded during that minute.
If one succeeded, do not request another clock refresh.
Count successful transports from weather, location, battery, input, or any other cause.

If the minute refresh is dropped because the transport is busy or hidden, or
if its transport fails, do not retry during the same minute. A later independent
location, input, or battery event will render the current time as part of its
normal frame.

## Location and live data

Remove the `locationQueue` Promise chain. If a new location arrives while
another location is being processed, do not retain even the newest value;
discard it immediately as `busy`. Process only the first new location that
arrives after the current operation finishes.

Apply the same rule to map, weather, and news providers.
If a provider request is running, drop new requests for that provider instead of chaining them.
Apply the running request's result. If it fails, leave the provider in a failed state.
Only a later external event may start a new request.

Do not accumulate locations while location processing waits for a map refresh.
Storage operations record their failure but never retry automatically.

## Hide and restore

While the HUD is hidden, independent work already in progress may update live
state in memory, but it must not create a glasses transport request. When a
restore input arrives while idle, render the latest state once as a complete
frame. If restore transport fails, remain hidden and do not retry
automatically.

## Diagnostic log

Record these outcomes explicitly:

- `accepted`, `busy`, `hidden`, and `failed`
- The operation type and elapsed time
- `already rendered this minute` when a minute refresh is skipped
- `busy drop` for a discarded location event

Pending-count and merge-target entries disappear because those structures no
longer exist. Keep the diagnostic console capped at its latest 300 lines.

## COPY fallback

Use the Clipboard API first when it is available in a secure context. If it is
unavailable or fails, insert a temporary `textarea`, select the complete log,
call `document.execCommand("copy")`, and then remove the element. Briefly show
success or failure on the button.

If both methods fail, display `COPY FAILED` and record only the error category
in the diagnostic log.

## Test criteria

- Thousands of timer callbacks for one minute produce at most one minute
  refresh.
- A minute refresh does not run when another screen transport already succeeded
  during that minute.
- A failed minute refresh is not retried automatically during the same minute.
- Input and external refreshes received during transport never run later.
- Refreshes received while hidden create no transport operation.
- A location received during location processing is neither stored nor handled
  later.
- A failed map request has no internal retry; only the next new location event
  may start another request.
- COPY fallback succeeds in an HTTP WebView without the Clipboard API.
- Existing four-tile serial transport, binocular display, hide, and restore
  behavior remain intact.
- The complete test suite runs on one worker without file parallelization.
