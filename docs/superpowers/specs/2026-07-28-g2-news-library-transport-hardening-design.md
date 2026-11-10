# G2 News Library and Transport Hardening Design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

**Date:** 2026-07-28

## Goal

Improve the physical G2 experience without reintroducing queued work:

- reverse the fullscreen map zoom gestures;
- make RSS article summaries nearly as readable as article titles and use the
  full display width;
- grow a persistent SBS RSS library to at most 100 articles, refill it once
  per hour, and never replace the library while the wearer is reading it;
- release the input lock when an SDK tile send never settles; and
- keep dashboard page state consistent when a page transfer fails.

## Constraints

- G2 image sends remain strictly sequential.
- A busy, hidden, disposed, or failed request is dropped. It is never queued,
  merged, replayed, or automatically retried.
- The existing keyless, allowlisted SBS RSS endpoint remains the only news
  source.
- The client stores RSS titles, summaries, URLs, and publication times only.
  It does not crawl article pages.
- The current page order, detail-deck interaction, retained map zoom, and
  double-tap display toggle remain unchanged.

## Fullscreen Map Gesture

The current mapping is reversed:

| G2/R1 input | New result |
| --- | --- |
| Scroll bottom / `scroll-next` | Zoom out to a larger radius |
| Scroll top / `scroll-previous` | Zoom in to a smaller radius |

The existing five radii, default radius, retained zoom index, and boundary
consumption remain unchanged. A gesture at either limit is consumed without a
redraw or page navigation.

## News Detail Layout

The title remains 25 px bold. The summary becomes 21 px bold, which is only
slightly smaller than the title. Summary text uses the full inner width of the
548 px article frame with 10 px internal side padding.

Wrap text by measured display width instead of a fixed character-unit limit.
Each line can use up to 528 px.
Keep up to four summary lines between the title and publication row.
Use secondary green for the first summary line and primary green for the remaining lines.
Clip long text to four displayed lines. Keep the stored RSS summary unchanged.

The header, article counter, publication time, footer controls, colors, and
glow-free Canvas rendering remain unchanged.

## News Library

### Storage and merge

`parseNewsRss()` returns up to 100 normalized RSS items instead of six.
When the persisted library is due for refresh, `resolveNews()` fetches the latest feed.
It merges network items before cached items and deduplicates by normalized item ID.
It sorts dated items newest first and preserves source order for ties or missing dates.
It stores at most 100 items.

The current feed may expose fewer than 100 distinct items. Therefore the
library fills progressively across successful hourly refreshes rather than
inventing entries or adding another publisher.

Cache validation accepts one through 100 items. Existing six-item caches remain
valid and are expanded by later successful refreshes.

### Refresh interval

The news maximum age becomes one hour. Startup still emits a usable cached
library immediately. If it is younger than one hour, no network request runs.
If it is due, the client fetches and merges a new snapshot.

While the app is open, a lightweight news-refill scheduler checks whether the
library is due. The scheduler does not enqueue work:

- if a news refresh is active, the check is dropped;
- if the wearer is in the news detail deck, the check is skipped;
- if the app is disposed, the check is ignored;
- if a fetch or storage operation fails, the existing library remains stale
  and the attempt ends.

On leaving news details, run one immediate due check.
If the library is less than one hour old, do not fetch data.
Do not retain skipped or failed checks as pending jobs.
A later timer, visibility event, or detail-exit event may make an independent attempt.

### Selection stability

No news state update is emitted while the wearer is in the news detail deck.
Consequently the selected index and displayed article cannot shift during
reading. After leaving the detail deck, a successful refill may prepend new
articles. Re-entering news starts at the retained numeric index, clamped to the
new library length, matching the existing detail-deck retention rule.

## Tile Send Timeout

Each individual `updateImageRawData()` call races against a 12-second timeout.
The timeout is cleared when the SDK call settles.

On timeout:

- log `<tile> timeout · 12000ms`;
- reject the current transfer;
- do not send remaining tiles;
- do not retry the tile;
- let the enclosing operation finish and release `busy`.

The unresolved SDK promise is ignored if it settles later. It must not produce
another display commit, progress event, retry, or state transition.

## Transactional Dashboard Paging

Dashboard page navigation becomes a prepare/commit transaction:

1. Compute and draw the adjacent page.
2. Send the two navigation tiles.
3. Commit the new page only after both tiles succeed.
4. If encoding or either tile send fails, restore and redraw the previous page
   in local Canvas state without sending another image.

The failed request remains failed. The rollback is local state repair, not an
automatic display retry. The next independent gesture begins from the page
that is still visible on the glasses.

Keep detail-deck transitions unchanged.
A failed detail redraw can already leave a partial or previous raster visible.
Limit this change to dashboard page navigation, where an internal page skip was observed.

## Diagnostics

Existing `accepted`, `dropped`, `complete`, `display committed`, and tile
duration logs remain. New diagnostic entries identify:

- tile timeout;
- dashboard page prepare, commit, or rollback;
- news refill skipped while reading;
- news merge count and total library size.

Logs never include article titles, summaries, URLs, or other content.

## Testing

Tests run serially and cover:

1. reversed fullscreen map zoom direction and unchanged bounds;
2. 21 px news summary text, full-width wrapping, and four-line clipping;
3. parsing and cache validation through 100 items;
4. stable merge order, deduplication, cap eviction, and legacy six-item cache;
5. one-hour freshness and stale-cache preservation on failure;
6. active-reading refill suppression and one due check after leaving news;
7. absence of pending/replayed news requests;
8. 12-second tile timeout, busy release, and ignored late settlement;
9. dashboard page commit on success and local rollback on failure;
10. existing hide/restore, battery, location, live-data, route, and detail-deck
    regressions;
11. TypeScript typecheck and production build.

## Physical G2 Checkpoint

The Tailscale test build must confirm:

- scroll bottom zooms out and scroll top zooms in;
- article summary text is readable and fills the frame horizontally;
- several articles can be browsed without a mid-read index jump;
- an ordinary page send failure does not skip a dashboard page;
- hide, restore, page scroll, fullscreen entry, and double-tap back remain
  responsive during an extended session.

The branch is pushed only after this physical checkpoint passes.
