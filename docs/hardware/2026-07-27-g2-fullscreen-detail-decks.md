# G2 full screen detailed deck checkpoint

> Historical record: Scope and results apply to the stated date and versions.
> See the [documentation index](../index.md) for current behavior.

> **Legacy evidence:** Historical RELIC names, paths, storage keys, and
> transport identifiers in this record are preserved exactly as they appeared at
> the time. Current main-branch identifiers use Sandevistan.

Date: 2026-07-27

SDK: `0.0.11`

Build: `detail-decks-019`

Result: `PENDING`

branch: `feature/g2-ors-routing`

URL:
`http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=detail-decks-019`

## Implementation scope

- A single tap on `OVERVIEW` opens the existing full-screen map. Five zoom levels persist throughout the session.
- A single tap on ‘NEWS’ opens one SBS RSS article with its title, cleaned summary, and publication time.
- A single tap on `TODO` opens up to six checklist items with selection highlighting and completion toggles.
- Save TODO changes to `relic:todos:v1` and restore them in the next app session
- A single tap on `NAVIGATION` opens the current ORS maneuver, maneuver distance, total remaining distance, and route status.
- Detail screens consume scroll input at their boundaries. A quick double tap returns to the dashboard.
- Four tiles ‘3 → 5 → 2 → 4’ are transmitted only when the visible detailed data changes.
- Suppress transmission of invisible changes such as weather, battery, and minute-by-minute time in the detailed screen

## Automatic verification

- `npm test`: 31 files, 308 tests passed
- `npm run typecheck`: Passed
- `npm run build`: Convert 60 modules
- `npm run test:sites`: 4 tests passed
- API Router, Maps, News, Routes: Passed 24 tests
- Client `ORS_API_KEY` references: 0
- All implementation files: 450 lines or less
- `git diff --check`: passed

## Actual G2 Check Items

- [ ] All four 576×288 tiles are visible from both eyes.
- [ ] In `OVERVIEW`, entering the map, zooming in, zooming out, maintaining zoom, and returning work.
- [ ] In `NEWS`, you can read the article title and summary and move to the previous or next article.
- [ ] Item selection and completion transition work in `TODO`.
- [ ] Re-open the app and the TODO completion status is restored.
- [ ] In `NAVIGATION`, the no-route state, no-key state, and route-maneuver deck display correctly.
- [ ] Scrolling at a detail-list or zoom boundary does not jump to a dashboard page.
- [ ] If you quickly tap twice on the details screen, you will return to the dashboard page you entered.
- [ ] If you quickly tap twice on the dashboard, the screen will change to a black screen and then be restored.
- [ ] `SENDFAILED` does not occur during the entire test.

## Gate

Charge the glasses before checking the items above. Until physical verification is complete, do not integrate the branch, push remotely, or send completion notifications. Keep `Result` as `PENDING` until direct observations support a change.
