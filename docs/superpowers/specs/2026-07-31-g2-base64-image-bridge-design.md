# G2 Base64 Image Bridge Experiment Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

Date: 2026-07-31

Status: Approved design; awaiting written-spec review

## Goal

Measure whether reducing WebView-to-Even-App JSON expansion improves physical
G2 image refresh latency. The experiment changes only the representation of
`ImageRawDataUpdate.imageData` at the JavaScript bridge boundary.

## Context

The SDK accepts `number[]`, Base64 `string`, `Uint8Array`, or `ArrayBuffer` as
image data. Its current `Uint8Array` path normalizes bytes to `number[]` before
calling the Flutter WebView handler. A Base64 string remains a string and keeps
the same SDK `compressMode: 2` host contract.

The supplied hardware logs show that four image calls enter the in-flight
state together but settle progressively. This experiment can measure and
possibly reduce WebView serialization overhead. It cannot change native LZ4,
BLE packet scheduling, acknowledgments, or glasses firmware behavior.

## Alternatives considered

### Fork and edit the obfuscated npm bundle

Rejected for the first experiment. It creates a package-maintenance burden and
makes rollback harder before proving that representation affects hardware
latency.

### Add a local bridge adapter

Selected. A small typed adapter converts encoded bytes immediately before
constructing `ImageRawDataUpdate`. It preserves the installed SDK, isolates the
experiment behind a query parameter, and can later become a package patch only
if the hardware result passes.

### Add a native batch-image method

Deferred. A real `updateImageRawDataBatch` method could remove more bridge and
acknowledgment overhead, but it requires support in the Even App and possibly
the firmware. A Web plugin cannot introduce that host method by itself.

## Controlled routes

The query-free route remains the production control and resolves to the
existing array representation.

```text
Control:   /hud-canvas-fast?sdk=0.0.13&pipeline=4&format=png&bridge=array
Candidate: /hud-canvas-fast?sdk=0.0.13&pipeline=4&format=png&bridge=base64
```

Missing, empty, or unknown `bridge` values resolve to `array`. Only the literal
`bridge=base64` enables the candidate.

Both routes retain:

- SDK `0.0.13` and minimum Even App `2.2.6`;
- four-level Canvas PNG content;
- four 288×144 image containers;
- pipeline four and the existing tile order;
- unchanged-tile skipping;
- immediate busy-drop behavior with no queue, merge, retry, or replay;
- the same timeouts and success criteria.

## Data flow

The Canvas encoder continues to return one `Uint8Array` per target tile.

For `array`, the adapter passes the `Uint8Array` to the SDK exactly as today.
The SDK normalizes it to `number[]` during `toJson()`.

For `base64`, the adapter converts the bytes to a Base64 string without
changing the PNG payload. It then passes that string to
`ImageRawDataUpdate.imageData`. No decoded pixel data, tile geometry, palette,
or compression flag changes.

The Base64 conversion must work in bounded chunks rather than spreading a
large byte array into one function call. This avoids argument-count limits and
keeps behavior deterministic for all current tile sizes.

## Diagnostics

Each encode or refresh trace must identify the selected bridge mode. It must
also report the exact representation length before the host call:

- `array`: the character length of the JSON array value, calculated without
  allocating a second JSON string;
- `base64`: the Base64 string length;
- total encoded PNG bytes remain in the existing encode diagnostic.

Tile start, success, failure, timeout, in-flight count, and complete-refresh
durations remain unchanged so the new logs are directly comparable with the
existing hardware records.

## Error handling

Base64 conversion failures fail the accepted refresh immediately. They are not
retried and are never queued. A native `sendFailed`, timeout, or unsupported
string payload also remains a failed refresh; the next independent input may
try again.

The control route must remain available for immediate rollback.

## Automated verification

All tests run serially.

- The resolver enables only literal `bridge=base64`.
- Missing and invalid values select `array`.
- Known byte sequences produce the expected Base64 text.
- Chunk boundaries preserve exact byte order.
- Array and Base64 representation-length diagnostics are exact.
- Array mode passes the original `Uint8Array` to the SDK model.
- Base64 mode passes a string while preserving container ID and name.
- Query parsing reaches the fast transport without affecting other routes.
- Existing tile order, skip cache, busy-drop, timeout, and failure tests stay
  green.

## Physical gate

Run the two routes serially on the same phone, Even App, G2 firmware, battery
range, page, and content state. Allow one warm-up per route, then collect at
least five of each:

1. four-tile restore;
2. two-tile dashboard transition;
3. four-tile detail entry or exit;
4. hide, confirming the candidate does not regress the minimal black frame.

Pass the Base64 candidate only if every condition holds.
Both eyes and all quadrants must display correctly.
No `sendFailed`, timeout, or WebView freeze may occur.
Median content refresh must improve beyond ordinary run-to-run variation.
A smaller bridge representation alone does not pass.

## Decision rule and rollback

Until the physical test passes, keep `array` as the default.
If Base64 is not meaningfully faster, retain it only as an explicit diagnostic or remove the adapter.
If Base64 is faster and stable, promote the adapter in a separate change.
Preserve `bridge=array` for rollback.

This experiment does not use native SDK text, add display layers, or change the
accepted Canvas HUD design.
