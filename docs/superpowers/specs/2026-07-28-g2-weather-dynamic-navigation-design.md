# G2 Weather detailed/dynamic navigation page design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

Date: 2026-07-28

Status: User approved

## Target

Add keyless weather as an independent G2 dashboard page.
For users without ORS keys, hide navigation-disabled and key-setup instructions.
Use large text and high contrast to make current weather readable at a glance.

## Page composition

Uses a dynamic page list that only applies to Fast Canvas HUD.

- ORS disabled: `Overview → News → TODO → Weather`
- ORS active: `Overview → News → TODO → Weather → Navigation`

Weather is always fourth.
Show Navigation last only when `route.status !== "disabled"`.
Match the page-number denominator to the current list length, such as `04 / 04` or `05 / 05`.

Keep the fixed page types and order of general Canvas and existing Hybrid experiment routes unchanged.
Use dedicated Fast Canvas page types and a page-list function to limit the change.

## Weather Dashboard Page

Keep the existing Fast Canvas left map and common clock header.
On the fourth page, reserve the right area for weather information.

- Status label: `WEATHER // NOW` or `WEATHER // LAST` for old cache.
- Biggest information: current temperature and weather conditions
- Secondary information: perceived temperature, humidity, probability of precipitation, wind
- No data: `WEATHER DATA UNAVAILABLE` without keys or setup instructions
- Loading data: `WEATHER LOADING`

Battery, news, TODO, and navigation text are not mixed into the weather page.

## Weather details page

On a single tap of the weather dashboard, open 576×288 full-screen weather details.
Show the currently available Open-Meteo observations.

- Show the status at the top: `WEATHER // LIVE`, `WEATHER // LAST`, `WEATHER // LOADING`, or `WEATHER // UNAVAILABLE`.
- In the center, show temperature largest, with the weather condition beside it.
- In the bottom block, show perceived temperature, humidity, precipitation probability, and wind.
- Only for an old cache, show `LAST DATA` instead of the update time.
- Consume scroll and single-tap input without changing pages.
- On a quick double tap, return to the dashboard weather page.

Do not request new hourly or daily forecasts.
Use only existing Open-Meteo current-weather data.
This avoids changes to network and cache models and limits information on the glasses.

## ORS Disabled Handling

If `route.status === "disabled"`, exclude Navigation from the circular page list.
Do not display the following text on the dashboard or detail screen:

- `path key required`
- `Use after connecting ORS`
- `Key setting required`
- `NAV // DISABLED`

If the page list changes and the current page disappears, switch to Weather.
When ORS becomes active, add Navigation after Weather without changing the user's current page.

## Input and status

Add weather detail mode to `FastHudViewMode`.
A tap on the dashboard weather page enters this mode.
Do not add a selection index or other new state.

Keep the existing separate directions for dashboard paging and map zoom.
In weather details, return `consume` for all scrolling so input cannot change dashboard pages.

## Real-time update

While weather details are open, update all four tiles once if weather state, current observations, or `fetchedAt` changes.
If the values are unchanged, send nothing.
Keep the existing rules: drop busy requests, queue nothing, and leave failures for the next independent event.

The dashboard weather page uses the existing right area update path.

## Review options

1. Dynamic Page 4 of 5: Completely hide inactive functions when no key is present and keep the weather always on.
   Put it in fourth place. This is a user-approved plan.
2. Fixed page 5: Leave the navigation page but display it as a blank screen. The order is
   Simple but meaningless pages remained and were excluded.
3. Add time-based forecast: Although information increases, API response, verification, cache, and details are added.
   Page movement became complicated, so it was excluded from the current scope.

## Test

Automated testing verifies:

- When ORS is disabled, page 4 and `Weather` are the fourth order.
- When ORS is activated, `Navigation` is added as the fifth
- Dynamic page numbers and two-way circulation
- Inactive ORS notice does not exist in Fast Canvas results
- Weather dashboard displays only weather information
- fresh, stale, loading, unavailable status of weather details
- Weather details tab/scroll consumption and double tap return
- Full details updated when weather value changes, no update when the value is the same
- No regression in map zoom and general page orientation rules.

Automated verification runs all tests serially. In fact, in G2, four tiles on both sides,
Check font size, page order, entering and returning to details, and long-term input response.

## Completion conditions

> Unresolved count: The criterion below says five items. The detailed layout lists six: temperature, condition, perceived temperature, humidity, precipitation probability, and wind. This record does not resolve that difference.

- In the default keyless environment, the fourth thing is the weather and there is no navigation guidance at all.
- Navigation appears fifth only in keyed environments
- Five current weather information are clearly readable in weather details
- Existing maps, news, TODO, and hide/restore operations are maintained.
- Automatic serial verification and remote push only after passing actual G2 checkpoints
