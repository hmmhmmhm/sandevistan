# G2 News Library and Transport Hardening Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reverse fullscreen map zoom gestures and improve full-width news readability. Accumulate up to 100 hourly RSS articles without changing an active reader. Recover from G2 tile/page failures without queued work.

**Architecture:** Keep gesture state pure in `fast-hud-view`. Add measured-width wrapping to the detail renderer. Let `news.ts` own normalized library merging and one-hour freshness. The existing minute callback performs independent due checks while `live-dashboard` enforces the “not while reading” gate. Tile sends gain a per-call timeout, while dashboard navigation repairs local page state by applying the inverse transition after a failed transfer.

**Tech Stack:** React 19, TypeScript 5.9, Canvas 2D, Even Hub SDK 0.0.11, SBS RSS, Vitest 4, Vite 6

---

## File map

- `src/fast-hud-view.ts`: pure fullscreen map gesture mapping.
- `src/fast-detail-text.ts`: reusable Canvas-measured line wrapping.
- `src/fast-detail-hud.ts`: 21 px full-width news summary layout.
- `src/news.ts`: 100-item RSS parsing, cache validation, merge, and one-hour freshness.
- `src/live-dashboard-refresh.ts`: dropped-busy news refresh and complete item equality.
- `src/live-dashboard.ts`: due-only news refresh API and reader eligibility gate.
- `src/App.tsx`: supplies reader eligibility, invokes hourly due checks, and repairs page navigation through the transport callback.
- `src/fast-canvas-transport.ts`: 12-second per-tile timeout and local navigation rollback.
- Corresponding `*.test.ts` files and `src/glasses.test.ts`: regression coverage.

### Task 1: Reverse map zoom and widen news summary text

**Files:**
- Modify: `src/fast-hud-view.test.ts`
- Modify: `src/fast-hud-view.ts`
- Modify: `src/fast-detail-text.test.ts`
- Modify: `src/fast-detail-text.ts`
- Modify: `src/fast-detail-hud.test.ts`
- Modify: `src/fast-detail-hud.ts`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write failing gesture and measured-wrap tests**

Change the map assertion so `scroll-next` moves from 650 m to 850 m and
`scroll-previous` moves from 650 m to 500 m. Add a measured-width wrapper test:

```ts
expect(wrapHudTextByWidth(
  “Ganada Ramaba Saaja”,
  (value) => [...value].length * 10,
  50,
  2,
)).toEqual(["Ganada", "Rama..."]);
```

In `fast-detail-hud.test.ts`, provide `measureText`, then assert summary draws
with `bold 21px`, uses x `24`, and never exceeds four lines. Update the App map
integration assertion to expect 850 m after `scroll-next`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npx vitest run src/fast-hud-view.test.ts src/fast-detail-text.test.ts src/fast-detail-hud.test.ts src/App.test.tsx --no-file-parallelism --maxWorkers=1
```

Expected: failures for the old zoom direction, missing
`wrapHudTextByWidth`, 16 px summary, and old App radius.

- [ ] **Step 3: Implement the minimal gesture and renderer changes**

In map mode use:

```ts
const delta = input === "scroll-next" ? -1 : 1;
```

Export `wrapHudTextByWidth(value, measure, maxWidth, maxLines)` from
`fast-detail-text.ts`. Normalize whitespace, prefer whitespace boundaries,
split oversized tokens by code point, and put an ellipsis on truncated final
content.

In `drawNews`, set the summary font before measuring:

```ts
context.font = 'bold 21px "SFMono-Regular", Consolas, monospace';
const summaryLines = wrapHudTextByWidth(
  item.summary ?? "No summary",
  (value) => context.measureText(value).width,
  528,
  4,
);
```

Draw summary lines at x `24`, y `118`, 25 px line spacing, and size `21`.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run the Step 2 command. Expected: all selected files pass.

- [ ] **Step 5: Commit**

```bash
git add src/fast-hud-view.ts src/fast-hud-view.test.ts \
  src/fast-detail-text.ts src/fast-detail-text.test.ts \
  src/fast-detail-hud.ts src/fast-detail-hud.test.ts src/App.test.tsx
