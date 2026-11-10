# G2 Hidden Input Diagnostic Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

Date: 2026-07-27  
Branch: `feature/g2-ors-routing`  
Status: APPROVED

## Goal

Identify why ring and glasses controls stop responding after fast Canvas HUD reports `HUD display completed`.
Do not add another image transfer or change the approved black-frame hide interaction.

## Evidence and boundary

- The hide operation reaches its completion message, so the four-tile black
  transfer is not the operation currently blocking the JavaScript queue.
- While hidden, normal tap and scroll input are intentionally ignored.
- A double tap should remain accepted and restore the HUD, but neither the ring
  nor the glasses restores it.
- The unresolved boundary is therefore whether the hidden-state double-tap
  event reaches the WebView at all or reaches it in an event envelope that the
  current input normalizer does not recognize.

## Diagnostic behavior

Add an optional raw-event diagnostic callback to the fast Canvas transport.
Run it synchronously at the start of the existing `onEvenHubEvent` listener.
Run it before hidden-state filtering or input normalization.

The callback receives a compact, immutable snapshot containing:

- whether the Canvas HUD is currently hidden;
- the raw `sysEvent.eventType`;
- the raw `textEvent.eventType`;
- the available system event source;
- a monotonically increasing event count for the transport session.

The app will use this callback only while the HUD is hidden. It will update the
phone WebView status with a compact message such as:

`Hidden input #3 · SYS 3 · TEXT - · SRC 2`

The callback must not draw the Canvas, encode a tile, request a live refresh, or
call any Even Hub bridge method. The glasses remain fully black during the
diagnostic.

## Interpretation

- If the phone status changes after a hidden-state double tap, the SDK event
  channel is alive. The captured fields identify the normalization or
  hidden-state routing defect to fix.
- If the phone status remains `HUD display complete`, the event does not reach the
  WebView. The follow-up fix will bound/coalesce pre-hide image work and input
  work so the native event channel is not saturated before entering hidden
  mode.

## Verification

Automated tests will prove that:

- raw event diagnostics run before an event is discarded in hidden mode;
- the snapshot preserves omitted event types rather than converting them to a
  click;
- diagnostic reporting causes no additional image encoding or transmission;
- cleanup prevents later diagnostic callbacks.

Before serving the diagnostic, pass type checking and the focused transport test.
Use the existing single Tailscale development server.
For the final hardware check, double-tap once from the ring or glasses while hidden.

## Scope

This step adds observation only. It does not change gesture semantics, queue
ordering, tile ordering, live refresh behavior, or the black-frame renderer.
The diagnostic hook will be removed or disabled after the failing boundary is
identified.
