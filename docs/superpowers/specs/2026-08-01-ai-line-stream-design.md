# Ask AI Line Stream Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

## Goal

Make the native Ask AI detail view read like a plain, live transcript rather
than a custom dashboard. The glasses should show recognized speech
immediately, reveal assistant text at a stable human-readable cadence, and
move through history one wrapped line at a time.

## Approved interaction

- Remove the Ask AI title, phase header, frame, counters, page labels, and
  footer instructions from the detail view.
- Before speech exists, show only the active locale's short `Listening…`
  message. Configuration and runtime errors remain visible because they are
  actionable.
- Keep recognized user speech authoritative and immediate.
- Buffer the assistant's authoritative Realtime text and expose one Unicode
  grapheme every 250 ms. New upstream deltas replace the pending target rather
  than forming a replay queue.
- Wrap the chronological transcript into individual lines. The latest view
  follows the newest line automatically; each scroll gesture moves the
  selected end line by exactly one line. There is no transcript page model or
  page counter.
- Let wrapped transcript text use the full native container width. Insert one
  blank display row at a speaker transition, but do not include that row in
  the semantic transcript or make it a scroll target.
- Insert the same display-only blank row immediately before a trailing
  localized `Listening…` status when transcript content precedes it.
- A normal tap flushes a completed response immediately. If generation is
  active, it cancels that Realtime response, reveals only the partial text
  already received, and returns to listening without closing the microphone.
  Double tap remains the only exit and still stops the microphone/session
  before restoring the Canvas dashboard.

## Presentation and transport

Follow the buffering model of Vercel AI SDK `smoothStream`.
Leave upstream generation unthrottled and release bounded presentation chunks at a configured delay.
Sandevistan already receives OpenAI Realtime events through its own WebSocket.
Importing the full Vercel AI SDK only for this transform would duplicate transport code and increase the WebView bundle.
Use a small local grapheme pacer for the relevant behavior.

The 250 ms clock controls presentation. It does not queue SDK calls.
For each assistant grapheme, wait for the native `textContainerUpgrade` acknowledgement before starting the next delay.
This prevents slow bridge calls from accumulating a backlog or freezing the WebView.
If an update is in flight, serialize tap flush behind it.
Then replace all pending presentation work with one update to the newest target.

## Data model

- Replace `transcriptPages` with `transcriptLines` on `AiHudSnapshot`.
- Replace the detail view's `aiPage`/`aiPageCount` state with
  `aiLine`/`aiLineCount` while retaining `aiFollowsLatest`.
- Build role-prefixed wrapped lines once, then localize only the role prefixes.
- Native Text and Canvas fallback views select a rolling viewport ending at
  `aiLine`; the native view reserves one final line for `Listening…` only when
  the latest transcript is selected and the runtime is listening.

## Verification

- Fake-timer tests prove one grapheme per 250 ms, including composed emoji.
- Transcript tests prove chronological line output without six-line pages.
- View reducer tests prove one-line scroll and latest-follow behavior.
- Native and Canvas tests prove the decorative UI is absent and localized
  listening/transcript content remains.
- Run the complete unit suite, typecheck/build, package build, and Sites worker
  tests before promotion.
