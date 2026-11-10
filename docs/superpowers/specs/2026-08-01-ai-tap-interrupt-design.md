# Ask AI Tap Interrupt Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

## Goal

In the native Ask AI detail view, let one tap immediately return control to the user.
If a completed response is still being paced, reveal it in full.
If a response is still generating, cancel it and reveal all text received so far.
Keep the microphone open for the next turn.
Change assistant presentation pacing from 500 ms to 250 ms per Unicode grapheme.

## Interaction Contract

- Dashboard tap still enters Ask AI and starts one session-scoped glasses
  microphone.
- A detail tap never closes the session or microphone.
- If the protocol is already `listening`, the tap flushes the presentation
  pacer to its newest authoritative snapshot.
- If the protocol is `thinking`, the tap sends one Realtime `response.cancel`
  event, freezes the authoritative response at the text already received,
  flushes that text, and locally returns to `listening` without waiting for a
  server round trip.
- Late deltas belonging to the cancelled response are ignored. The next user
  speech starts a normal new turn under semantic VAD.
- Double tap remains the only way to leave Ask AI, close the microphone, persist
  history and usage, and restore the Canvas dashboard.

## Architecture

`fast-hud-view` maps a detail tap to a dedicated `interrupt-ai` effect. The
input controller awaits `AiRuntime.interrupt()` and consumes the gesture without
running a Canvas redraw. The runtime decides whether the active response needs
Realtime cancellation, then asks the presentation pacer for one serialized
flush.

The pacer does not create a frame queue.
`flush()` clears the pending timer.
If a native text update is in flight, wait for its acknowledgement.
Then emit exactly one frame containing the newest complete target.
Normal streaming reveals one grapheme after the previous SDK update completes and a further 250 ms elapses.

The Realtime session exposes `cancelResponse()`.
Send `{ "type":
"response.cancel" }` only if the socket is open and the protocol has an active generating response.
Then retire that response locally to reject late output events.
This follows OpenAI's documented WebSocket interruption mechanism.
Audio truncation is unnecessary because this application requests text-only output and plays no assistant audio.

## Failure Handling

Cancellation is best-effort.
If the socket is closed or sending fails, keep the microphone and detail page open.
The runtime still flushes partial text and returns local presentation to listening.
Serialize flush behind any native update already in flight to prevent overlapping `textContainerUpgrade` calls.

## Verification

- Reducer and controller tests prove one tap triggers interruption without
  stopping the session or restoring Canvas.
- Session tests prove `response.cancel` is sent once and late deltas for the
  retired response are ignored.
- Pacer tests prove 250 ms grapheme cadence and a single acknowledgement-safe
  flush.
- Runtime tests cover completed-response flush and generating-response cancel,
  partial reveal, and listening recovery.
- The complete test suite and production build must pass before publishing.
