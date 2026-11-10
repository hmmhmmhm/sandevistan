# HUD transport

The production candidate is `/hud-canvas-fast`.
The renderer draws one 576×288 Canvas frame and divides it into four 288×144 images.
The SDK event-capture Text container stays visually blank.

## Image containers

| Name | ID | Position |
| --- | ---: | --- |
| `sandevistanTL` | 2 | Top left |
| `sandevistanTR` | 3 | Top right |
| `sandevistanBL` | 4 | Bottom left |
| `sandevistanBR` | 5 | Bottom right |

| Update | Candidate send order |
| --- | --- |
| Initial frame, restore or full-screen detail | `3 → 5 → 2 → 4` |
| Dashboard page change | `3 → 5` |
| Map change | `2 → 4` |
| Visible minute or battery change | `3` |

The transport skips a tile when its encoded bytes match the last successful send.
AI details consider all four tiles and skip unchanged images.

## Ownership and busy state

One accepted refresh owns the image transport.
Up to four calls from that refresh can be in flight.
Missing or invalid `pipeline` values resolve to four. Values `1` through `4` remain available for diagnostics.

Dashboard refresh requests do not create an encoded-image backlog.
A failed send remains failed. A later independent event can request a new frame.
Logical voice capture, release, scroll and exit events remain separate from image-send completion.
The UI can coalesce repaint requests without discarding those logical input events.
Do not interpret an SDK acknowledgement as proof that both optical displays received an image.

## Palette and format

The default content palette has four grayscale levels.
Black hide-control images use the original encoding path.
The production format remains PNG. Typed bytes remain the supported SDK bridge path.

Use `?levels=original` for the palette comparison.
Use `?pipeline=1&levels=original` for the serial comparison.
Use `?hide=black` only for the former four-black-tile hide diagnostic.

Historical physical comparisons reported these results:

| Comparison | Recorded result | Evidence |
| --- | --- | --- |
| Four-level palette | Payload decreased 54.4%. Median restore time decreased 24.8% | [Palette record](../hardware/2026-07-31-g2-hud-palette-compression.md) |
| 1-bit BMP | Reliable in the sample, but 14.7% slower | [BMP record](../hardware/2026-07-31-g2-lz4-friendly-bmp-experiment.md) |
| Base64 bridge | Four `sendFailed` results in 3–4 ms | [Bridge record](../hardware/2026-07-31-g2-base64-image-bridge-experiment.md) |
| Blank-page Hide | Median hide time changed from 394 ms to 87.5 ms, a 77.8% decrease | [Hide record](../hardware/2026-07-31-g2-fast-blank-display-experiment.md) |

These measurements apply to their recorded phones, SDKs, Even app versions and procedures.
They are not current-SDK performance guarantees.

## Hide and exit

The root double tap opens Hide, Exit and Return.
Hide installs one blank event-capture container without image encoding or image sending.
Restore rebuilds the image page and sends the current full frame.
Exit invokes the system confirmation through `shutDownPageContainer(1)`.
Detail double tap remains Back.

The earlier blank-page experiment did not implement a system sleep state.
The app and listeners remain active while its display is hidden.
See the [product guide](../product/overview.md) for current gestures.
