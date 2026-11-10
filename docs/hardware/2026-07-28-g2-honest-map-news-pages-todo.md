# G2 map empty state, news body page, TODO re-toggle checkpoint

> Historical record: Scope and results apply to the stated date and versions.
> See the [documentation index](../index.md) for current behavior.

Date: 2026-07-28

SDK: `0.0.11`

Build: `page-direction-027`

Result: `SUPERSEDED`

branch: `feature/g2-ors-routing`

Implementation commit: `e4a0257`

URL:
`http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=page-direction-027`

The weather-details and dynamic-navigation checkpoint `weather-pages-028` supersedes this record. The unchecked hardware observations below remain incomplete for this build.

## Implementation scope

- If there are no GPS coordinates, a sample map is not drawn in the map area and ‘NO GPS DATA’ is displayed.
- If there are actual GPS coordinates but no map data, ‘NO DATA’ is displayed in the map area.
- Removed jagged sample grid lines on temporary maps.
- If there is no valid direction information, the current location is displayed as a hollow circle.
- Show the current-location arrow only when direction information is valid.
- Wrap news body text at 21px to the measured Canvas width. Display four lines per screen.
- News next scroll shows the remaining text pages first and then moves to the next article
- Backward scrolling first shows the previous body page. At the article boundary, it opens the previous article's final body page.
- Display article number and current body page in news detail header
- If you tap a checked TODO again, it will be unchecked and the screen will be redrawn immediately.
- TODO input whose change is rejected is completed without sending the screen
- Restore the normal 4-page scroll direction to the previously used direction.
- Only scrolling consumed by map details is processed as zoom inversion and separated from general page transitions.

This checkpoint retains the 100-item news library and 1 hour refill interval from `news-library-025`. It also suppresses refills during reading, limits tile transfers to 12 seconds, drops busy requests, and rolls back failed page transitions.

## Automatic verification

The commands below were executed in order rather than simultaneously.

- `npm test`: 35 files, 341 tests passed
- `node --test --test-concurrency=1 tests/*.test.mjs`: Passed 28 tests
- `npm run typecheck`: Passed
- `npm run build`: Converted 65 modules, passed production build.
- Tailscale HUD URL: HTTP 200

Automated tests cover map-data precedence, sample-grid removal, marker selection, news wrapping, bidirectional paging, boundary handling, and TODO toggles and redraws. They verify separate direction rules for dashboard paging and map zoom. They also verify that detail input does not trigger dashboard paging. The physical checklist below remains necessary for glasses output and SDK input and transfer behavior.

## Actual G2 Check Items

- [ ] All four 576×288 tiles are displayed normally in both eyes.
- [ ] The general 4-page scroll direction is the same as the direction used before the map zoom was reversed.
- [ ] Only the map detail zoom direction is reversed and does not affect the general page direction.
- [ ] When GPS is not available, only ‘NO GPS DATA’ is clearly visible in the map area.
- [ ] When there is GPS but no map data, only ‘NO DATA’ is displayed in the map area.
- [ ] When there is map data, only actual roads and labels are shown without a sample grid.
- [ ] When there is no direction information, the current location appears as a hollow circle.
- [ ] When direction information is available, the current location changes to an arrow.
- [ ] The news text is slightly smaller than the title and uses ample left and right width.
- [ ] When scrolling through long news, the remaining text continues first instead of the next article.
- [ ] Backward scrolling from an article's first body page opens the previous article's final body page.
- [ ] The news article/body page counter matches the current content.
- [ ] If you tap the checked TODO again, it will be unchecked and immediately reflected on the screen.
- [ ] After a transmission failure, the next independent input can operate map zoom, news paging, TODO, or dashboard return.
- [ ] Even if it is turned on for a long time, update requests or location events do not accumulate.

## Gate

Remote push and completion notification will not be processed until the actual G2 items above are confirmed.
After receiving direct observation results, update `Result` and check items in this document.
