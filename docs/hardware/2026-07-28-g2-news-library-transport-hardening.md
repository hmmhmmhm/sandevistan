# G2 News Library/Transmission Stability Checkpoint

> Historical record: Scope and results apply to the stated date and versions.
> See the [documentation index](../index.md) for current behavior.

Date: 2026-07-28

SDK: `0.0.11`

Build: `news-library-025`

Result: `SUPERSEDED`

branch: `feature/g2-ors-routing`

Implementation commit: `43113a3`

URL:
`http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=news-library-025`

The `honest-detail-026` checkpoint supersedes this record. It adds map empty states, news-body paging, and TODO re-toggling. This build's unchecked physical observations remain incomplete.

## Implementation scope

- In map details, downward scrolling zooms out. Upward scrolling zooms in.
- Map zoom level and zoom memory between dashboard and details are maintained
- Maintain news detailed title at 25px, enlarge body text at 21px
- Wrap the news body to the actual Canvas measurement width and use the 528px available width.
- Save up to 100 SBS latest RSS by merging and removing duplicates with new articles prioritized
- Change news cache update interval to 1 hour
- Do not refill while reading the news details, but check expiration immediately after leaving the details.
- Do not store or replay news and screen update requests in progress, failure, or hidden status.
- If a G2 tile transfer remains unresponsive for more than 12 seconds, the app fails the transfer and releases the input lock.
- Late-arriving SDK transfer results do not cause screen commit or next tile transfer.
- When dashboard page transmission fails, restore the local page to its previous state.

## Automatic verification

The commands below were executed in order rather than simultaneously.

- `npm test`: 34 files, 336 tests passed
- `node --test --test-concurrency=1 tests/*.test.mjs`: Passed 28 tests
- `npm run typecheck`: Passed
- `npm run build`: Converted 64 modules, passed production build.
- `git diff --check`: passed
- Local HUD URL: HTTP 200
- Tailscale HUD URL: HTTP 200
- SBS RSS response at time of check: 102 items

Automated tests cover zoom direction, width-based news wrapping, the 100-item merge limit, and retention of existing cache entries. They also cover the 1 hour update interval, reading-time refill suppression, and busy-request drops. Further tests cover the 12 second transfer limit, ignored late responses, and page rollback. Verify glasses output and SDK latency with the physical checklist below.

## Actual G2 Check Items

- [ ] All four 576×288 tiles are displayed normally in both eyes.
- [ ] `OVERVIEW` Enter the full screen map with a single tap.
- [ ] On the map, downward scrolling zooms out and upward scrolling zooms in.
- [ ] The map zoom level is maintained even after returning to and re-entering the dashboard.
- [ ] `NEWS` The detailed text is clearly visible at a slightly smaller size than the title.
- [ ] The text of the news is not concentrated on the left, but takes up the entire width of the right side of the screen.
- [ ] Even if you move through multiple news items in succession, the selected article and counter match.
- [ ] Items do not change suddenly while reading news details.
- [ ] Dashboard scrolling, entering/returning details, and hiding/restoring HUD continue to respond.
- [ ] Even if it is turned on for a long time, update requests or location events do not accumulate.
- [ ] After a transmission failure, the next independent input is accepted and the page is not skipped.

## Gate

Remote push and completion notification will not be processed until the actual G2 items above are confirmed.
After receiving direct observation results, update `Result` and check items in this document.
