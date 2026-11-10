# Detail Back Button

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

**Date:** 2026-07-29

## Goal

Make returning from any phone companion detail screen obvious and comfortable
without adding another app bar or changing the native Even navigation.

## Approved design

- Keep the existing `Dashboard / Detail` breadcrumb directly below the Even
  native bar.
- Keep the entire breadcrumb clickable and preserve its current return
  behavior.
- Add one large, full-width white card button immediately below the
  breadcrumb on detail screens only.
- Reset the document scroll position before a Home/detail screen change paints,
  so opening a card from lower on Home still reveals the button immediately.
- Use the existing Pixelarticons icon set for a left-facing arrow. Do not draw
  or approximate a new icon.
- Label the button `Back to Dashboard` in English and its localized equivalent
  in Korean.
- Match the established Even-inspired phone design: white surface, black icon
  and text, restrained gray border, approximately 10 px corner radius, and a
  minimum 56 px tap height.
- Do not render the button on Home, inside the native Even bar, or inside
  individual detail content panels.

## Component structure

`PhoneCompanion` owns the detail-screen boundary and renders one navigation region before `phone-detail-content`.
`PhoneHeader` owns only the breadcrumb.
The new button calls the breadcrumb's existing `setScreen("home")` action.
Both controls return to the same Home instance without remounting the persistent HUD Canvas.

The button uses a dedicated class instead of reusing the dark primary-action
style. This keeps navigation visually distinct from actions such as adding an
RSS source, refreshing weather, or validating an ORS key.

## Accessibility and interaction

- The visible localized label is also the accessible name.
- The entire button surface is interactive.
- Keyboard focus uses the existing three-pixel black focus ring.
- Both breadcrumb and button are verified to return Home while preserving the
  same Canvas element.
- Every phone screen transition starts at the top instead of inheriting the
  previous screen's document scroll offset.

## Verification

- Component test: every detail screen includes the localized large back
  button; Home does not.
- Interaction test: clicking either the breadcrumb or the large button returns
  to Home without remounting the Canvas.
- Style test: the button is full width, at least 56 px high, white, and uses
  the existing rounded-card treatment.
- Run the focused phone tests, then the full serial suite, type check, build,
  and Worker/API tests before pushing.