git commit -m "feat: improve G2 map and news detail controls"
```

### Task 2: Accumulate a one-hour, 100-item RSS library

**Files:**
- Modify: `src/news.test.ts`
- Modify: `src/news.ts`
- Modify: `src/live-dashboard-refresh.ts`

- [ ] **Step 1: Write failing parser, merge, and freshness tests**

Update the parser fixture expectation from six items to all seven items. Add
100-item limit and merge tests:

```ts
expect(parseNewsRss(rssWithItems(101))).toHaveLength(100);
expect(mergeNewsItems(
  [{ id: "new", title: "new", publishedAt: 3 }],
  [
    { id: "old", title: "old", publishedAt: 1 },
    { id: "new", title: "cached duplicate", publishedAt: 2 },
  ],
)).toEqual([
  { id: "new", title: "new", publishedAt: 3 },
  { id: "old", title: "old", publishedAt: 1 },
]);
```

Change the fresh-cache boundary to one hour. Seed a six-item stale cache,
return a feed with new entries, and assert the persisted value is the merged
library. Add a 101-item cache rejection test.

- [ ] **Step 2: Run the news tests and verify RED**

Run:

```bash
npx vitest run src/news.test.ts src/live-dashboard.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: old six-item cap, ten-minute age, missing merge export, and cache
validation failures.

- [ ] **Step 3: Implement the news library**

Set:

```ts
export const NEWS_MAX_AGE_MS = 60 * 60 * 1000;
export const NEWS_LIMIT = 100;
```

Export `mergeNewsItems(network, cached)`. Merge by ID and prefer the network record. Sort dated records newest-first, with stable insertion order for ties. Place undated records after dated records. Keep only the first 100 records.

Let `parseNewsRss()` return at most 100. Accept caches with one through 100
items. When a stale cache and network result both exist, persist and return:

```ts
const value = mergeNewsItems(items, usableCache?.value ?? []);
```

Extend `isSameNewsState` to compare `summary` as well as the existing fields.
Log only network count and merged total, never article content.

- [ ] **Step 4: Run the news tests and verify GREEN**

Run the Step 2 command. Expected: all selected tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/news.ts src/news.test.ts src/live-dashboard-refresh.ts \
  src/live-dashboard.test.ts
git commit -m "feat: retain a 100-item hourly RSS library"
```

### Task 3: Refill news only when the wearer is not reading

**Files:**
- Modify: `src/live-dashboard.test.ts`
- Modify: `src/live-dashboard.ts`
- Modify: `src/App.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write failing due-check and reader-gate tests**

Add `canRefreshNews?: () => boolean` to test options. Start a session test with fresh cached news. Advance time by one hour. Set the gate false and call `refreshNewsIfDue()` twice. Assert no fetch. Set the gate true,
call once, and assert exactly one fetch. While a deferred fetch is active,
call again and assert it is dropped rather than replayed.

In `App.test.tsx`, include `refreshNewsIfDue` on the session mock. Assert that the minute callback calls the refresh function outside news. While news detail is open, assert no call. When double-tap exits news, assert one immediate call.

- [ ] **Step 2: Run the session and App tests and verify RED**

Run:

```bash
npx vitest run src/live-dashboard.test.ts src/App.test.tsx --no-file-parallelism --maxWorkers=1
```

Expected: missing option/method and missing App calls.

- [ ] **Step 3: Implement due-only, no-queue refill**

Extend session options with:

```ts
readonly canRefreshNews?: () => boolean;
```

Add a returned method:

```ts
refreshNewsIfDue(): void;
```

It checks disposal, reader eligibility, and `fetchedAt`; it calls
`void refresh.refreshNews()` only if absent or at least `NEWS_MAX_AGE_MS` old.
It stores no pending flag and schedules no retry. Use this method for
visibility refreshes.

In App, pass:

```ts
canRefreshNews: () => view.mode !== "news"
```

Call `liveSession?.refreshNewsIfDue()` from every minute callback. The session
gate performs the skip. When input changes `view.mode` from `news` to
`dashboard`, call it once after drawing the dashboard.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run the Step 2 command. Expected: all selected tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/live-dashboard.ts src/live-dashboard.test.ts src/App.tsx \
  src/App.test.tsx
