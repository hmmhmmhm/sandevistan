# G2 HUD Project Completion Rubric

> Historical record: Scope and results apply to the stated date and versions.
> See the [documentation index](../index.md) for current behavior.

Date: 2026-07-27

Target branch: `feature/g2-ors-routing`

> [!NOTE]
> This historical rubric has been superseded by the
> [2026-07-29 project readiness audit](2026-07-29-project-readiness-audit.md),
> which tracks the current `main` branch, Weather page, 374-test baseline, and
> the owner-approved order of remaining work.

This rubric maps the agreed product requirements to their verification status at this checkpoint. For each item, use its linked checkpoint rather than an incomplete checkbox in an older experiment.

The meaning of the status is as follows.

- `PASS`: Automated verification and required physical G2 confirmation completed.
- `SOFTWARE PASS`: Implementation and automated verification completed. Physical G2 confirmation of this build remains pending.
- `OPTIONAL`: This is an optional feature and requires external credentials for actual verification.

## Product Requirements

| Requirements | status | Evidence |
| --- | --- | --- |
| 1-bit BMP four-tile serial transmission in SDK `0.0.11` | PASS | Initial transfer and SDK checkpoint |
| Binocular 576×288 maximum display area | PASS | Maximum Area and Live Update Checkpoints |
| Quick transition of `OVERVIEW → NEWS → TODO → NAVIGATION` | PASS | Live Update Checkpoints |
| Time in minutes, year, month, day, day of the week | PASS | Live Update Checkpoints |
| Battery status of a single connected G2 or R1 | PASS | Live Update Checkpoints |
| Keyless current location and Open-Meteo weather | PASS | Live Data Checkpoint |
| SBS RSS News Up to six titles | PASS | Live Data Checkpoint |
| OSM roads and 1.5x place name labels, updated when moving | PASS | OSM Label and Live Refresh Checkpoints |
| Double tap to black screen and restore | PASS | Live Update Checkpoints |
| Tap once to enter full screen map | SOFTWARE PASS | Full screen map checkpoint |
| Scroll zoom, hold zoom, double tap to return to dashboard | SOFTWARE PASS | Full screen map checkpoint |
| News detailed deck that reads the RSS title, summary, and publication time one by one | SOFTWARE PASS | Full screen detailed deck checkpoint |
| TODO detailed deck with support for selection, completion transitions, and local saving | SOFTWARE PASS | Full screen detailed deck checkpoint |
| Navigation detail deck supporting route motion navigation and current motion return | SOFTWARE PASS | Full screen detailed deck checkpoint |
| Detailed screen boundary input consumption and four-tile serial transmission | SOFTWARE PASS | Full screen detailed deck checkpoint |
| All general functions operate even without ORS | SOFTWARE PASS | Keyless runtime inspection of optional ORS checkpoints |
| ORS destination search, route display, re-search and exit | OPTIONAL | Implementation and mock API verification completed, waiting for real key and G2 confirmation |

> Evidence ambiguity: The requirements table calls the transport 1-bit BMP.
> Linked full-HUD records describe PNG tiles. This record does not resolve that difference.

## Automatic verification baseline

The current ORS integration branch has passed the following verifications serially:

- `npm test`: 31 files, 308 tests
- `npm run typecheck`
- `npm run build`: Convert 60 modules
- `npm run test:sites`: 4 tests
- API router, maps, news, route tests: 24 tests
- No access to `ORS_API_KEY` in client source.
- `git diff --check`

## Remaining real device gates

1. Enter the map, news, TODO, and navigation detail screens at `detail-decks-019`.
   Check all four tiles in both eyes. Test scroll, tap, double tap, and return.
2. After changing TODO, open the app again and check whether the saved state is restored.
3. Check for black screen conversion and restoration, general page conversion, and absence of `SENDFAILED`.
4. In a state where there is no key, check the maintenance of existing functions and the ‘path key required’ status.
5. After receiving an ORS key, separately verify real destination search and route guidance.
   Store key values only in server environment variables.

Full-screen detail decks and optional ORS still require physical G2 confirmation. Until that confirmation, do not merge the branch into the default branch or mark the work complete.

## Connected checkpoint

- [First G2 image transmission successful](2026-07-26-first-g2-image-success.md)
- [SDK 0.0.11 transport successful](2026-07-27-sdk-0011-transport-success.md)
- [Real-time clock, battery, moving map](2026-07-27-g2-live-refresh.md)
- [OSM place name readability](2026-07-27-balanced-osm-labels.md)
- [Fullscreen Map](2026-07-27-g2-fullscreen-map.md)
- [Fullscreen Detail Decks](2026-07-27-g2-fullscreen-detail-decks.md)
- [Optional ORS routing](2026-07-27-optional-ors-routing.md)
