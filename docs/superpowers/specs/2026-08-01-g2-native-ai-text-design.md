# Native Ask AI Text Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

## Goal

Replace image-tile retransmission inside the Ask AI detail deck with one
official Even Hub text container. Realtime user transcription and assistant
output must appear together, follow the latest text automatically, and retain
the existing manual history, pause, and back interactions.

## Selected approach

Ask AI detail mode becomes a native text-only page containing exactly one
full-screen `TextContainerProperty`. Entering the detail deck rebuilds the
current page once. Realtime changes then call `textContainerUpgrade` on that
same container without encoding or sending Canvas images. Returning to the
dashboard rebuilds the established image-container page and sends the current
Canvas frame once.

This is preferred over a Canvas/text overlay because it avoids z-order and
stale-background synchronization. It is preferred over several text
containers because the SDK has a large fixed cost per update call; one
container gives the lowest streaming latency.

## Native page

The page uses one event-capturing text container over the full 576 x 288 G2
area. Its content includes a compact phase/page header, the selected combined
conversation page, and localized input hints. The existing renderer-independent
AI transcript pages remain the source of truth, so no Realtime, history, or
usage-accounting data model changes are required.

Official SDK font metrics and wrapping are accepted for this experiment. The
content formatter applies conservative line and character bounds before every
update so an unexpectedly long response cannot overflow the container payload.

## Streaming and refresh policy

Sample changing transcript state at most once every 100 ms.
Do not queue individual deltas.
If a native update is in flight, drop the new attempt.
A later Realtime delta reads the newest full snapshot.
On a terminal protocol event, send one final update so the completed answer does not remain truncated.

While native AI mode is active, normal live-data refresh requests continue to
update application state but do not encode or send image tiles. The latest
state is drawn and transmitted when the user returns to the dashboard.

## Input and lifecycle

- Dashboard tap on Ask AI: rebuild the native page, display the current
  transcript, then start the microphone/session.
- Realtime delta: update the one native text container.
- Scroll: select an older/newer transcript page and update the same container.
- Tap: pause/resume the Realtime session and update the same container.
- Double tap: stop and persist the session, rebuild the normal Canvas page,
  and transmit the current frame once.
- Display hide/restore remains owned by the existing dashboard transport and
  is not invoked while the AI detail page handles double tap as Back.

If native-page entry fails, remain on the dashboard and do not start the microphone.
If a text update fails, report the failure. A later state change may attempt another update.
If Canvas restoration fails, keep the transport in native mode.
This prevents image refreshes from using mismatched container IDs.

## Verification

- Pure formatter tests cover combined roles, status, history selection,
  localization fallback, and payload bounds.
- Transport tests prove entry rebuilds once, streaming calls only
  `textContainerUpgrade`, live image refreshes are suppressed, scroll/tap use
  native text, and double tap restores the image page once.
- Scheduler tests prove progressive 100 ms sampling, no backlog, and terminal
  final refresh.
- Existing Canvas transport, Realtime, storage, i18n, package, and Sites gates
  remain green.
