# G2 Base64 Image Bridge Hardware Gate

> Historical record: Scope and results apply to the stated date and versions.
> See the [documentation index](../index.md) for current behavior.

Date: 2026-07-31

Status: Physical failure confirmed; candidate rejected

## Goal

Compare end-to-end G2 refresh latency for Base64 strings and the current `Uint8Array` path. Send the same encoded PNG bytes through Even Hub SDK `0.0.13`. This experiment changes only the JavaScript value
passed to `ImageRawDataUpdate.imageData`.

## Tested routes

```text
Array:  /hud-canvas-fast?sdk=0.0.13&pipeline=4&bridge=array
Base64: /hud-canvas-fast?sdk=0.0.13&pipeline=4&bridge=base64
```

The query-free route was identical to `bridge=array` during the experiment.
Both routes used:

- SDK `0.0.13` and Even App `2.2.6` or later.
- Four 288×144 image containers over the same 576×288 Canvas frame.
- Four-level grayscale PNG content tiles.
- A four-call bounded image pipeline.
- Right-top, right-bottom, left-top, left-bottom start order.
- Unchanged-tile skipping and immediate busy-drop behavior.
- No refresh queue, replay, retry, native text, or extra SDK layer.

## SDK contract finding

SDK `0.0.13` declares `ImageRawDataUpdate.imageData` as accepting
`number[] | string | Uint8Array | ArrayBuffer`. However, the SDK comments for
this update recommend `number[]`, and the official image example uses a number
array. A direct serialization check showed that the SDK converts typed bytes to a number array. It passes a Base64 string unchanged to the native host.

The hardware result proves that the current Even App image-update host does
not accept that string form. All four Base64 calls returned `sendFailed` in
3–4 ms, before an image transfer could begin. This is a host-contract mismatch,
not a Base64 conversion or image-compression failure.

## Physical result

The candidate startup trace reported:

```text
[ENCODE] ... bytes 4315/3124/2647/2860 · total 12946
[BRIDGE] mode base64 · chars 5756/4168/3532/3816 · total 17272
[ERROR] sandevistanTR failed · sendFailed · 4ms
[ERROR] sandevistanBR failed · sendFailed · 3ms
[ERROR] sandevistanTL failed · sendFailed · 3ms
[ERROR] sandevistanBL failed · sendFailed · 3ms
[ERROR] app startup failed · Error
```

The string representation was 4,326 characters larger than the encoded binary payload, a 33.4% representation expansion. No tile became visible, and startup failed immediately. No refresh-latency comparison was possible.

## Decision rule

The candidate failed the required zero-`sendFailed` gate and is removed from
normal operation. The stable path remains encoded `Uint8Array` input, which the
SDK serializes to the supported number-array representation. There is no automatic fallback, replay, retry, or queue. A failed refresh remains failed. A later independent event may request another refresh.

## Result

| Metric | Array control | Base64 candidate | Change |
| --- | ---: | ---: | ---: |
| Full refresh median | Established hardware baseline | Not measurable | Rejected |
| Two-tile page median | Established hardware baseline | Not measurable | Rejected |
| Restore median | Established hardware baseline | Not measurable | Rejected |
| Hide median | Established hardware baseline | Not measurable | Rejected |
| Representative payload | 12,946 encoded bytes | 17,272 Base64 characters | +33.4% |
| `sendFailed` / timeout | No failure in accepted baseline | 4 / 0 | Failed gate |

## Repository outcome

- The `bridge=base64` production branch and QR command were removed.
- A stale `bridge=base64` query is ignored and uses the stable transport.
- The query-free SDK `0.0.13`, PNG, four-level palette, pipeline-four route
  remains the default.
- This record and the original design document remain as evidence of the
  rejected experiment.
