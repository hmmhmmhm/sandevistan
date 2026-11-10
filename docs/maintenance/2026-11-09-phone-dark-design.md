# Phone dark theme and product-image battery preview

Status: design preview only, awaiting the owner's required design approval.
Production phone screens, battery plumbing, and the published 0.2.5 build are unchanged.

The owner supplied an Even app dark-mode screenshot. The preview uses charcoal
backgrounds, slightly lighter cards, white text and neutral secondary text, with
light/dark preview selection and a proposed automatic theme setting. Preserve the
existing dashboard destinations, native app bar, and glasses HUD rendering in the
implementation. The six preview tiles are a layout sample, not removal of other
existing destinations. The HUD image is an existing actual simulator dashboard
capture; no calendar feature is being added.

Home's device card replaces the generic device icon with official G2 B and R1
product photos and independently labeled battery readings. The device detail
shows one image, battery percentage, charge indicator and progress bar per device.
Percentages and connectivity in these isolated mocks are explicitly sample data.
Unknown device telemetry must remain unavailable rather than copying a different
device's reading. The unavailable-state card is a review example, not an extra
permanent product card.

Current production telemetry carries one optional FastCanvasBattery from
getDeviceInfo. Its device status subscription ignores other serial numbers.
Installed SDK 0.0.16 declares getDeviceInfo as singular and exposes a status event
with serial number, battery and charging fields; it does not expose a typed theme
API in its declarations. Confirm supported per-device discovery before promising
simultaneous G2/R1 battery values. Use browser prefers-color-scheme for automatic
theme when native theme information is unavailable, with an explicit persisted
user override planned. No protocol or SDK patch was implemented in this preview.

Official asset sources and exact CDN URLs are recorded in
output/phone-dark-design-2026-11-09/assets.json. No screenshot crop, invented
hardware icon, or generated product lookalike replaces the official imagery.

Preview code: tests/simulator/phone-dark-preview.html, .tsx and .css.
Captures: output/phone-dark-design-2026-11-09/dark.png and light.png.
The preview reuses existing phone CSS tokens and Pixelarticons. Simulator
TypeScript check passed. Both themes were visually inspected after clicking the
light selector in the same browser page. Only the isolated preview changed;
production tests and builds were not repeated for an unapproved mock.

The browser inventory initially showed another task session. No second page was
opened; the preview started only after that session closed. Preview session duvb
was closed, browser inventory was empty, and the dedicated Vite server exited.

## Brightness feasibility follow-up

The owner requested brightness adjustment only if supported. Checked installed
SDK 0.0.16 declarations and README, current npm documentation, and the official
contextual-menu guide at https://hub.evenrealities.com/docs/build/contextual-menu.
Global display brightness is a permanent OS-owned menu slot, handled entirely by
the OS without notifying the app. The SDK's textColor 0..4 affects text containers
only; it is not a global brightness control and does not apply to the app's
four-image HUD. No supported global-brightness setter was found. Exclude an
app-owned brightness slider from the proposed theme/device UI. Native brightness
remains available through the OS menu or the Even app. This does not change the
pending approval status of the theme/product-image design.
