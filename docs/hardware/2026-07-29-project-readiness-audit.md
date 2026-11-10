# Sandevistan Project Readiness Audit

> Historical record: Scope and results apply to the stated date and versions.
> See the [documentation index](../index.md) for current behavior.

> [!NOTE]
> This historical SDK `0.0.11` audit is superseded by the
> [2026-08-02 current readiness audit](2026-08-02-project-readiness-audit.md).
> The results below preserve evidence of the earlier release gate.

Date: 2026-07-29

Target branch: `main`

Audited transport integration commit:
`dded1e734316e542eeb13afb8a3a1455297c0c01`

SDK: `@evenrealities/even_hub_sdk` `0.0.11`

Overall status: `PHASE A PASS — PHASE B PASS — RELEASE DEFERRED`

At this checkpoint, this audit governed work before release preparation. It superseded the 2026-07-27 completion rubric, which covered an earlier branch and test baseline.

## Scope decision

Work proceeds in this order:

1. Complete the current `main` build's keyless physical G2 acceptance pass.
2. After that pass succeeds, validate optional OpenRouteService routing with a
   real server-side key.
3. Defer version tagging, GitHub Release creation, and Even Hub submission until
   the owner supplies a separate pre-submission checklist.

## Current automated baseline

The following checks passed serially on integrated `main` on 2026-07-31:

| Check | Result |
| --- | --- |
| Main Vitest suite | 57 files, 511 tests passed |
| Repository policy suite | 5 tests passed; repository copy check passed |
| TypeScript | `tsc --noEmit` passed |
| Production build | 152 modules transformed |
| Sites worker suite | 4 tests passed |
| Complete Node suite | 147 tests passed serially |
| Client ORS secret scan | No `ORS_API_KEY` reference in `src`, `app.json`, or `package.json` |
| Whitespace check | `git diff --check` passed |
| Even Hub package | `sandevistan.ehpk`, 1,773,055 bytes |

Package SHA-256:

```text
69aaf65a85a49257575d57116737ebb1a7cb549f274e05ece35f9b4b26bafd8f
```

## Capability status

| Capability | Software | Physical G2 | Remaining gate |
| --- | --- | --- | --- |
| Four-tile bounded image transport on SDK `0.0.11` | PASS | PASS | None |
| Four-level transmitted content palette | PASS | PASS | None |
| Original-palette hidden-frame bypass | PASS | PASS | None |
| Binocular 576×288 display | PASS | PASS | None |
| Fail-fast transport with no deferred refresh queue | PASS | PASS | None |
| Unchanged-tile skip | PASS | PASS, no regression | Exact identical-frame skip remains automated evidence only; not a release blocker |
| Overview clock, date, battery, weather, and map | PASS | PASS | None |
| News headlines and paginated RSS body | PASS | PASS | None |
| TODO selection, toggle, and local persistence | PASS | PASS | None |
| Full-screen map and persistent zoom | PASS | PASS | None |
| Weather dashboard and full-screen detail deck | PASS | PASS | None |
| Black-frame hide and restore | PASS | PASS | None |
| Keyless operation without ORS | PASS | PASS | None |
| ORS destination search and route lifecycle | PASS | PASS | None |
| SDK `0.0.12` image transport | REPRODUCED FAILURE | FAIL | Wait for an Even Realities compatibility resolution; keep `main` pinned to `0.0.11` |

## Phase A — keyless physical G2 acceptance

Status: `PASS`

Use the current `main` build with SDK `0.0.11` and no `ORS_API_KEY`.

- [x] Startup fills all four tiles and remains visible in both eyes.
- [x] Dashboard order is `OVERVIEW → NEWS → TODO → WEATHER`.
- [x] No Navigation page, route-key message, or destination control appears.
- [x] Overview time, date, battery, current weather, and labelled map are legible.
- [x] Tapping Overview opens the full-screen map.
- [x] Map scrolling uses the approved zoom direction and preserves the selected
  zoom after returning.
- [x] News opens a real RSS item and continues its remaining body pages before
  moving to the next article.
- [x] TODO selection and check/uncheck work in both directions.
- [x] After reopening the app, the TODO completion state is restored.
- [x] Weather dashboard shows only current weather information and a large
  representative icon.
- [x] Weather detail shows a larger icon, temperature, condition, apparent
  temperature, humidity, precipitation, and wind without overlap.
- [x] Weather detail consumes scroll input and returns only on double tap.
- [x] Double tap hides the HUD with black tiles and restores it without closing
  the app.
- [x] Repeated page changes, live updates, hide/restore, and at least a
  15-minute idle period produce no deferred work burst, WebView freeze, or
  `SENDFAILED`.

The owner confirmed every Phase A observation on 2026-07-29 using build
`phase-a-main-034` over the keyless Tailscale test server.

## Phase B — real-key ORS routing

Status: `PASS`

Keep the key only in the server process as `ORS_API_KEY`.

- [x] The phone exposes destination search only while routing is enabled.
- [x] Korean destination results are returned and can be selected.
- [x] Walking, cycling, and driving profiles return normalized routes.
- [x] Navigation appears as the fifth page after Weather.
- [x] Route geometry appears over both dashboard and full-screen maps.
- [x] Live distance and maneuver guidance advance with location.
- [x] Active guidance uses the navigation location cadence.
- [x] Off-route fixes trigger bounded rerouting without a request queue.
- [x] Ending guidance clears geometry and route cache and restores the general
  location cadence.
- [x] No key value appears in the phone UI, G2 output, browser output, logs,
  client bundle, or EHPK.

The owner confirmed the Phase B route flow on the physical G2 on 2026-07-29
using build `phase-b-ors-035`. Live server preflight also returned Korean
destination search results and normalized walking, cycling, and driving routes.
OpenRouteService rejected the unsupported `ko` instruction language; commit
`669a7f6` switched the server request to supported English instructions while
preserving Korean road and place names.

## Deferred release work

Status: `DEFERRED BY OWNER`

Do not create a version tag, GitHub Release, public package, or Even Hub
submission yet. Release work requires a separate pre-submission checklist from the owner.

## Evidence

- [SDK 0.0.11 transport checkpoint](2026-07-27-sdk-0011-transport-success.md)
- [Live refresh checkpoint](2026-07-27-g2-live-refresh.md)
- [Full-screen map checkpoint](2026-07-27-g2-fullscreen-map.md)
- [Full-screen detail decks](2026-07-27-g2-fullscreen-detail-decks.md)
- [Optional ORS routing](2026-07-27-optional-ors-routing.md)
- [Weather and dynamic Navigation](2026-07-28-g2-weather-dynamic-navigation.md)
- [No-queue refresh hardening](../superpowers/specs/2026-07-28-g2-no-queue-refresh-design.md)
- [Unchanged-tile transport experiment](2026-07-28-g2-unchanged-tile-skip.md)
- [SDK 0.0.12 reproduction](2026-07-28-sdk-0012-lz4-experiment.md)
- [Fast transport default promotion](2026-07-31-g2-fast-transport-default-promotion.md)
