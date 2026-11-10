# Phone Navigation Hierarchy Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

Status: implemented; same-viewport visual verification complete

> [!NOTE]
> The later `2026-07-29-detail-back-button-design.md` retains this text-only
> breadcrumb and adds a separate large return card below it. The breadcrumb
> itself still renders no arrow.

## Context

The Even app supplies a native top bar with a back control, document title, and display action.
The phone companion adds a second project label on Home and another arrow-shaped Back control on detail screens.
On the owner-supplied screenshots, these controls appear to duplicate navigation levels.
The intended hierarchy is one native shell containing one WebView.

## Goal

Make the phone companion read as subordinate content inside the Even app:

- the native/WebView document title is `SANDEVISTAN`;
- Home begins directly with the live HUD preview;
- detail screens retain an obvious path back to Home without rendering another
  arrow.

The glasses HUD, Canvas transport, dashboard cards, detail content, and native
Even app chrome remain unchanged.

## Approved Information Hierarchy

### Native shell

The HTML document title is `SANDEVISTAN`. This is the only project-level title
shown by the Even app shell.

### Home

Remove the `SANDEVISTAN / DASHBOARD` eyebrow entirely. The first WebView-owned
element is the washed grayscale HUD preview, followed by the existing
`Dashboard` section heading and card grid.

### Detail screens

Replace the icon Back button and standalone detail title with one full-width
breadcrumb button:

```text
Dashboard / HUD layout
```

The localized `Dashboard` segment is muted and the current screen title is
prominent. The entire breadcrumb is a minimum 44-pixel tap target and returns
to Home. It uses text and a slash rather than an arrow so it cannot be confused
with the Even shell's native Back control.

## Component Boundaries

- `index.html` owns the document title shown by the native wrapper.
- `PhoneHome` owns only the preview, dashboard section, cards, and footer.
- `PhoneHeader` owns the localized breadcrumb button and optional action slot.
- `PhoneCompanion` supplies `Dashboard` as the parent label and preserves the
  existing in-memory screen switch, so the persistent Canvas is not remounted.

No new router, history stack, icon, asset, or dependency is introduced.

## Accessibility

- The breadcrumb is a semantic `button`.
- Its accessible name combines parent and current screen labels.
- The detail screen keeps one level-one heading for the current screen.
- Home no longer exposes a redundant level-one project heading; the existing
  `Dashboard` section heading remains visible.
- Focus and tap behavior continue to use the existing 44-pixel control
  contract.

## Verification

1. A DOM test proves Home has no `SANDEVISTAN / DASHBOARD` label.
2. A DOM test proves each detail screen has one heading, no `Back` button, and
   a `Dashboard / <screen>` breadcrumb that returns to Home without remounting
   the Canvas.
3. A CSS contract test proves the removed Home subheader has no styles and the
   breadcrumb is a full-width, minimum 44-pixel control with transparent
   background.
4. A repository test proves the document title is exactly `SANDEVISTAN`.
5. Serial unit tests, type checking, production build, repository checks, and
   Sites worker tests remain green.
