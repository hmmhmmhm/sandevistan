# Sandevistan Phone Companion Completion Audit

> Historical record: Scope and results apply to the stated date and versions.
> See the [documentation index](../index.md) for current behavior.

> [!NOTE]
> This audit remains the screenshot-backed baseline for the original phone
> companion. Current SDK, Ask AI, and post-audit regression status are tracked
> in the [2026-08-02 readiness audit](2026-08-02-project-readiness-audit.md).

Date: 2026-07-29

Target branch: `main`

Audited implementation commit:
`05d4b9ecc70939963bfbb73b7d68fd4dd383d1dc`

I18n extensibility follow-up implementation commit:
`2e809c8a059fa05263ead683bcf3dac3fa6656d4`

Runtime locale completeness follow-up commit:
`3abfd4421c5c745cd373b1f0517efcd44a4ab08a`

Overall status:
`SOFTWARE PASS — PHYSICAL G2 BASELINE PRESERVED — VISUAL QA PASS — RELEASE DEFERRED`

This audit covers the phone WebView companion around the persistent 576×288 G2 Canvas. The physical G2 readiness audit remains separate evidence. The owner deferred release tagging and Even Hub submission.

## Completed phone capabilities

| Capability | Result |
| --- | --- |
| Even-style light Home with eight full-card destinations | PASS |
| Neutral grayscale HUD preview without green glow | PASS |
| Compact WebView subheaders below the native Even app bar | PASS |
| Detail breadcrumb plus a large localized return card | PASS |
| Predictable scroll reset before Home/detail transitions paint | PASS |
| Persistent Canvas across Home/detail navigation | PASS |
| G2/R1 status, battery, SDK, and bilateral status screen | PASS |
| HUD page enablement, visible checkbox state, and ordering | PASS |
| RSS source add, rename, enable, disable, and delete | PASS |
| Phone TODO add, edit, toggle, reopen, and delete | PASS |
| Weather detail and immediate fail-fast refresh | PASS |
| Device-local ORS key validation, masking, and deletion | PASS |
| System or explicit selection across 30 bundled languages | PASS |
| Registry-derived language packs and generated language choices | PASS |
| Shared 90-feed browser/server built-in RSS catalog | PASS |
| Arabic/Hebrew RTL phone shell with isolated LTR tactical HUD | PASS |
| Serial live validation of all 90 built-in feeds | PASS |
| Generic bounded OSM `name:<language>` preservation | PASS |
| Localized nested HUD-preview accessibility semantics | PASS |
| Initial and runtime built-in TODO relocalization | PASS |
| Localized destination search, travel modes, route actions, and errors | PASS |
| Developer-only WebView trace panel | PASS |
| Project, GitHub, version, and development-state footer | PASS |

## Quality corrections in the audited commit

- Restored a semantic level-one heading to the Home section header.
- Localized the live HUD preview landmark and development-key fallback.
- Applied the selected phone locale to all route controls and route errors.
- Replaced the TODO check-mark text glyph with local Pixelarticons assets.
- Converted app-manifest permission descriptions to English.
- Replaced the exact-count Vitest badge with a non-stale `400+` badge.
- Updated the two phone design specifications from implementation-pending to
  implemented with visual comparison pending.
- Extracted Canvas, bridge, live-session, input, and transport coordination
  from the 760-line `App.tsx`; route composition is now 334 lines and each new
  controller module remains at or below 450 lines.
- Made a device-local ORS key immediately expose Navigation in the editable HUD
  layout, even when no development-server key exists.
- Made ORS-key deletion independent of live-session availability so a local
  secret can always be removed after confirmation.
- Added recoverable, localized failure states for phone language persistence
  and manual weather refresh.
- Added live Developer counters for trimmed trace entries and refreshes dropped
  by the no-queue coordinator.
- Corrected the TODO completion icon and added interaction-level coverage for
  add, rename, toggle, confirmed deletion, last-item protection, and storage
  rejection.
- Cleared both the local ORS key and persisted active-route cache on confirmed
  deletion, even when no live route session is available.
- Distinguish RSS/key persistence failures from network validation failures.
- Show the nearest available map label in Weather instead of an internal
  location-source token.
- Enforced 44-pixel minimum phone targets for compact TODO, ordering, routing,
  and diagnostic controls.
- Captured and compared Home and HUD-layout detail screens at the approved
  402×667 viewport against normalized owner-supplied Even references.
- Fixed inherited document scroll that could place the detail return control
  above the visible viewport.
- Corrected the Pixelarticons checked/empty semantic mapping shared by the HUD
  layout and phone TODO screens.
- Added explicit checked and empty Pixelarticons states to every full-row HUD
  enablement target.
- Replaced handwritten locale unions and binary language branches with one
  typed locale registry.
