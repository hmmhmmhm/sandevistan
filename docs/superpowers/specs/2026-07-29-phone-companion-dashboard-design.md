# Sandevistan Phone Companion Dashboard Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

Date: 2026-07-29

Status: implemented; automated and same-viewport visual verification complete

## Goal

Replace the dark diagnostic-oriented phone WebView with a Sandevistan companion app that matches the owner-supplied Even app references.
Make the existing glasses experience easier to configure and manage.
Preserve the hardware-proven G2 Canvas, page rendering, input semantics, and image transport.

The phone companion will provide:

- A live HUD preview and device status.
- HUD page enablement and ordering.
- News source management with a default feed and custom HTTPS RSS feeds.
- Full phone-side TODO management.
- Device-local OpenRouteService key setup.
- Korean and English phone UI.
- A separate developer diagnostics screen.

## Approved visual target

The owner selected the Even-native dashboard direction and refined it with
these requirements:

- Very light gray page background and white cards.
- Washed grayscale HUD preview matching the Even app reference.
- No green tint, glow, shadow bloom, or cyberpunk treatment in the phone UI.
- A two-column grid of slightly rounded cards.
- Cards use approximately `1.28 / 1` width-to-height proportions rather than
  perfect squares.
- Each card has a small black pixel icon near the top and its title and status
  near the bottom, with substantial empty space between them.
- Use the open Pixelarticons family from a local package. Do not draw substitute
  icons in CSS, text, or handcrafted SVG.
- Every card is the full tap target for one dedicated detail screen.
- There is no separate Manage list and no explanatory destination-map screen.
- Home ends with the Sandevistan name, a Pixelarticons GitHub link, the Even
  app-manifest version, and the current development status.

The approved Home cards are:

1. Devices
2. HUD layout
3. News
4. TODO
5. Weather
6. Navigation
7. Language
8. Developer

## Scope boundaries

### In scope

- The phone WebView rendered on `/hud-canvas-fast`.
- Phone navigation and all eight detail screens.
- Existing live data shown in the phone UI.
- New persistent user preferences and content-management controls.
- Fixed same-origin server endpoints required for custom RSS and user-owned
  ORS keys.
- Responsive phone layout and desktop browser development preview.

### Out of scope

- Any change to the 576×288 glasses frame.
- Any change to four-tile IDs, serial transfer order, dirty-tile behavior,
  double-tap hide/restore, scroll direction, map zoom behavior, or SDK version.
- New G2 HUD pages or a redesign of existing G2 Canvas pages.
- User accounts, authentication, cloud synchronization, or server-side secret
  storage.
- Even Hub submission, release tagging, or package publication.

## Information architecture

The phone companion uses one internal screen state inside the existing
WebView. It does not create separate browser routes that could interfere with
the Even app bridge.

### Home

Home contains, in order:

1. Centered `Sandevistan` title.
2. Live grayscale 576×288 HUD preview inside a pale gray frame.
3. `Dashboard` label.
4. Two-column card grid.
5. Footer with project name, repository link, Even app-manifest version, and
   development status.

The Canvas element remains mounted for the lifetime of the app. When a detail
screen is open, the Canvas may be visually off-screen but must remain available
to the transport and live-render pipeline.

### Devices

Read-only details:

- G2 connection state and battery level.
- Ring connection state and battery level.
- Charging state when the SDK provides it.
- SDK version and bilateral display status.

Missing values use clear unavailable labels and never block transport.

### HUD layout

- Overview is always enabled, locked, and first.
- News, TODO, and Weather may be enabled, disabled, and reordered.
- Show a visible Pixelarticons checkbox beside every page so enabled state is
  understandable without relying on the smaller status label alone.
- Navigation appears as an available item only after a user ORS key validates.
- Navigation can then be enabled, disabled, and reordered after the required
  Overview item.
- Save changes atomically to Even local storage.
- Apply the new order to glasses page navigation without rebuilding containers.
- Invalid or incomplete stored layouts fall back to
  `Overview → News → TODO → Weather`.

### News

- Seed one enabled, non-deletable default source: `SBS Latest`.
- Let the user add an HTTPS RSS URL and a display name.
- Validate the feed before saving.
- Let the user enable, disable, rename, or delete custom sources.
- The default source may be disabled but not deleted.
- Cap stored sources at six, including the default source.
- Preserve the current aggregate library cap of 100 articles.
- Refresh at most once per hour.
- Do not replace or refill the article library while the user is reading.
- Merge enabled source results by stable item identity and publication time.
- Render only sanitized title, summary, URL, source label, and publication time.
- Never fetch or display arbitrary article HTML.

### TODO

