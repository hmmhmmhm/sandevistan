# G2 full screen detailed deck design

> Historical design record. This document describes the design at its recorded date. See [current implementation](../../index.md) for current behavior.

> **Legacy evidence:** Historical RELIC names, paths, storage keys, and
> transport identifiers in this record are preserved exactly as they appeared at
> the time. Current main-branch identifiers use Sandevistan.

Date: 2026-07-27

Target path: `/hud-canvas-fast`

Base branch: `feature/g2-ors-routing`

Status: APPROVED

## Target

Expand the four dashboard summary tabs into full-screen detail decks with physical navigation and controls.
As with the `OVERVIEW` map, one tap on `NEWS`, `TODO`, or `NAVIGATION` opens a 576×288 full-screen deck.

Contracts that have already been confirmed by G2 will not be changed.

- SDK `0.0.11`
- Four 288×144 image containers
- Total transmission order `3 → 5 → 2 → 4`
- Dashboard conversion order `OVERVIEW → NEWS → TODO → NAVIGATION`
- Serial execution of all image updates
- Toggle showing black screen on double tap in dashboard

## Selected access

Use a dedicated full-screen deck for each page.

- The map maintains the existing zoom deck.
- News is created by reading actual RSS articles one at a time.
- TODO creates a selectable full-screen checklist.
- Navigation is made with a deck that checks the route operation step by step.

Enlarging only the right column is simple to implement but makes content difficult to read and operate.
Do not display original article webpages on the glasses. Loading time, readability, external HTML safety, and copyright scope remain unclear.
Use only titles and summaries from allowlisted RSS feeds in news details.

## Common screen states

Extends the current map-only state to the next common state.

```ts
type FastHudViewMode =
  | "dashboard"
  | "map"
  | "news"
  | "todo"
  | "navigation";

type FastHudViewState = {
  readonly mode: FastHudViewMode;
  readonly zoomIndex: number;
  readonly newsIndex: number;
  readonly todoIndex: number;
  readonly navigationIndex: number;
  readonly navigationFollowsActive: boolean;
};
```

Retain selections throughout the app session.
Returning to the dashboard or hiding the display preserves map zoom and each detail deck's last selection.
On app restart, initialize the map to 650m and each deck to its first item or the current route action.

> Unresolved behavior: The description below says an unhandled result overrides dashboard toggling. Whether it instead delegates to existing handling remains unclear.

The input-transition function accepts the current state, dashboard page, item counts, and current route action.
It returns the next state and one of these results:

- `unhandled`: Overrides existing dashboard toggle or black screen toggle.
- `consume`: Consumes only input without changing the screen or transmission.
- `redraw`: Redraw the current Canvas and transfer four tiles
- `toggle-todo`: Session task request to change the selected TODO

## Gesture contract

### Dashboard

- Tap once: Enter the full-screen detailed deck corresponding to the current tab.
- Scroll down: Next dashboard tab
- Scroll up: Previous dashboard tab
- Quickly double tap: Toggle display of traditional black screen

### All detailed decks

- Quickly double tap: Return to the dashboard tab you entered
- Scrolling border on detail deck: consumes input and does not advance to dashboard tab
- Black screen toggle does not work while the details screen is open.

### Map

- Scroll down: zoom in one level
- Scroll up: zoom out one step
- Single tap: consumes only input

### News

- Scroll down: Next article
- Scroll up: Previous article
- Single tap: consumes only input

### TODO

- Scroll down: select next item
- Scroll up: select previous item
- Single tap: toggle completion status of selected item

### Navigation

- Select currently active action when entering
- Scroll down: Next path action
- Scroll up: previous path action
- Single tap: Instantly return to currently active action

## News data

Add optional `summary` to `NewsItem`.

```ts
type NewsItem = {
  readonly id: string;
  readonly title: string;
  readonly summary?: string;
  readonly url?: string;
  readonly publishedAt?: number;
};
```

Convert RSS `<description>` HTML to text with `DOMParser` and normalize whitespace.
Remove control characters and store at most 360 code points.
As before, retain only verified HTTP or HTTPS article URLs. Do not open them directly on the G2.
Include `summary` in cache validation and copying.

Full screen news displays the following information:

- `NEWS // LIVE`, `STALE`, `LOADING`, `UNAVAILABLE` status
- Current location `1 / 6`
- Large title of up to two lines
- Summary of up to five lines
- Date and time of publication
- `SCROLL // ARTICLES`, `DOUBLE TAP // BACK` information

When new RSS results arrive, clamp the selection index to the valid range.
If the result is empty, show only status information and consume scroll input.

## TODO data and persistence

Add the following model to `LiveDashboardState`.

