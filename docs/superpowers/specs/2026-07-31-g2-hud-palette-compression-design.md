# G2 HUD Palette Compression Experiment Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

Date: 2026-07-31

Status: Implemented; awaiting physical comparison

Branch: `experiment/g2-pipelined-transport`

## Goal

After the successful `pipeline=4` hardware trial, test whether fewer encoded PNG bytes reduce G2 image-transfer latency.
Keep the phone preview, HUD layout, SDK version, tile geometry, and refresh scheduling unchanged.

The experiment is opt-in. The existing unquantized encoder remains the
default, and `main` remains unchanged until physical G2 evidence shows a
repeatable latency improvement with acceptable legibility.

## Baseline

- SDK: `@evenrealities/even_hub_sdk` `0.0.11`
- Frame: one 576×288 Canvas encoded as four 288×144 PNG tiles
- Full-frame start order: `3 → 5 → 2 → 4`
- Experimental transport: up to four SDK image calls in flight with
  `pipeline=4`
- Canvas image smoothing is disabled, but browser font rasterization still
  creates many intermediate gray edge values.
- Tile encoding already runs concurrently with `Promise.all`.
- The main fast-HUD encoder currently sends the Canvas pixels without palette
  reduction.

The remaining candidate bottleneck is therefore the number and entropy of PNG
bytes passed through the SDK bridge.

## Selected approach

Add an opt-in transmitted-tile palette mode:

```text
?pipeline=4&levels=4
```

Immediately before PNG encoding, a tile-only pixel pass converts every pixel
to the nearest value in the hardware-proven HUD palette:

```text
0, 128, 208, 255
```

These values preserve the authored `#000000`, `#808080`, `#d0d0d0`, and
`#ffffff` hierarchy while collapsing browser-generated antialiasing shades.
The output pixel uses the selected value for red, green, and blue and remains
fully opaque.

The source 576×288 Canvas is never modified. Consequently:

- the phone WebView preview remains unchanged;
- subsequent partial-tile renders start from the original full-quality frame;
- only the payload encoded for the glasses is quantized;
- disabling the query restores byte-for-byte baseline behavior.

The literal value `4` enables the experiment. Missing, malformed, zero,
negative, or unsupported `levels` values disable quantization. The first
hardware build marker is `palette-4-039`.

## Components

### Palette mode resolver

A small pure resolver reads the `levels` query once at application startup and
returns either the four-level experimental mode or the existing unmodified
mode. It does not infer a palette from other query values.

### Tile-only quantizer

A pure pixel transformation receives RGBA bytes and the fixed palette. It:

1. derives one grayscale intensity from each source pixel;
2. selects the nearest palette value with deterministic tie handling;
3. writes that value to all three color channels;
4. writes an opaque alpha channel;
5. owns no Canvas, SDK, cache, timer, or logging state.

The tile encoder applies this transformation only to its temporary 288×144
tile Canvas when the experiment is enabled.

### Encoding diagnostics

Each encode operation reports:

- whether palette reduction is off or four-level;
- total PNG payload bytes;
- encoded bytes for each target tile in target order;
- the existing encode duration and tile count.

Transport logs continue to report per-tile and complete-refresh durations.
No additional timer or periodic diagnostic task is introduced.

## Preserved contracts

- `pipeline=1` remains the transport default.
- `pipeline=4` retains the proven maximum of four in-flight SDK calls.
- Independent refresh requests received while busy are dropped immediately.
- No request is queued, merged, replayed, retried, or retained for later.
- Tile start order, geometry, container IDs, bilateral behavior, timeout, and
  success-only payload cache semantics remain unchanged.
- Quantized bytes, rather than source Canvas pixels, are compared by the
  unchanged-tile cache while the mode is active.
- A failed encode or SDK call fails only the accepted refresh. The next
  independent event may try again.
- The SDK stays pinned to `0.0.11`.

## Alternatives

### Eight-level grayscale

This preserves more antialiased edge detail but is expected to leave more PNG
entropy. It is the immediate fallback if four-level text or map labels are not
acceptable on the physical G2.

### Indexed-color PNG encoder

A true indexed PNG may reduce structural overhead beyond Canvas `toBlob`.
However, it requires a custom encoder or dependency and another SDK compatibility check.
Defer it until ordinary four-level Canvas PNGs have measured physical evidence.

### Layered static background and small foreground image

The full raster already occupies four image containers. Adding or rearranging
a foreground container risks the proven 576×288 geometry and event-capture
contract. The previous native-text layer experiments also exposed positioning
and z-order constraints. This approach remains a later, separate experiment.

## Automated verification

All checks run serially.

- The resolver enables only literal `levels=4`.
- Missing and invalid values preserve the unmodified encoder.
- Every quantized RGB channel belongs to `0`, `128`, `208`, or `255`.
- Exact authored palette colors remain exact.
- Intermediate grayscale and colored inputs map deterministically.
- The source pixel buffer and source Canvas remain unchanged.
- The enabled encoder produces a valid PNG at the existing 288×144 geometry.
- The disabled encoder preserves the current payload behavior.
- Byte diagnostics match the actual encoded payload lengths.
- Tile order, target selection, skip cache, busy-drop, timeout, failure, and
  pipeline-one through pipeline-four tests remain green.
- Type, source, Node, Sites, build, package, repository, and SDK-version gates
  remain green.

## Physical G2 gate

Compare the current unquantized `pipeline=4` URL with
`pipeline=4&levels=4` using the same phone, Even app, glasses state, HUD
content, and action sequence.

After one warm-up refresh per mode, record five iterations of:

1. a four-tile detail transition;
2. a two-tile dashboard page transition;
3. hide and four-tile restore.

The experiment passes only when:

- all four quadrants remain complete and visible in both eyes;
- clock, weather, news body, TODO, and map labels remain comfortably legible;
- no persistent tearing, timeout, `sendFailed`, missing tile, or WebView freeze
  occurs;
- busy inputs remain dropped rather than replayed;
- total encoded bytes are lower than the unquantized baseline;
- median complete-refresh duration improves in at least the four-tile cases.

If legibility fails, test an eight-level palette in a separate revision. If
bytes fall but physical latency does not improve, retain the unquantized
encoder and stop this experiment rather than changing the default.

## Rollback

Remove `levels=4` from the URL. The baseline encoder and all transport modes
remain available without a source rollback.
