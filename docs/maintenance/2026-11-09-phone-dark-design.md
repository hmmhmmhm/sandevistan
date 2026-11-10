# Phone dark theme and product-image battery preview

> Historical checkpoint. This document records the design, behavior, and evidence
> available at the time. Later changes can supersede its status statements. See the
> [current documentation](../index.md).

Status: design preview only, awaiting the owner's required design approval at this
checkpoint. Production phone screens, battery telemetry, and the published 0.2.5 build
are unchanged.

The owner supplied an Even app dark-mode screenshot. The preview uses charcoal
backgrounds, slightly lighter cards, white text and neutral secondary text, with
light/dark preview selection and a proposed automatic theme setting. Preserve the
existing dashboard destinations, native app bar, and glasses HUD rendering in the
implementation. The six preview tiles show a sample layout. They do not remove other
existing destinations. The HUD image is an existing actual simulator dashboard capture.
No calendar feature is being added.

Home's device card replaces the generic device icon with official G2 B and R1 product
photos and independently labeled battery readings. The device detail shows one image,
battery percentage, charge indicator and progress bar per device. Percentages and
connectivity in these isolated mocks are explicitly sample data. If device telemetry is
unknown, show it as unavailable. Do not copy a different device's reading. The
unavailable-state card is a review example, not an extra permanent product card.

Current production telemetry carries one optional FastCanvasBattery from getDeviceInfo.
Its device status subscription ignores other serial numbers. Installed SDK 0.0.16
declares getDeviceInfo as singular. It exposes a status event with serial number,
battery, and charging fields. Its declarations do not expose a typed theme API. Confirm
supported per-device discovery before promising simultaneous G2/R1 battery values. If
native theme information is unavailable, use browser prefers-color-scheme for the
automatic theme. The planned implementation includes an explicit persisted user
override. No protocol or SDK patch was implemented in this preview.

Official asset sources and exact CDN URLs are recorded in
output/phone-dark-design-2026-11-09/assets.json. No screenshot crop, invented hardware
icon, or generated product lookalike replaces the official imagery.

Preview code: tests/simulator/phone-dark-preview.html, .tsx and .css. Captures:
output/phone-dark-design-2026-11-09/dark.png and light.png. The preview reuses existing
phone CSS tokens and Pixelarticons. Simulator TypeScript check passed. Both themes were
visually inspected after clicking the light selector in the same browser page. Only the
isolated preview changed. Production tests and builds were not repeated for an
unapproved mock.

The browser inventory initially showed another task session. No second page was opened.
The preview started only after that session closed. Preview session duvb was closed,
browser inventory was empty, and the dedicated Vite server exited.

## Brightness feasibility follow-up

The owner requested brightness adjustment only if supported. The investigation checked
installed SDK 0.0.16 declarations and README, current npm documentation, and the
official contextual-menu guide. Source: https://hub.evenrealities.com/docs/build/contextual-menu. Global display brightness is a
permanent OS-owned menu slot. The OS handles brightness entirely without notifying the
app. The SDK's textColor 0..4 affects only text containers. It is not a global
brightness control. It does not apply to the app's four-image HUD. No supported
global-brightness setter was found. Exclude an app-owned brightness slider from the
proposed theme/device UI. Native brightness remains available through the OS menu or the
Even app. This does not change the pending approval status of the theme/product-image
design.
