# G2 Keyless RSS News Success

> Historical record: Scope and results apply to the stated date and versions.
> See the [documentation index](../index.md) for current behavior.

Date: 2026-07-27
Branch: `feature/g2-fast-content`
Tested commit: `80767be8f0685b0baf44a129b75b11a2cd652271`
SDK: `0.0.11`
Build: `live-news-013`
URL: `http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=live-news-013`
Path: `/hud-canvas-fast?sdk=0.0.11&build=live-news-013`
Result: PASS

## Physical G2 confirmation

The checkpoint asked the user to verify six current SBS RSS headlines,
readability, fast page switching, bilateral display, and double-tap
hide/restore. The user confirmed the checklist as a whole:

> Yes, everything works fine.

Recorded results:

- Six live SBS RSS headline rows: PASS
- Headline readability: PASS
- Fast page switching: PASS
- Bilateral display: PASS
- Double-tap black-frame hide and restore: PASS

The exact six strings visible on the glasses were not transcribed. The endpoint returned six current general-news titles during the checkpoint. That response may have changed before the physical display was observed.

## Scope and uninstrumented conditions

This checkpoint verifies the user-visible RSS result on the physical G2. It
does not separately claim a physical transport trace for right-only IDs
`3/5`, absence of an HTTP request during repeated scrolling, or airplane-mode
stale-cache rendering. Those conditions are covered by automated transport and
cache tests unless and until they receive a separately instrumented physical
checkpoint.

The map remains a clearly labelled demo schematic in this build. Live
OpenStreetMap fetching, projection, rendering, and attribution belong to the
subsequent `live-map-014` checkpoint.

## Automated evidence

Before the physical checkpoint, the tested RSS build passed:

- `npm test`: 16 files, 197 tests passed;
- `npm run typecheck`: exit 0;
- `npm run build`: exit 0;
- `npm run test:sites`: 4/4 tests passed;
- server API suite: 8/8 tests passed.

The automated suite verifies feed allowlisting, upstream limits, six-title
normalization, ten-minute client caching, stale-cache fallback, right-side
refresh targeting, and hidden-frame restore behavior.

## Active QR identity

At this checkpoint, `npm run qr` pointed to the approved Tailscale URL and build tag shown above. SDK `0.0.11` and the already approved full-send order `3/5/2/4` remain
unchanged.
