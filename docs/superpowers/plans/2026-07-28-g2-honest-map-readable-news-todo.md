# G2 Honest Map, Readable News, and TODO Redraw Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fake map geometry with empty states and heading-aware markers. Paginate every RSS summary before article changes. Redraw checked or unchecked TODOs within the accepted input operation.

**Architecture:** `fast-map` decides one map-area state before drawing any geometry. A focused `fast-news-pages` module owns measured four-line summary pagination shared by App state and the Canvas renderer, while `fast-hud-view` owns article/page transitions. TODO data continues to toggle in the live session, but App promotes a successful toggle to the current operation’s `redraw` result.

**Tech Stack:** React 19, TypeScript 5.9, Canvas 2D, Even Hub SDK 0.0.11, Vitest 4, Vite 6

---

### Task 1: Honest map empty states and heading marker

**Files:**
- Modify: `src/fast-map.test.ts`
- Modify: `src/fast-map.ts`

- [ ] **Step 1: Write failing map-state and marker tests**

Replace the schematic fallback assertion with separate demo-location and
real-location cases:

```ts
expect(draw(createInitialLiveDashboardState()).texts.map(({ value }) => value))
  .toContain("NO GPS DATA");

const base = liveState();
const noMap = { ...base, map: { status: "unavailable" as const } };
expect(draw(noMap).texts.map(({ value }) => value)).toContain("NO DATA");
```

Add an empty `{ roads: [], labels: [] }` case and assert no route stroke or
position fill appears. Extend the fake Canvas with `arc()` recording. Delete
`heading` from a valid live location and assert one hollow circle centered on
the embedded viewport. Retain the existing heading `0` fullscreen arrow
assertion and assert it records no circle.

- [ ] **Step 2: Run the map test and verify RED**

Run:

```bash
npx vitest run src/fast-map.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: the old schematic grid appears, no empty-state text exists, and a
missing heading still draws a north-facing arrow.

- [ ] **Step 3: Implement one map-area state decision**

Add:

```ts
type MapAreaState =
  | { readonly status: "NO GPS DATA" | "NO DATA" }
  | {
      readonly status: "ready";
      readonly center: Coordinate;
      readonly map: MapValue;
    };
```

`mapAreaState(live)` returns `NO GPS DATA` for absent/demo coordinates,
`NO DATA` for absent/empty map values, and `ready` otherwise. In
`drawMapLayers`, draw centered 18 px status text and return immediately for
empty states. Delete `drawSchematicRoads`.

Change the marker to:

```ts
if (!Number.isFinite(heading)) {
  context.beginPath();
  context.arc(viewport.centerX, viewport.centerY, 8, 0, Math.PI * 2);
  context.strokeStyle = COLOR.primary;
  context.lineWidth = 2;
  context.stroke();
  return;
}
```

Only ready state draws roads, labels, route, and marker. Replace
`SCHEMATIC` descriptor/footer wording with `NO DATA`.

- [ ] **Step 4: Run the map test and verify GREEN**

Run the Step 2 command. Expected: all map tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/fast-map.ts src/fast-map.test.ts
git commit -m "feat: show honest G2 map empty states"
```

### Task 2: Paginate complete RSS summaries before changing articles

