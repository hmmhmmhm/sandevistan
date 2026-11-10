# G2 Weather detailed/dynamic navigation checkpoint

> Historical record: Scope and results apply to the stated date and versions.
> See the [documentation index](../index.md) for current behavior.

Date: 2026-07-28

SDK: `0.0.11`

Build: `weather-icon-029`

Result: `PENDING`

branch: `feature/g2-ors-routing`

Implementation commit: `ccd4116`

URL:
`http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=weather-icon-029`

## Implementation scope

- When ORS is inactive, the page order is ‘Overview → News → TODO → Weather’.
- Navigation added as fifth after Weather only when ORS is active
- Normalize inactive Navigation page requests to Weather
- Display page numbers as `04 / 04` or `05 / 05` according to the current list
- Removed route key, ORS connection, and key setup instructions from Fast Canvas in keyless state.
- Weather dashboard displays only current temperature, conditions, feeling, humidity, probability of precipitation, and wind
- A tap on Weather opens 576×288 full-screen weather details.
- Weather details display current temperature 48px and four auxiliary indicators in 2×2
- Displays fresh, stale, loading, and unavailable status with weather-specific phrases
- Weather details consume taps and scrolling. Only a double tap returns to the dashboard.
- While Weather details are open, update all four tiles only when the visible weather content changes.
- Convert current weather codes to 1-bit geometries for sun, clouds, fog, rain, snow, and thunderstorms
- Approximately 72px representative weather icon displayed on Weather dashboard
- Weather Displays approximately 104px representative weather icon in full screen details
- In the loading and unavailable states, the icon is not displayed to prevent misunderstanding.
- Preserve the no-queue policy, busy-request drops, tile timeout, and independent-input recovery after failure.

## Automatic verification

The commands below were executed in order rather than simultaneously.

- `npm test`: 37 files, 371 tests passed
- `node --test --test-concurrency=1 tests/*.test.mjs`: Passed 28 tests
- `npm run typecheck`: Passed
- `npm run build`: Converted 67 modules, passed production build.

Automated tests cover dynamic 4/5 page order and cycling, navigation normalization, weather data states, detail-input isolation, and full-frame weather-change updates. Regression tests cover map zoom direction, dashboard paging, news-body paging, TODO re-toggling, and hide and restore transfers. Icon tests cover weather-code mapping, coordinate bounds, dashboard and detail sizes, and icon suppression in empty states.

## Actual G2 Check Items

- [ ] Without a key, only four pages cycle: Overview → News → TODO → Weather.
- [ ] Key-required messages and ORS information do not appear on the glasses.
- [ ] The Weather dashboard shows only weather information.
- [ ] On the Weather dashboard, you can see a large 1-bit icon indicating the current condition.
- [ ] Go to the full screen details using the Weather tab.
- [ ] Weather details show a representative icon that is larger than the dashboard.
- [ ] The icon does not overlap temperature, status, or indicator text.
- [ ] The current temperature, conditions, feeling, humidity, precipitation, and wind can be read clearly.
- [ ] In stale state, `WEATHER // LAST` and `LAST DATA` are displayed.
- [ ] Weather detail scrolling does not change the page, but double tapping returns.
- [ ] When ORS is active, Navigation appears as the fifth page.
- [ ] The map zoom direction and general page direction remain in the previously approved state.
- [ ] Moving news text, checking/unchecking TODO, and hiding/restoring HUD continue to respond.
- [ ] Even if it is turned on for a long time, weather updates or input requests do not accumulate.

## Gate

Remote push and completion notification will not be processed until the actual G2 items above are confirmed.
After receiving direct observation results, update `Result` and check items in this document.
