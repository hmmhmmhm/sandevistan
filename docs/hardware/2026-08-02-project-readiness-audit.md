# Sandevistan Project Readiness Audit

> Historical record: Scope and results apply to the stated date and versions.
> See the [documentation index](../index.md) for current behavior.

Date: 2026-08-02

Target branch: `main`

Audited code baseline: `c8388e1d83836da54fa7005bd4ec3f6031212ffe`

SDK: `@evenrealities/even_hub_sdk` `0.0.13`

Minimum Even App: `2.2.6`

Overall status:
`SOFTWARE PASS — CORE HARDWARE PASS — CURRENT VISUAL AND EXIT REGRESSION CHECKS PENDING — RELEASE DEFERRED`

At this checkpoint, this audit governed project readiness. It superseded the 2026-07-29 readiness audit while preserving that historical SDK `0.0.11` record.

## Scope decision

The requested development scope is implemented on `main`. Release remains a
separate owner-controlled phase:

1. Keep the query-free fast HUD on SDK `0.0.13`, one in-flight image call, the
   `hud-4` content palette, and blank-page display hiding.
2. Preserve explicit transport, palette, and black-hide controls only as
   diagnostics and rollback paths.
3. Complete a fresh phone screenshot comparison and one physical Ask AI exit
   regression pass when the required browser and G2 are available.
4. Do not create a version tag, GitHub Release, public npm package, or Even Hub
   submission until the owner supplies the separate submission checklist.

## Current automated baseline

The following checks passed serially on the audited `main` code on 2026-08-02:

| Check | Result |
| --- | --- |
| Main Vitest suite | 81 files, 671 tests passed |
| Repository policy suite | 7 tests passed; repository copy check passed |
| TypeScript | `tsc --noEmit` passed |
| Production build | 192 modules transformed |
| Sites and AI endpoint suite | 12 tests passed |
| Whitespace check | `git diff --check` passed |
| Even Hub package | `sandevistan.ehpk`, 1,807,072 bytes |
| Maintainer QR target | Current Tailscale preview on port `4179` |

Package SHA-256:

```text
cf9adc8dc4a6599ee8d17c3a895c1c4935d3373d45f383fb464a4e6e01e35e78
```

The package is private and is not published to npm or Even Hub.

## Capability status

| Capability | Software | Physical G2 | Remaining gate |
| --- | --- | --- | --- |
| SDK `0.0.13` compressed image transport | PASS | PASS | None |
| Four 288×144 bilateral image containers | PASS | PASS | None |
| Query-free one-call-at-a-time image transport | PASS | Underlying serial path proven | Spot-check the query-free default after the latest promotion |
| Explicit `pipeline=2`, `3`, and `4` diagnostics | PASS | Historical experiments pass | Diagnostic only |
| Four-level content palette and PNG transport | PASS | PASS | None |
| Fail-fast refresh with no pending queue, replay, or retry | PASS | PASS | None |
| Byte-identical tile skipping | PASS | No observed regression | Exact skip remains automated evidence |
| Blank-page display hide with no image sends | PASS | PASS | None; owner declined more sampling |
| Dashboard, detail decks, map, weather, news, and TODO | PASS | PASS | None |
| Optional device-local ORS routing | PASS | PASS | None |
| Even-style phone companion and nine direct settings cards | PASS | Prior visual baseline PASS | Fresh post-Ask-AI screenshot comparison pending |
| Thirty complete locales and ninety built-in RSS sources | PASS | Runtime locale baseline PASS | Live feed health is time-dependent |
| Ask AI Realtime microphone conversation | PASS | Owner-confirmed working | None for core conversation |
| Ask AI time, exact location, Web search, MCP, pacing, and cost UI | PASS | Core AI flow owner-confirmed | Provider and user-server availability remain external |
| Ask AI native Text exit and four-quadrant image restoration | PASS | Earlier whole-eye issue fixed | Recheck the latest 200 ms lower-right settle barrier |

## Current transport contract

- The Canvas remains 576×288 and is split into IDs `3`, `5`, `2`, and `4`.
- The query-free `/hud-canvas-fast` route sends one SDK image call at a time.
- Missing or invalid `pipeline` values resolve to `1`; explicit values `1`
  through `4` remain available for controlled diagnosis.
- Content PNGs use `hud-4`; `levels=original` is the palette rollback.
- One accepted refresh owns the transport. Competing work is dropped and is
  never queued, merged, replayed, caught up, or retried.
- A dashboard double tap rebuilds one blank event page and sends no image.
  Restore rebuilds the image page, invalidates the successful-tile cache, and
  sends all current quadrants again.
- Ask AI uses the official full-screen native Text container. On exit, the app first neutralizes native Text. It waits 1 s for bilateral neutral-page propagation, then rebuilds the image page. It waits another 200 ms for bilateral container installation, then restores all four image quadrants.

## Physical evidence carried forward

The owner has confirmed the following on updated G2 hardware and Even App:

- SDK `0.0.13` no longer reproduces the earlier SDK `0.0.12` `sendFailed`;
- four-quadrant image transport, paging, details, and repeated hide/restore
  remain responsive;
- the `hud-4` PNG path is faster than the original-palette baseline;
- blank-page hiding removes the display in approximately 63–94 ms without an
  image encode or image send;
- Ask AI microphone recognition, Realtime answers, localized status, response
  pacing, and normal return to the HUD work; and
- the earlier complete one-eye loss after Ask AI exit improved, but intermittent
  partial or one-sided restoration remains under active physical validation.

The paired Ask AI page-installation barriers and the restored query-free
four-call default have complete automated coverage but still require a fresh
physical spot check.

> Evidence ambiguity: This carried-forward statement says four-call default.
> The transport contract and capability table above say one call at a time.
> This audit does not resolve the conflicting statements. They remain narrow hardware candidates, not a confirmed
final fix.

## Visual comparison status

The 2026-07-29 Home and HUD-layout phone comparison remains a valid PASS for
the screens and build it captured. The current companion added Ask AI and
subsequent localized states after those images were recorded.

A controllable in-app browser was unavailable during this audit, so no new
screenshots could be captured without violating the project's visual-audit
workflow. Current semantic routes, minimum target sizes, locale coverage, and
card styling pass automated checks. This audit does not verify pixel fidelity, current contrast, focus appearance, or screen-reader behavior for the post-Ask-AI build.

## Deferred release work

Status: `DEFERRED BY OWNER`

Do not create a version tag, GitHub Release, public package, or Even Hub
submission yet. Release work begins only after the owner supplies the separate
pre-submission checklist.

## Evidence

- [SDK 0.0.13 image transport gate](2026-07-31-sdk-0013-image-transport.md)
- [Fast blank display hardware gate](2026-07-31-g2-fast-blank-display-experiment.md)
- [Four-level HUD palette gate](2026-07-31-g2-hud-palette-compression.md)
- [PNG versus 1-bit BMP gate](2026-07-31-g2-lz4-friendly-bmp-experiment.md)
- [Typed-array versus Base64 bridge gate](2026-07-31-g2-base64-image-bridge-experiment.md)
- [Phone companion completion audit](2026-07-29-phone-companion-completion-audit.md)
- [Current design QA record](../../design-qa.md)
- [Default serial transport plan](../superpowers/plans/2026-08-02-default-serial-image-transport.md)
- [Ask AI binocular settle design](../superpowers/specs/2026-08-02-ask-ai-bottom-status-binocular-settle-design.md)
