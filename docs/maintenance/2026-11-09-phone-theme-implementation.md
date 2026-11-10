# Phone themes and smaller Home device imagery

The owner approved the prior dark/light visual direction and requested smaller,
separate Home product images. This supersedes the preview-only status in the
initial design record. Implementation is local on main; no new build was posted.
The published Private build remains 0.2.5.

## Result

- Added Auto/Light/Dark selection to Home, with independent theme persistence in
  Even local storage. Auto observes prefers-color-scheme changes. Explicit choice
  wins over a delayed stored read and transfers to Even storage if the bridge
  replaces browser storage during startup. Writes are ordered; failed saves are
  visible. Root page background and native form controls follow the resolved
  theme, and the root attribute is restored on unmount.
- Updated shared phone CSS tokens for charcoal cards, text, inputs, actions,
  borders, focus, code fields and phone HUD preview. Existing light treatment is
  retained. The phone preview alone changes its CSS grayscale/inversion treatment;
  no glasses canvas pixels, SDK page layout or image transport were modified.
- Bundled official G2 B and R1 product images locally under public/devices.
  Provenance remains in output/phone-dark-design-2026-11-09/assets.json. Home uses
  separate clipped image columns and a gap, smaller visible images, fixed compact
  product height, and aligned battery labels. Unknown text is available to screen
  readers without wrapping the narrow Home card; detail displays it visibly.
  Large device-detail images are retained, with percentage, charging state and
  progress only when the relevant device has a numeric reading.
- Existing single-device telemetry remains unchanged. The current bridge path
  does not supply simultaneous G2/R1 readings. A missing device is unavailable;
  it does not inherit another device's percentage or imply a zero battery.
- Brightness was excluded at the owner's request because the public SDK does not
  expose global display-brightness control. The native OS/Even app still owns it.
- Theme labels currently use Korean/Japanese and English fallback, matching the
  existing small AI/HUD copy convention. Full translations for additional locales
  were not introduced.

## Verification

Used one browser page with the real production PhoneCompanion and local example
telemetry, not the earlier static mock. Verified light/dark switching, persistence
across reload, Home-to-device-detail and Back navigation, R1 charging, and removing
all telemetry without retaining stale numeric readings. Captures are under
output/phone-theme-live-2026-11-09: home-dark.png, home-light.png, devices-dark.png,
and home-small.png. The small capture uses 320 x 740; no image overlap or battery
number wrap remained. Other captures use 390-pixel width. The fixture's top data
buttons/banner are explicitly verification-only and are not shipped product UI.
HMR was not assumed: final CSS was verified after a document reload.

Vitest: 103 files / 772 tests passed. Both TypeScript configurations and the
EvenHub production build passed. The earlier literal CSS filter assertion was
updated to recognize the theme token; the complete suite then passed. New
behavior checks cover system-theme changes, explicit override persistence,
late-load protection, save failure, and storage handoff. Device tests verify a
received G2 value and unavailable R1 without a fabricated progress bar.
Build retains its existing large-chunk warning. Physical Even WebView theme
propagation and two-device telemetry have not been demonstrated by this browser
fixture. Auto uses the browser's actual media query rather than claiming a native
Even theme API. Browser session azub and the preview server were stopped.