- Preserve the six-item maximum required by the G2 layout.
- Add a non-empty item with a 40-code-point title limit.
- Rename an existing item.
- Complete and uncomplete an item.
- Delete an item after explicit confirmation.
- Keep at least one item; an attempted deletion of the final item is rejected.
- Persist every accepted change through Even local storage.
- Send the newest list to the live state and refresh only the visible glasses
  region allowed by the existing no-queue coordinator.

### Weather

Read-only details:

- Current location label when available.
- Temperature, condition, apparent temperature, humidity, precipitation, wind,
  source, freshness, and last refresh.
- Manual refresh starts only when the provider is idle. It is dropped when the
  provider is busy and is never queued or retried.

### Navigation

When no user key exists:

- Explain that the key stays on this device.
- Accept a key in a password field.
- Validate the key before enabling Save.

When a validated key exists:

- Show a masked connected state.
- Offer destination search and route profile controls.
- Offer a destructive `Delete key` action.
- Keep the existing active-route, resume, and end-route controls.

Deleting a key ends any active route, clears the route cache, removes the local
key, and hides Navigation from the editable HUD-page list.

### Language

- Options: `System`, `Korean`, and `English`.
- System follows `navigator.language`, using Korean for `ko*` and English for
  every other value.
- Localize the phone companion only.
- Dynamic RSS content, place names, ORS instructions, and diagnostic messages
  remain source data.
- Do not change the hardware-proven G2 Canvas strings in this project phase.

### Developer

Move all current debugging UI into this screen:

- Latest 300 WebView trace lines.
- Copy and Clear controls.
- SDK version, renderer, current transport state, and dropped-refresh count.
- Routing mode and enabled RSS source count without exposing a key or private
  content.

The Home screen must not show the trace or debugging controls.

## Navigation behavior

- Tapping any Home card opens its detail screen.
- The entire card, not only its icon or label, is interactive.
- Each detail screen has one explicit Back control.
- Back returns to Home without remounting the Canvas or restarting the live
  session.
- Reset document scroll to the top before each Home/detail transition paints.
- Form controls, draggable rows, and destructive actions expose visible focus,
  busy, validation, success, empty, and error states.
- Opening a detail screen does not send a glasses refresh by itself.

## Visual system

Initial tokens:

| Token | Value |
| --- | --- |
| Phone background | `#eeeeee` |
| Card surface | `#ffffff` |
| Preview surround | `#e0e0e0` |
| Primary text | `#202020` |
| Secondary text | `#888888` |
| Hairline border | `#d7d7d7` |
| Card ratio | `1.28 / 1` |
| Card radius | `8px` at the reference phone width |
| Card icon | `30px`, black Pixelarticons |

Use two equal columns with an eight-pixel gap at the reference width.
For narrower WebViews, reduce card spacing and typography slightly.
Retain two columns until usable tap targets no longer fit at the minimum supported 320-pixel width.

Use semantic buttons and links. Minimum interactive target size is 44 CSS
pixels. The grayscale palette must still meet readable contrast for phone text;
the intentionally pale HUD preview is supplementary and retains an accessible
text alternative.

## Component boundaries

Split the existing oversized `App.tsx` while preserving its hardware behavior:

- `App.tsx`: route selection and top-level composition only.
- `FastHudController`: existing Canvas draw, bridge, live-session, input, and
  transport coordination extracted without behavioral changes.
- `PhoneCompanion`: screen state, persistent Canvas host, and Home/detail
  composition.
- `PhoneHome`: preview, eight navigation cards, and footer.
- One focused component per detail screen.
- `phone-preferences.ts`: validation, defaults, and local persistence.
- `phone-i18n.ts`: typed Korean and English dictionaries.
- `ors-key.ts`: key validation, local persistence, masked display, and
  key-bearing request headers.
- `rss-sources.ts`: source validation, defaults, local persistence, and
  multi-source resolution.

Keep each custom TypeScript, TSX, and CSS file at or below 450 lines.

## Persistent data

Use the existing versioned Even local-storage adapter.

### Phone preferences

Key: `sandevistan:phone-preferences:v1`

Contains:

- Locale: `system | ko | en`
- Ordered HUD page IDs.
- Enabled HUD page IDs.

### RSS sources

Key: `sandevistan:rss-sources:v1`

Each source contains:

- Stable local ID.
- Display name.
- HTTPS URL.
- Enabled state.
- Default-source flag.

### ORS key

Key: `sandevistan:ors-key:v1`

The key is stored separately from ordinary preferences so it can be deleted
without rewriting unrelated settings. Storage and diagnostic helpers must log
only the operation name and outcome, never the value, value length, prefix, or
suffix.

## User-owned ORS key flow

The repository and client bundle contain no real key.