```ts
type TodoItem = {
  readonly id: string;
  readonly title: string;
  readonly completed: boolean;
};

type LiveDashboardState = {
  // Existing location, weather, news, map, route
  readonly todos: DataState<readonly TodoItem[]>;
};
```

The initial items remain at the three currently approved.

1. Go to the subway station
2. Bring an umbrella
3. Check the route

Store up to six items in Even local storage under `relic:todos:v1`.
Normalize title whitespace and require each title to contain 1 to 40 code points.
If the cache is missing or corrupted, use the initial items.
A phone UI for adding, deleting, or renaming items is outside this scope.

On a single tap, first update memory state and queue the transfer request.
Then attempt to save.
After saving succeeds or fails, finish the input operation and send four tiles.
Storage and image transfers must not overlap.
A save failure does not revert the current session, but app restart may restore the last saved state.

Full-screen TODO shows all items, the current selection, checkboxes, completed count, and these controls:

```text
SCROLL // SELECT · TAP // TOGGLE · DOUBLE TAP // BACK
```

## Navigation details

If there is an active route, it displays:

- Destination and total remaining distance
- Selected action number and total number of actions
- Selected ORS directive
- Distance of the movement
- Show currently active actions
- Guide to scrolling and returning to current action

Until the user browses route actions, keep the selection on the active action as it changes.
After one scroll, retain the user's selection.
On a single tap, resume following the active action.

If the route state is `disabled`, `loading`, `stale`, or `fresh` without a value, show its state and required phone actions in large text.
Destination search and route start or end from the glasses are outside this scope.

## Rendering

The three detailed renderers reuse common Canvas colors and text tools, but
Separate by responsibility. All implementation files are kept to 450 lines or less.

- Black background
- Key information `#ffffff`
- Supporting information `#d0d0d0`
- Rescue vessel and deactivation information `#808080`
- No shadow and glow effects
- Header and footer are black opaque bands
- The text uses open corner frames and ample white space.

Wrap long Korean strings by code point instead of Canvas measurement.
Add an ellipsis to the final line.
Use the same line layout in the test Canvas and actual WebView.

## Live updates and transfers

The dashboard maintains the existing `left`, `right`, `right-top`, and `all` forwarding rules.
In the detailed deck, the four tiles are updated only when the visible content actually changes.

- Map: change location, map or route shown on map
- News: Changes in news status, article list, title, summary or publication time
- TODO: Change of item or completion status
- Navigation: route status, current motion or distance changes

When invisible clock, battery, weather, or other-page data changes, update only state. Do not send images.
For detail entry, item movement, TODO changes, and return, send all tiles in the existing serial queue order `3 → 5 → 2 → 4`.

During TODO input processing, do not overlap storage and image transfer.
The session-state change queues a transfer request.
After the input operation finishes, send the latest four tiles.

## Failure and boundary handling

- If there is no RSS summary, the title and ‘No summary’ are displayed.
- If the news is being updated or fails, the existing `loading`, `stale`, `unavailable`
  Use the status as is.
- If the TODO cache is damaged, it is restored to the initial three items.
- Failure to save TODO does not prevent image transfer or subsequent input.
- The navigation details screen opens even if there is no route or ORS is disabled.
- When an item disappears or the number of path operations decreases, the selection position is limited to the effective range.
- All border scrolls are consumed without transfer.
- Image transmission failure uses the existing error indication and allows the next queue operation.

## Exclude range

- Open the original article webpage in G2
- Crawl article text not provided by RSS
- Add, delete or edit TODO items
- Search for destinations, start or end route from glasses
- Voice input and notification push
- SDK `0.0.12` or LZ4 transfer

## Verification

All tests are run serially.

1. Test entry, return, selection movement, boundaries, TODO effects, and navigation following with pure state transitions.
2. Test RSS summary sanitization, length limits, cache validation, and old-data retention.
3. Test TODO defaults, valid and corrupted caches, toggles, and save failures.
4. Test renderer output at 576×288 for all four detail screens, including wrapping, statuses, check marks, and gesture instructions.
5. Test app filtering by detail mode, full-frame transfers, TODO toggles, and restoration of the latest state.
6. Test that all detail inputs share the serial queue and that boundary input sends no images.
7. Pass full Vitest, type checking, production build, Sites, server API checks, and `git diff --check`.

## Actual G2 checkpoint

Existing full-screen map gates and detailed decks in series in one new build
Verify.

- One-tap access to all four pages of the dashboard
- News title, summary, publication time and previous/next article
- TODO selection, check transition and maintenance after re-entry
- Active or inactive navigation detail status
- Double tap return to all detail screens
- Toggle display of black screen in dashboard
- Four tiles on both sides and normal page order
- `SENDFAILED` does not occur

The default branch integration and push are not marked as complete until the actual glasses are confirmed.