- Moved phone, fast-HUD, route, weather, default TODO, and weekday copy into
  structurally complete locale packs.
- Preserved `System` first and expanded the generated language screen to thirty
  complete registry-defined locale packs.
- Replaced duplicate client/server RSS definitions with one runtime catalog and
  enforced exactly three built-in feeds for every supported locale.
- Generalized bounded OSM localized names beyond Korean and English while
  retaining the OSM default name as fallback.
- Added `docs/i18n/adding-a-language.md`; a locale now requires one pack, one
  registry entry, and three feed definitions.
- Replaced the last fixed Korean accessibility names on the nested HUD preview
  and Canvas image with locale-pack strings.
- Localized unchanged built-in TODO titles before the first phone paint and
  immediately after a language change, independently of G2 session readiness.
- Preserved user-authored TODO titles while relabeling only the three known
  unchanged built-in records.
- Added locale direction metadata. Arabic and Hebrew render the phone companion
  in RTL while the nested tactical Canvas retains its fixed LTR geometry.
- Expanded the single RSS catalog to ninety unique HTTPS channels: exactly
  three for every bundled locale.
- Added `npm run verify:rss-live`, which checks all built-ins serially for
  redirects, HTTP status, XML content type, the 1 MB limit, RSS/Atom structure,
  at least one item, and the eight-second timeout.

## Fresh automated evidence

The following commands passed serially against the audited implementation:

| Check | Result |
| --- | --- |
| `npm test` | 53 files, 473 tests passed |
| `npm run typecheck` | `tsc --noEmit` passed |
| `npm run build` | 148 modules transformed; production build passed |
| `npm run test:repo` | 5 tests passed; repository copy check passed |
| `npm run test:sites` | 4 tests passed |
| `node --test --test-concurrency=1 tests/*.test.mjs` | 147 tests passed |
| `npm run verify:rss-live` | 90 live feeds passed; 0 failed |
| `git diff --check` | Passed |
| `git grep -n "ORS_API_KEY" -- src app.json package.json` | No tracked match |
| `npm run pack` | `sandevistan.ehpk`, 1,772,479 bytes |

The packed artifact SHA-256 is:
`a48047413baab4b30535de9fd210b4b44c28f046e9610cd02182f47892f8a44d`.

The existing physical G2 audit remains authoritative for four-tile serial
transport, binocular output, no-queue refresh behavior, map, weather, RSS news,
TODO, routing, and black-frame hide/restore.

## Visual comparison gate

Status: `PASS`

- The owner-supplied Even app screenshots remained the visual source of truth.
- The primary Home reference was normalized from 1206×2000 to 402×667 at the
  original 3× scale relationship.
- Current Home and HUD-layout detail screens were captured at 402×667 and
  compared side by side with their corresponding references.
- A lower Home-card entry was exercised from `window.scrollY = 383`; the detail
  screen painted at `window.scrollY = 0`, and its localized return control
  returned to Home.
- The final report in `design-qa.md` is `passed`; no actionable P0, P1, or P2
  visual findings remain.

The comparison images include owner-supplied Even screenshots. These images remain local and are not republished in the repository.

## Runtime locale gate

Status: `PASS`

- The current feature commit was served independently at the approved
  `402×667` phone viewport without starting G2 image transport.
- Korean System locale rendered Korean phone copy, localized HUD-preview
  semantics, and Korean built-in TODO titles.
- Selecting English immediately changed Home, the breadcrumb and return card,
  the nested HUD-preview accessibility names, and all three unchanged built-in
  TODO titles without a live G2 refresh.
- Devices, HUD layout, News, TODO, Weather, Navigation, Language, and Developer
  were opened individually in English. No fixed Korean product copy remained.
  The Korean language option intentionally retains its Korean name.
- Browser inspection reported no page errors. Standalone missing-Flutter-handler
  warnings remain expected outside the Even WebView bridge.

## Thirty-language catalog gate

Status: `PASS`

- Thirty locale packs expose complete phone, HUD, route, weather, default TODO,
  and weekday copy with no runtime translation dependency.
- Browser-tag aliases cover Chinese script variants plus legacy Hebrew,
  Indonesian, Filipino, and Norwegian tags.
- Every locale maps to exactly three built-in sources; all ninety IDs and URLs
  are unique HTTPS values.
- The complete external catalog passed the bounded serial live audit:
  `90 passed, 0 failed`.
- The SDK remains pinned to `0.0.11`; tile IDs, transfer order, binocular
  output, busy-drop behavior, and hide/restore transport were not changed.

## Deferred work

- Any owner-provided pre-submission checklist.
- Version tag, GitHub Release, public package, or Even Hub submission.
- SDK `0.0.12` adoption pending resolution of the reproduced image-send
  failure.