git commit -m "feat: pause hourly news refill while reading"
```

### Task 4: End non-settling tile sends after 12 seconds

**Files:**
- Modify: `src/glasses.test.ts`
- Modify: `src/fast-canvas-transport.ts`

- [ ] **Step 1: Write a failing timeout and late-settlement test**

Use fake timers. Complete the initial four sends, then make the first
navigation tile return a deferred promise. Emit scroll-next, advance 12
seconds, and assert the progress log contains a timeout. Emit another input
and assert it is accepted. Resolve the old promise afterward and assert it
does not send another tile or commit a display.

- [ ] **Step 2: Run the transport test and verify RED**

Run:

```bash
npx vitest run src/glasses.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: the operation remains busy after 12 seconds.

- [ ] **Step 3: Implement per-tile timeout**

Add:

```ts
const TILE_SEND_TIMEOUT_MS = 12_000;
```

Wrap each SDK promise with a helper that sets one timeout, rejects with a
tile-specific error, and clears the timeout on normal resolve/reject. The
helper must attach handlers to the SDK promise so a late settlement is
observed but cannot invoke progress, commit, or another transfer.

- [ ] **Step 4: Run the transport test and verify GREEN**

Run the Step 2 command. Expected: all transport tests pass and no fake timer
remains.

- [ ] **Step 5: Commit**

```bash
git add src/fast-canvas-transport.ts src/glasses.test.ts
git commit -m "fix: time out stalled G2 tile sends"
```

### Task 5: Roll back dashboard state after failed navigation transfer

**Files:**
- Modify: `src/glasses.test.ts`
- Modify: `src/fast-canvas-transport.ts`
- Modify: `src/App.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write a failing navigation rollback test**

Update the existing failed navigation harness so a failed `next` transfer
expects callback directions `["next", "previous"]`. After failure, make the
next `next` send succeed and assert its prepared page is the same adjacent
page, not the page after it.

In App, capture the navigation callback, call next then previous, and assert
the HUD redraws overview after the inverse callback.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
npx vitest run src/glasses.test.ts src/App.test.tsx --no-file-parallelism --maxWorkers=1
```

Expected: failed navigation leaves only `next` in the callback log.

- [ ] **Step 3: Implement local inverse rollback**

In `performNavigation`, log prepare, call `onNavigate(direction)`, then send
the navigation tiles. On success log commit. On failure call:

```ts
await onNavigate(direction === "next" ? "previous" : "next");
```

Log rollback and rethrow the original transfer error. If rollback itself
throws, log it and still report the original transfer error. Do not call
`refreshImages` during rollback.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Step 2 command. Expected: all selected tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/fast-canvas-transport.ts src/glasses.test.ts \
  src/App.tsx src/App.test.tsx
git commit -m "fix: roll back failed G2 page navigation"
```

### Task 6: Serial regression verification and physical server

**Files:**
- Modify: `docs/hardware/2026-07-28-g2-news-library-transport-hardening.md`

- [ ] **Step 1: Run the complete source suite serially**

Run:

```bash
npm test
```

Expected: every Vitest file and test passes with one worker and no file
parallelism.

- [ ] **Step 2: Run server/API tests serially**

Run:

```bash
node --test --test-concurrency=1 tests/*.test.mjs
```

Expected: all Node test suites pass.

- [ ] **Step 3: Run typecheck and production build**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both commands exit 0.

- [ ] **Step 4: Start or confirm the Tailscale test server**

Serve the current worktree on port 4176 and verify:

```bash
curl -I "http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=news-library-025"
```

Expected: HTTP 200.

- [ ] **Step 5: Record the pending hardware checkpoint**

Create the hardware record with build URL, automated evidence, and the
physical items from the design. Mark hardware results pending until the user
reports them.

- [ ] **Step 6: Commit the checkpoint record**

```bash
git add docs/hardware/2026-07-28-g2-news-library-transport-hardening.md
git commit -m "docs: prepare G2 news library hardware check"
```

Do not push until the user confirms the physical checkpoint.