**Files:**
- Create: `src/fast-news-pages.ts`
- Create: `src/fast-news-pages.test.ts`
- Modify: `src/fast-detail-hud.ts`
- Modify: `src/fast-detail-hud.test.ts`
- Modify: `src/fast-hud-view.ts`
- Modify: `src/fast-hud-view.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write failing measured-pagination and transition tests**

Specify the shared helper:

```ts
expect(paginateFastNewsSummary(
  context,
  "1 2 3 4 5 6 7 8 9",
)).toEqual([
  ["1", "2", "3", "4"],
  ["5", "6", "7", "8"],
  ["9"],
]);
```

Use a deterministic `measureText` fixture whose width forces those lines.
Assert missing summaries return `[[\"No summaries\"]]`.

Add `newsPage` and `newsPageCounts: [2, 3, 1]` to HUD state/context fixtures.
Test:

```ts
// next page before next article
{ newsIndex: 0, newsPage: 0 } -> { newsIndex: 0, newsPage: 1 }
// next article after last page
{ newsIndex: 0, newsPage: 1 } -> { newsIndex: 1, newsPage: 0 }
// previous article enters its last page
{ newsIndex: 1, newsPage: 0 } -> { newsIndex: 0, newsPage: 1 }
```

Add first/last boundary and clamp tests. In HUD tests, pass `newsPage`, render a
long summary, and assert page one and page two contain disjoint lines plus
`01/06 · P1/2` and `01/06 · P2/2`.

- [ ] **Step 2: Run focused news tests and verify RED**

Run:

```bash
npx vitest run src/fast-news-pages.test.ts src/fast-hud-view.test.ts \
  src/fast-detail-hud.test.ts src/App.test.tsx \
  --no-file-parallelism --maxWorkers=1
```

Expected: missing helper/state fields and old article-per-scroll behavior.

- [ ] **Step 3: Implement the shared pagination module**

Create `fast-news-pages.ts`:

```ts
export const FAST_NEWS_SUMMARY_FONT =
  'bold 21px "SFMono-Regular", Consolas, monospace';

export function paginateFastNewsSummary(
  context: CanvasRenderingContext2D,
  summary: string | undefined,
): readonly (readonly string[])[] {
  context.font = FAST_NEWS_SUMMARY_FONT;
  const lines = wrapHudTextByWidth(
    Summary ?? "No summary",
    (value) => context.measureText(value).width,
    528,
    Number.MAX_SAFE_INTEGER,
  );
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += 4) {
    pages.push(lines.slice(index, index + 4));
  }
  return pages.length > 0 ? pages : [["No summary"]];
}
```

- [ ] **Step 4: Implement article/page state and rendering**

Add `newsPage` to `FastHudViewState` and `newsPageCounts` to
`FastHudViewContext`. Clamp both in `syncFastHudView`. Replace news
`moveIndex()` use with the approved next/previous page-first transitions.

Add `newsPage` to `FastDetailHudOptions`. Render only the selected page from
`paginateFastNewsSummary()`. Format the header as:

```ts
`${articlePosition} · P${page + 1}/${pages.length}`
```

and change the footer to `SCROLL // TEXT / ARTICLES`.

In App, use the Canvas context and `paginateFastNewsSummary()` to construct `newsPageCounts`. Pass `view.newsPage` to the detail renderer. Use the same array for reducer synchronization and drawing.

- [ ] **Step 5: Run focused news tests and verify GREEN**

Run the Step 2 command. Expected: all selected tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/fast-news-pages.ts src/fast-news-pages.test.ts \
  src/fast-hud-view.ts src/fast-hud-view.test.ts \
  src/fast-detail-hud.ts src/fast-detail-hud.test.ts \
  src/App.tsx src/App.test.tsx
git commit -m "feat: paginate G2 news summaries"
```

### Task 3: Redraw both TODO check and uncheck in the input operation

**Files:**
- Modify: `src/live-dashboard-todo.test.ts`
- Modify: `src/App.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write failing immediate-redraw tests**

Extend the live session test so the already checked second item is toggled and
assert it becomes false and is persisted false.

In the App TODO detail test, make `toggleTodo` synchronously emit an updated
live state through `sessionOptions().onUpdate`. Assert each successful tap
returns `redraw`, calls `drawFastDetailHud` again, and passes `completed: true`
after check then `completed: false` after uncheck. Make a second mock return
false and assert `consume` with no extra draw.

- [ ] **Step 2: Run TODO tests and verify RED**

Run:

```bash
npx vitest run src/live-dashboard-todo.test.ts src/App.test.tsx \
  --no-file-parallelism --maxWorkers=1
```

Expected: the data-layer uncheck already passes, while App returns `consume`
and does not redraw after a successful toggle.

- [ ] **Step 3: Promote a successful toggle to redraw**

Replace the TODO effect branch with:

```ts
const changed = await liveSession?.toggleTodo(transition.effect.index)
  ?? false;
if (!changed) return "consume";
drawCurrentPage();
return "redraw";
```

Do not call `requestVisibleRefresh` and do not add a retry or pending flag.
The synchronous live-session emission updates App’s `live` snapshot before
`drawCurrentPage()`.

- [ ] **Step 4: Run TODO tests and verify GREEN**

Run the Step 2 command. Expected: all selected tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/live-dashboard-todo.test.ts
git commit -m "fix: redraw toggled G2 TODO items"
```

### Task 4: Serial regression verification and combined hardware build

**Files:**
- Create: `docs/hardware/2026-07-28-g2-honest-map-news-pages-todo.md`
- Modify: `docs/hardware/2026-07-28-g2-news-library-transport-hardening.md`

- [ ] **Step 1: Run every source test serially**

```bash
npm test
```

Expected: all Vitest files pass with `--no-file-parallelism --maxWorkers=1`.

- [ ] **Step 2: Run every server/API test serially**

```bash
node --test --test-concurrency=1 tests/*.test.mjs
```

Expected: all Node tests pass.

- [ ] **Step 3: Run typecheck and production build**

```bash
npm run typecheck
npm run build
```

Expected: both commands exit 0.

- [ ] **Step 4: Verify the combined Tailscale build**

```bash
curl -fsS -o /dev/null -w '%{http_code}\n' \
  'http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=honest-detail-026'
```

Expected: `200`.

- [ ] **Step 5: Record and commit the superseding checkpoint**

Record automated results and pending physical checks for embedded and fullscreen map empty states and marker behavior. Include multi-page news order and TODO check/uncheck. Include transfer timeout, page rollback, and responsiveness during extended use.
Mark the previous `news-library-025` record as superseded.

```bash
git add docs/hardware/2026-07-28-g2-honest-map-news-pages-todo.md \
  docs/hardware/2026-07-28-g2-news-library-transport-hardening.md
git commit -m "docs: prepare combined G2 detail checkpoint"
```

Do not push until the user confirms the physical checkpoint.
