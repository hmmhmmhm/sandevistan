# Sandevistan Phone Subheader Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

Date: 2026-07-29

Status: superseded by `2026-07-29-phone-navigation-hierarchy-design.md` and
`2026-07-29-detail-back-button-design.md`

> [!NOTE]
> This document records the earlier compact-header iteration. The later
> approved breadcrumb and detail return-card designs are the current source of
> truth and have completed same-viewport visual verification.

## Goal

Make the Sandevistan WebView header feel subordinate to the Even app's native
top bar. The WebView must retain clear navigation and screen identity without
looking like a second application-level navigation bar.

## Selected approach

Use a compact, inset section header across Home and detail screens.

- Home replaces the centered application title with a small left-aligned
  `SANDEVISTAN / DASHBOARD` section label.
- Detail screens use a compact row containing Back, a left-aligned screen
  title, and the existing optional action.
- Remove the opaque sticky surface and blur treatment from detail headers.
- Keep headers on the same light gray page surface as their content.
- Use the existing monochrome palette, typography, and Pixelarticons.
- Preserve a minimum 44 CSS-pixel touch target for Back and header actions.

This approach was selected over retaining the centered title bar because it
creates a clear hierarchy below the native Even bar. It was selected over
removing headers entirely because detail pages still need explicit navigation
and screen identity.

## Layout

### Home

The section header sits within the existing eight-pixel page inset. It is
40 pixels tall, left aligned, and visually lighter than the
`Dashboard` content heading. The HUD preview follows immediately below it.

### Detail screens

The detail header is 52 pixels tall and uses three columns:

1. A 44-pixel Back target.
2. A flexible, left-aligned title.
3. A 44-pixel optional action target.

Keep the header sticky for navigation.
Use a transparent background without blur, shadow, bottom border, or raised card styling.
Scrolling content should appear within one WebView section rather than a second application shell.

## Behavior and accessibility

- Existing Home card navigation is unchanged.
- Back navigation and optional actions retain their current behavior.
- The live Canvas stays mounted and the G2 transport is untouched.
- Long titles truncate on one line.
- Back and action controls retain accessible labels and 44-pixel targets.
- The compact hierarchy applies at all supported widths from 320 to 540
  pixels.

## Testing

- Add a component regression test for the Home section label.
- Add a component regression test proving detail navigation still exposes Back
  and the detail title.
- Add a style contract test for compact dimensions, transparent detail header
  surface, and the absence of backdrop blur.
- Run the full serial Vitest suite, TypeScript check, production build, and
  repository checks.

## Scope

This change affects only phone WebView header presentation. It does not alter
detail content, cards, phone persistence, glasses rendering, input handling,
image transport, or server APIs.
