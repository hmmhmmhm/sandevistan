# G2 LZ4-Friendly BMP Experiment Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

Date: 2026-07-31

Status: Physical comparison complete; rejected as a speed default

## Goal

With SDK `0.0.13`, compare four-tile HUD transmission using a simple 1-bit BMP and the current four-level Canvas PNG.
Measure whether BMP is faster.

## Controlled comparison

The default `/hud-canvas-fast` route remains the control. The experiment is
enabled only with `format=bmp1`.

Both modes retain:

- SDK `0.0.13` and Even App `2.2.6`;
- the 576×288 source Canvas and four 288×144 image containers;
- full-frame order `3/5/2/4` and two-tile page updates `3/5`;
- four image calls in flight;
- four-level source quantization before content encoding;
- unchanged-tile skipping, busy-drop behavior, timeout, and no retry queue.

The only content-path difference is the final file encoder:

- control: browser PNG;
- experiment: uncompressed 1-bit BMP, then the SDK's internal LZ4 path.

The generated solid-black hidden frame keeps the current original PNG encoder
in both modes. This prevents hide latency from contaminating the content and
restore comparison.

## Encoding

Convert the temporary tile's RGBA pixels to a monochrome mask with deterministic grayscale luminance.
Set values at or above 128 to white and lower values to black.
Then use the bottom-up 1-bit BMP encoder already verified on hardware.

The source Canvas is never modified. The phone preview therefore remains
unchanged.

## Diagnostics

Every encode completion reports:

- palette mode;
- file format, `png` or `bmp-1`;
- encoder output bytes per tile and total;
- existing encode and end-to-end refresh durations.

The SDK exposes no post-LZ4 byte count, so physical end-to-end duration is the
decisive measurement.

## Physical gate

After one warm-up per URL, record at least five iterations of:

1. four-tile hide and restore;
2. two-tile page transition;
3. four-tile detail entry or exit.

Pass BMP mode only if every condition holds.
Both eyes and all quadrants must remain complete.
HUD text and map labels must remain usable.
No `sendFailed` or timeout may occur.
Median content refresh must improve enough to justify the reduced grayscale fidelity.

## Rollback

Remove `format=bmp1`. The query-free route remains the current four-level PNG
baseline without a source rollback.

## Physical decision

The serial physical comparison completed on 2026-07-31. The BMP path was
reliable, but it did not improve end-to-end image latency:

- median full four-tile refresh: 1,886 ms for BMP versus 1,645 ms for PNG;
- median four-tile restore: 1,886 ms for BMP versus 1,701 ms for PNG;
- representative full payload: 20,984 bytes for BMP versus 21,968 bytes for
  PNG;
- no `sendFailed`, timeout, frozen WebView, or stale-operation replay appeared
  in either trace.

The small payload reduction did not offset the slower physical transfer path.
Keep PNG as the query-free default and retain `format=bmp1` only as an explicit
diagnostic and regression option. The complete record is in
[`docs/hardware/2026-07-31-g2-lz4-friendly-bmp-experiment.md`](../../hardware/2026-07-31-g2-lz4-friendly-bmp-experiment.md).

This decision does not revive the earlier Canvas-background plus native-Text
hybrid. That experiment was rejected for production HUD rendering because the
SDK font, grayscale, wrapping, and placement controls could not reproduce the
accepted Canvas design. Any later static/dynamic optimization must preserve
Canvas-rendered typography unless it is isolated behind a new physical test.