1. The user enters a key in Navigation.
2. The WebView sends it in the dedicated `x-sandevistan-ors-key` request header
   to a fixed same-origin validation endpoint.
3. The server forwards it only to the fixed ORS host and fixed validation path.
4. On success, the WebView stores the key in Even local storage.
5. Geocode and route requests attach the same dedicated header.
6. The server reads the header for that request only and never persists,
   returns, or logs it.
7. Existing server `ORS_API_KEY` remains a local-development fallback when a
   user header is absent.

All routing responses use `Cache-Control: no-store`. Errors return stable codes
without upstream bodies or credentials. The phone error message never includes
the submitted key.

## Custom RSS proxy policy

The worker remains an RSS-only proxy, not a general URL fetcher.

For custom URLs it accepts only:

- `GET /api/news` with one validated HTTPS feed URL.
- Default port 443.
- No credentials, fragment, IP-literal host, localhost, `.local`, or known
  private/internal host suffix.
- No redirects.
- An XML/RSS/Atom-compatible response type.
- At most 1,000,000 response bytes.
- At most eight seconds upstream time.

Custom responses use `Cache-Control: no-store`. The built-in SBS source may
retain bounded public caching. Unsupported methods, invalid URLs, unsafe hosts,
oversized responses, timeouts, redirects, and non-feed content return stable
errors.

The client parses RSS 2.0 and Atom, sanitizes fields, records source labels, and merges at most 100 articles.
One refresh may fetch enabled feeds concurrently.
If another refresh arrives while it runs, drop the new request without queuing it.

## Error handling

- Invalid local data falls back to safe defaults and is not rewritten until the
  user makes a valid change.
- Storage failure keeps the current in-memory state and shows a concise error.
- Invalid RSS feeds are not saved.
- Failure of one enabled feed does not erase articles from successful feeds or
  the previous cache.
- Invalid ORS keys are never saved.
- A route request without a valid local or development fallback key remains
  disabled without affecting map, weather, news, or TODO.
- No user action introduces retry queues. A later explicit action or existing
  scheduled event may try again.

## Testing and acceptance

### Automated

- Home renders eight cards, a live preview, project footer, repository link,
  Even app-manifest version, and no Manage list.
- Every card is a semantic full-card button that opens the expected detail
  screen and returns without remounting the Canvas.
- Pixelarticons render from local package assets with no external icon request.
- HUD layout validation always keeps Overview enabled and first.
- Disabled pages are skipped in glasses navigation.
- Navigation cannot be enabled before ORS validation.
- Korean and English dictionaries have identical keys.
- System locale resolution is deterministic.
- TODO add, rename, complete, uncomplete, delete, limits, persistence failure,
  and last-item protection are covered.
- RSS source validation, default source, enablement, deletion, source cap,
  RSS/Atom parsing, merge, cache, and read-time refill pause are covered.
- RSS server tests cover HTTPS-only URLs, unsafe hosts, redirect rejection,
  content type, timeout, response-size limit, and stable errors.
- ORS tests prove user-header and environment-fallback behavior and confirm the
  key never appears in responses, logs, bundles, or fixtures.
- Existing fast Canvas, four-tile transport, no-queue refresh, map, weather,
  news, TODO, routing, hide/restore, repository, Sites, and typecheck suites
  remain green and run serially.

### Visual

- Compare the phone Home at the same mobile viewport with the owner-supplied
  Even app reference.
- Confirm light-gray background, white cards, `1.28 / 1` card proportions,
  subtle radii, small upper icons, lower titles, large internal whitespace, and
  footer placement.
- Confirm there is no standalone Manage list, green tint, glow, explanatory
  second page, or mixed-in debug panel.
- Test 320, 390, 430, and desktop preview widths.
- Design QA must report `final result: passed` before handoff.

### Physical G2 regression

- Startup remains bilateral and fills all four tiles.
- Home/detail navigation on the phone does not restart transport.
- Existing glasses page order follows saved settings.
- Scroll, full-screen details, map zoom, TODO toggle, route guidance, and
  double-tap hide/restore retain approved behavior.
- Repeated phone edits do not create a deferred refresh queue or WebView freeze.

## Implementation sequence

1. Extract the hardware controller behind characterization tests.
2. Add phone preferences, i18n, local icons, and the white Home shell.
3. Add detail navigation, Devices, Weather, and Developer screens.
4. Add HUD layout persistence and connect it to page navigation.
5. Add phone TODO management.
6. Add custom RSS source storage, hardened proxy support, and multi-feed merge.
7. Add device-local ORS key validation and key-bearing routing requests.
8. Run full serial verification, visual comparison, and physical G2 regression.

Release and Even Hub submission remain deferred.
