# G2 Map Empty States, News Pagination, and TODO Redraw Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

**Date:** 2026-07-28

## Goal

Show missing map information with a clear, visually quiet status.
Let the wearer read every available RSS summary page before changing articles.
Immediately show both TODO checking and unchecking on the glasses.

## Constraints

- G2 image transfers stay sequential and use the existing no-queue operation
  gate.
- A busy or failed request is dropped and is not replayed.
- News detail continues to use the title and summary supplied by the
  allowlisted SBS RSS feed. Article pages are not crawled.
- The existing map zoom state, dashboard page order, news library, one-hour
  refill policy, TODO persistence, and double-tap behavior remain unchanged.

## Map Empty-State Priority

The map drawing area uses the following mutually exclusive states:

1. If no location coordinate exists, or the only coordinate has source
   `demo`, draw `NO GPS DATA`.
2. If a non-demo coordinate exists but there is no fresh or stale map value,
   draw `NO DATA`.
3. If a map value exists but both `roads` and `labels` are empty, draw
   `NO DATA`.
4. Otherwise draw real roads, labels, an active route when available, and the
   position marker.

Center `NO GPS DATA` or `NO DATA` in the available embedded or fullscreen map viewport.
Keep the surrounding HUD frame, header, zoom footer, and controls.
The map drawing area contains only status text.
Do not draw a position marker, route, label, road, or placeholder line there.

The schematic sample grid is deleted. No fallback geometry replaces it.

## Position Marker

When real map data is visible:

- a finite heading, including `0`, draws the existing filled directional
  arrow rotated to that heading;
- an absent or non-finite heading draws an 8 px radius hollow circle centered
  at the current position.

The circle uses the primary monochrome HUD color with a 2 px stroke and a
black interior. It does not imply a direction.

## News Summary Pages

`FastHudViewState` gains `newsPage`, initially `0`. Each news item is rendered
as one or more summary pages. The title remains visible on every page. The
existing measured-width 21 px summary layout still uses 528 px and four lines
per page.

The pagination helper returns every measured line instead of truncating at
four lines, then groups the lines into four-line pages. The RSS summary remains
bounded by the existing 360-code-point sanitizer.

The news header shows both positions:

```text
01/100 · P1/3
```

The footer changes to `SCROLL // TEXT / ARTICLES`.

### Input order

For `scroll-next`:

1. If another summary page exists, increment `newsPage`.
2. Otherwise, if another article exists, increment `newsIndex` and set
   `newsPage` to `0`.
3. At the final page of the final article, consume the input without redraw.

For `scroll-previous`:

1. If an earlier summary page exists, decrement `newsPage`.
2. Otherwise, if an earlier article exists, decrement `newsIndex` and set
   `newsPage` to the last page of that previous article.
3. At the first page of the first article, consume the input without redraw.

The view context supplies page counts for all current news items. Counts are
computed with the same Canvas font and measured-width pagination used by the
renderer. Missing or empty summaries have one page containing `no summary`.

When RSS data changes, `syncFastHudView()` clamps `newsIndex` and `newsPage` to
the new library and selected article. Leaving and re-entering news retains the
selected article and summary page unless the refreshed data requires clamping.

## TODO Immediate Toggle

The existing `toggleTodo()` inverts `completed`: checked items become unchecked, and unchecked items become checked.
The defect is in the display path.
The synchronous state emission requests an external refresh while the input operation is busy.
The busy-state rule correctly drops that request.

The input handler therefore treats a successful TODO toggle as part of the
current input operation:

1. Await `liveSession.toggleTodo(selectedIndex)`.
2. The session updates the inverted item and attempts to persist it.
3. Draw the current TODO detail from the updated in-memory live state.
4. Return `redraw`.
5. The transport sends the four detail tiles within the accepted input
   operation.

If the selected index is invalid or the session reports no change, return
`consume` and send nothing. No external refresh is queued, merged, or retried.

## Diagnostics

Existing input, refresh, encode, and tile logs remain. The implementation adds
no article or TODO content to diagnostics. The existing input effect log is
enough to identify a TODO toggle; its final result changes from `consume` to
`redraw` only when state actually changed.

## Testing

Tests run serially and cover:

1. missing or demo location renders `NO GPS DATA`;
2. a real location with unavailable or empty map renders `NO DATA`;
3. neither empty state draws schematic roads, route, labels, or a marker;
4. missing heading draws a hollow circle and finite headings draw an arrow;
5. measured summary text produces all four-line pages without content loss;
6. next input advances summary pages before articles;
7. previous input crosses to the previous article's last page;
8. news page and article boundaries consume without redraw;
9. news selection and page clamp after data changes;
10. tapping an unchecked TODO checks, attempts persistence, redraws, and sends;
11. tapping a checked TODO unchecks, attempts persistence, redraws, and sends;
12. invalid TODO selection sends nothing;
13. the complete source suite, API suite, typecheck, and production build.

## Physical G2 Checkpoint

The next Tailscale build must confirm:

- unavailable map space contains only the correct status text;
- a valid map without heading uses a hollow circle;
- a heading update changes the circle to a directional arrow;
- a long news summary continues across scrolls before the next title appears;
- reverse scrolling returns through body pages in the opposite order;
- tapping a checked TODO visibly removes its check immediately;
- paging, hide/restore, and long-running input remain responsive.

The existing hardware checkpoint remains pending and is superseded by this
combined build. The branch is not pushed until the combined physical
checkpoint passes.
