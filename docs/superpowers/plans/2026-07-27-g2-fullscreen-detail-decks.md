# G2 full screen detailed deck implementation plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **Legacy evidence:** Historical RELIC names, paths, storage keys, and
> transport identifiers in this record are preserved exactly as they appeared at
> the time. Current main-branch identifiers use Sandevistan.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 576×288 full-screen detail deck for dashboard news, TODOs, and navigation. Open the deck with a single tap. Use glasses gestures to navigate and operate the deck.

**Architecture:** Replace the existing map-only state with a shared detail-screen state machine. Normalize RSS digests and persistent TODOs to a `LiveDashboardState`. Keep the per-page Canvas renderer separate from the update filter. The filter sends only the changes that the current detail screen needs across four tiles. All input and image transmission use the existing serial queue.

**Tech Stack:** Even Hub SDK `0.0.11`, React 19, TypeScript 5.9, Canvas 2D, Vitest, Even local storage, RSS

---

The historical user instruction required direct implementation in the current session without a subagent.
The approved specification is
`docs/superpowers/specs/2026-07-27-g2-fullscreen-detail-decks-design.md`.
The recorded commit is `ea42e058d951ea7bd55b657b7c39bacf8d5a7290`.

### Task 1: Normalize RSS article summaries and include them in the cache

**Files:**
- Modify: `src/live-state.ts`
- Modify: `src/news.ts`
- Modify: `src/news.test.ts`

- [x] **Step 1: Write an RSS Summary Failure Test**

Add the following description to the first item of the test RSS.

```xml
<description><![CDATA[
  <p>This is a summary of the first sentence.</p>
  <script>Code to remove</script>
  This is the second sentence.
]]></description>
```

Add the following expected values:

```ts
expect(items[0].summary).toBe(
  "This is a summary of the first sentence. Here is the second sentence.",
);
expect(parseNewsRss(longSummaryRss)[0].summary).toHaveLength(360);
```

Add cache tests for `summary`. Confirm that the parser ignores a cache containing control characters or a summary with 361 code points.

- [x] **Step 2: Check for failure**

Run:

```bash
npx vitest run src/news.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: Failed because `summary` is `undefined`.

- [x] **Step 3: Minimal Implementation**

Add the following fields to `NewsItem`.

```ts
readonly summary?: string;
```

Add the following restrictions to `news.ts`:

```ts
const NEWS_SUMMARY_MAX_CODE_POINTS = 360;
```

Remove `script` and `style` elements during summary sanitation associated with `sanitizeText()`.
Replace control characters with spaces. Then truncate the summary.

```ts
function sanitizeSummary(value: string): string | undefined {
  const document = new DOMParser().parseFromString(value, "text/html");
  document.querySelectorAll("script,style").forEach((node) => node.remove());
  const clean = (document.body.textContent ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return undefined;
  return [...clean].slice(0, NEWS_SUMMARY_MAX_CODE_POINTS).join("");
}
```

Make `parseNewsRss()` read `<description>`. Preserve the summary during cache validation and in `cloneItems()`.

- [x] **Step 4: Confirm passing**

Run:

```bash
npx vitest run src/news.test.ts --no-file-parallelism --maxWorkers=1
npm run typecheck
```

Expected: All news tests and type checks pass.

- [x] **Step 5: Commit**

```bash
git add src/live-state.ts src/news.ts src/news.test.ts
git commit -m "feat: retain sanitized RSS summaries"
```

### Task 2: Implement persistent TODO model and repository

**Files:**
- Create: `src/todos.ts`
- Create: `src/todos.test.ts`
- Modify: `src/live-state.ts`

- [x] **Step 1: Write a TODO repository failure test**

Verify the following operation.

```ts
expect(DEFAULT_TODOS).toEqual([
  { id: "station", title: "Go to the subway station", completed: false },
  { id: "umbrella", title: "Carrying an umbrella", completed: false },
  { id: "route", title: "Check route", completed: true },
]);

await expect(resolveTodos(emptyStorage)).resolves.toEqual(DEFAULT_TODOS);
await expect(resolveTodos(validStorage)).resolves.toEqual(savedTodos);
await expect(resolveTodos(corruptStorage)).resolves.toEqual(DEFAULT_TODOS);

expect(toggleTodo(DEFAULT_TODOS, 1)[1].completed).toBe(true);
expect(toggleTodo(DEFAULT_TODOS, -1)).toBe(DEFAULT_TODOS);
await expect(writeTodos(failingStorage, changed)).resolves.toBe(false);
```

If a title is empty or exceeds 40 code points, restore the default cache values.
Also restore the defaults if IDs are duplicated or the cache contains more than 6 entries.

- [x] **Step 2: Check for failure**

Run:

```bash
npx vitest run src/todos.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: Failed because the `./todos` module was not found.

- [x] **Step 3: Minimal Implementation**

Add the following model, state, and initial value to `live-state.ts`.

```ts
export type TodoItem = {
  readonly id: string;
  readonly title: string;
  readonly completed: boolean;
};

readonly todos: DataState<readonly TodoItem[]>;

export const DEFAULT_TODOS: readonly TodoItem[];
```

Initialize the three items of `DEFAULT_TODOS` with status `fresh`.
To avoid a circular import, define the initial value in `live-state.ts`. Re-export the value from `todos.ts`.
`todos.ts` provides the following API.

```ts
export const DEFAULT_TODOS: readonly TodoItem[];
export async function resolveTodos(
  storage: EvenStorage,
): Promise<readonly TodoItem[]>;
export function toggleTodo(
  items: readonly TodoItem[],
  index: number,
): readonly TodoItem[];
export function writeTodos(
  storage: EvenStorage,
  items: readonly TodoItem[],
): Promise<boolean>;
```

In `readCache()` and `writeCache()`, pass `"todos"`. The actual stored key is `relic:todos:v1`.

- [x] **Step 4: Confirm passing**

Run:

```bash
npx vitest run src/todos.test.ts --no-file-parallelism --maxWorkers=1
npm run typecheck
```

Expected: TODO test and type check pass.

- [x] **Step 5: Commit**

```bash
git add src/live-state.ts src/todos.ts src/todos.test.ts
git commit -m "feat: persist G2 todo state"
```

### Task 3: Add TODO restoration and toggle to live sessions

**Files:**
- Modify: `src/live-dashboard.ts`
- Create: `src/live-dashboard-todo.test.ts`
- Modify: `src/live-dashboard.test.ts`

- [x] **Step 1: Write a session failure test**

Expects the following contract in the return value of `createLiveDashboardSession()`.

```ts
toggleTodo(index: number): Promise<boolean>;
```

The test checks:

```ts
await session.start();
expect(session.getState().todos.value).toEqual(savedTodos);

await expect(session.toggleTodo(0)).resolves.toBe(true);
expect(session.getState().todos.value?.[0].completed).toBe(true);
expect(updates.at(-1)?.target).toBe("right");
expect(JSON.parse(bridge.values.get("relic:todos:v1")!)[0].completed)
  .toBe(true);
```

For an out-of-range index or a call after disposal, return `false`. Do not change state or storage.
If a save fails, preserve the completion status in the current session.

- [x] **Step 2: Check for failure**

Run:

```bash
npx vitest run src/live-dashboard-todo.test.ts \
  --no-file-parallelism --maxWorkers=1
```

Expected: Fails because `toggleTodo` is missing.

- [x] **Step 3: Minimal Implementation**

At session start, call `resolveTodos()`. If the saved value differs from the initial state, update the state and emit `right`.

```ts
const toggleTodoAt = async (index: number): Promise<boolean> => {
  const current = state.todos.value ?? [];
  const next = toggleTodo(current, index);
  if (disposed || next === current) return false;
  state = { ...state, todos: { status: "fresh", value: clone(next) } };
  emit("right");
  await writeTodos(options.bridge, next);
  return true;
};
```

First, update the state and request a transfer. Wait for the save to finish. Then return.

- [x] **Step 4: Confirm passing**

Run:

```bash
npx vitest run src/live-dashboard.test.ts \
  src/live-dashboard-todo.test.ts \
  --no-file-parallelism --maxWorkers=1
npm run typecheck
```

Expected: Live session testing and type checking pass.

- [x] **Step 5: Commit**

```bash
git add src/live-dashboard.ts src/live-dashboard.test.ts \
  src/live-dashboard-todo.test.ts
git commit -m "feat: expose live todo toggles"
```

### Task 4: Implementing a common detailed screen state machine

**Files:**
- Create: `src/fast-hud-view.ts`
- Create: `src/fast-hud-view.test.ts`

- [x] **Step 1: Write a state transition failure test**

Fix the test context as follows:

```ts
const context = {
  newsCount: 6,
  todoCount: 3,
  maneuverCount: 4,
  activeManeuverIndex: 1,
};
```

Check each of the following operations.

```ts
expect(enter(initial, "overview", "tap").state.mode).toBe("map");
expect(enter(initial, "news", "tap").state.mode).toBe("news");
expect(enter(initial, "todo", "tap").state.mode).toBe("todo");
expect(enter(initial, "navigation", "tap").state).toMatchObject({
  mode: "navigation",
  navigationIndex: 1,
  navigationFollowsActive: true,
});
```

Check next/previous movement, border `consume`, and double tap return on each detail screen.
The TODO tab should return the following effect:

```ts
{
  result: "consume",
  effect: { type: "toggle-todo", index: 1 },
}
```

On navigation scroll, set `navigationFollowsActive: false`. On tap, return to the current step and set the flag to `true`.
In `syncFastHudView()`, clamp all indices when the item count decreases.

- [x] **Step 2: Check for failure**

Run:

```bash
npx vitest run src/fast-hud-view.test.ts \
  --no-file-parallelism --maxWorkers=1
```

Expected: Fails due to no new state module.

- [x] **Step 3: Minimal Implementation**

Implement the following API.

```ts
export const FAST_MAP_ZOOM_RADII = [850, 650, 500, 375, 280] as const;
export function createFastHudViewState(): FastHudViewState;
export function syncFastHudView(
  state: FastHudViewState,
  context: FastHudViewContext,
): FastHudViewState;
export function reduceFastHudInput(
  state: FastHudViewState,
  page: HudPage,
  input: FastCanvasInput,
  context: FastHudViewContext,
): FastHudTransition;
```

Keep the existing map zoom direction and default value of 650m.
Dashboard scrolling and double tap remain `unhandled`.
Keep the existing `fast-map-view.ts` until Task 7 moves the App to the new state model.

- [x] **Step 4: Confirm passing**

Run:

```bash
npx vitest run src/fast-hud-view.test.ts \
  --no-file-parallelism --maxWorkers=1
npm run typecheck
```

Expected: State transition tests and type checks pass.

- [x] **Step 5: Commit**

```bash
git add src/fast-hud-view.ts src/fast-hud-view.test.ts
git commit -m "feat: model fullscreen G2 detail input"
```

### Task 5: Implement full-screen news, TODO, and navigation renderers

**Files:**
- Create: `src/fast-detail-text.ts`
- Create: `src/fast-detail-text.test.ts`
- Create: `src/fast-detail-hud.ts`
- Create: `src/fast-detail-hud.test.ts`
- Modify: `src/fast-canvas-style.ts`

- [x] **Step 1: Write a line break failure test**

```ts
expect(wrapHudText("Ganadaramabasa", 6, 2)).toEqual([
  “Ghana”,
  “Rama…”,
]);
expect(wrapHudText("alpha beta gamma", 10, 2)).toEqual([
  "alpha beta",
  "gamma",
]);
```

Test empty strings, long words, and mixed Korean and English characters.
Also test a maximum line count of 0.

- [x] **Step 2: Write a renderer failure test**

Collect the text drawn by the fake Canvas and check the following.

```ts
drawFastDetailHud(canvas, {
  mode: "news",
  live,
  newsIndex: 0,
  todoIndex: 0,
  navigationIndex: 0,
});
expect(texts).toContain("NEWS // LIVE");
expect(texts).toContain("01 / 06");
expect(texts.join(" ")).toContain("RSS Summary");

expect(todoTexts).toEqual(expect.arrayContaining([
  "TODO // ACTIVE",
  "Complete 1 / 3",
  "TAP // TOGGLE",
]));

expect(navTexts).toEqual(expect.arrayContaining([
  "NAV // ACTIVE",
  "STEP 01 / 02",
  "TAP // CURRENT",
]));
```

For every render, verify that the Canvas is 576×288.
Test the status labels `LOADING`, `STALE`, `UNAVAILABLE`, and `DISABLED`.
Verify that `DOUBLE TAP // BACK` is visible.

- [x] **Step 3: Check for failure**

Run:

```bash
npx vitest run src/fast-detail-text.test.ts \
  src/fast-detail-hud.test.ts \
  --no-file-parallelism --maxWorkers=1
```

Expected: Failure due to missing two modules.

- [x] **Step 4: Minimal Implementation**

In `fast-detail-text.ts`, count each ASCII character as 1 unit and each non-ASCII character as 2 units.
Prefer word boundaries when wrapping lines. If content remains after the last line, reserve 2 units for an ellipsis.
The historical literal `… Enter ` is ambiguous. Confirm the intended ellipsis and trailing space against the approved specification before implementation.

`fast-detail-hud.ts` provides one API:

```ts
export function drawFastDetailHud(
  canvas: HTMLCanvasElement,
  options: {
    readonly mode: "news" | "todo" | "navigation";
    readonly live: LiveDashboardState;
    readonly newsIndex: number;
    readonly todoIndex: number;
    readonly navigationIndex: number;
  },
): void;
```

Draw a common header, an open-corner body frame, a black footer, and mode-specific content.
Use separate internal functions. Reuse the existing colors, text helpers, and path helpers.

- [x] **Step 5: Confirm passing**

Run:

```bash
npx vitest run src/fast-detail-text.test.ts \
  src/fast-detail-hud.test.ts \
  --no-file-parallelism --maxWorkers=1
npm run typecheck
```

Expected: Renderer and type checks pass.

- [x] **Step 6: Commit**

```bash
git add src/fast-detail-text.ts src/fast-detail-text.test.ts \
  src/fast-detail-hud.ts src/fast-detail-hud.test.ts \
  src/fast-canvas-style.ts
git commit -m "feat: render fullscreen G2 detail decks"
```

### Task 6: Implementing detailed screen live update filter

**Files:**
- Create: `src/fast-detail-refresh.ts`
- Create: `src/fast-detail-refresh.test.ts`

- [x] **Step 1: Write a failure test**

It expects the following pure function:

```ts
export function detailRefreshTarget(
  mode: FastHudViewMode,
  previous: LiveDashboardState,
  next: LiveDashboardState,
  sourceTarget: FastCanvasRefreshTarget,
): FastCanvasRefreshTarget | undefined;
```

The test checks the following mapping:

```ts
expect(detailRefreshTarget("dashboard", before, after, "right"))
  .toBe("right");
expect(detailRefreshTarget("map", before, moved, "left")).toBe("all");
expect(detailRefreshTarget("map", before, weather, "right"))
  .toBeUndefined();
expect(detailRefreshTarget("news", before, newsChanged, "right"))
  .toBe("all");
expect(detailRefreshTarget("todo", before, todosChanged, "right"))
  .toBe("all");
expect(detailRefreshTarget("navigation", before, routeChanged, "right"))
  .toBe("all");
expect(detailRefreshTarget("news", before, routeChanged, "all"))
  .toBeUndefined();
```

For news, compare status, `fetchedAt`, ID, title, summary, and publication time.
For TODOs, compare ID, title, and completion status.
For navigation, compare status, destination, `fetchedAt`, active step, visible distance bucket, and step list.
Do not serialize the entire route coordinate array on each position update.

- [x] **Step 2: Check for failure**

Run:

```bash
npx vitest run src/fast-detail-refresh.test.ts \
  --no-file-parallelism --maxWorkers=1
```

Expected: Failure due to missing update filter module.

- [x] **Step 3: Minimum implementation and check for passing**

Create a small equality function for each data type.
Promote changes to `all` only when they affect the visible mode.

Run:

```bash
npx vitest run src/fast-detail-refresh.test.ts \
  --no-file-parallelism --maxWorkers=1
npm run typecheck
```

Expected: Update filter test and type check pass.

- [x] **Step 4: Commit**

```bash
git add src/fast-detail-refresh.ts src/fast-detail-refresh.test.ts
git commit -m "feat: filter fullscreen detail refreshes"
```

### Task 7: Integrating App and Serial Transmission Queue

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/fast-canvas-transport.ts`
- Modify: `src/glasses.test.ts`
- Delete: `src/fast-map-view.ts`
- Delete: `src/fast-map-view.test.ts`

- [x] **Step 1: Write an App Failure Test**

Add `drawFastDetailHud` to the renderer mock. Verify the result of one tap on a dashboard page.

```ts
await navigate?.("next"); // NEWS
expect(await fastOptions().onInput?.("tap")).toBe("redraw");
expect(mocks.drawDetail).toHaveBeenCalledWith(
  expect.any(HTMLCanvasElement),
  expect.objectContaining({ mode: "news", newsIndex: 0 }),
);
```

In TODO detail, scroll and tap. Verify that the controller calls `session.toggleTodo(1)` exactly once and returns `consume`.
When the session sends changed TODO data through `onUpdate`, verify one call to `requestRefresh("all")`.

In news detail, do not transmit updates that change only weather or routing.
In every detail screen, do not transmit battery-only changes.
For visible news, TODO, or route changes, request `all`.
On double tap, redraw the complete dashboard page from which the user entered detail.

- [x] **Step 2: Write a transfer failure test**

In `glasses.test.ts`, test entry to news detail, scrolling, and return.
For each `redraw`, verify serial transmission to `3/5/2/4`.
A boundary `consume` must not send an image.
The TODO effect's `consume` must not send an image directly from the input handler.

- [x] **Step 3: Check for failure**

Run:

```bash
npx vitest run src/App.test.tsx \
  src/glasses.test.ts \
  --no-file-parallelism --maxWorkers=1
```

Expected: Failure due to lack of detailed renderer, new state and TODO session call.

- [x] **Step 4: Minimal App Integration**

Replace the map state in `App.tsx` with `FastHudViewState`.
At the start of `drawCurrentPage()`, synchronize the state with the current item counts and active step.
Then draw as follows:

```ts
if (view.mode === "map") {
  drawFastFullscreenMap(canvas, live, currentMapRadius());
} else if (view.mode !== "dashboard") {
  drawFastDetailHud(canvas, {
    mode: view.mode,
    live,
    newsIndex: view.newsIndex,
    todoIndex: view.todoIndex,
    navigationIndex: view.navigationIndex,
  });
} else {
  drawFastCanvasHud(canvas, new Date(), page, data);
}
```

If the input effect is `toggle-todo`, await `liveSession?.toggleTodo(index)`.
Return `consume`. For another `redraw` result, draw the Canvas immediately through the existing path.

During session updates, preserve the previous state for `detailRefreshTarget()`.
Determine the transmission target before changing the state.
Send minute and battery refreshes only when `view.mode === "dashboard"`.

- [x] **Step 5: Generalize the transfer phrase**

Change the `redraw` completion message in `fast-canvas-transport.ts`
to `"Detailed screen transfer completed"`. Preserve the transfer order and tile set.

- [x] **Step 6: Confirm passing**

Run:

```bash
npx vitest run src/App.test.tsx \
  src/glasses.test.ts \
  --no-file-parallelism --maxWorkers=1
npm run typecheck
```

Expected: App, transport and type checking pass.

- [x] **Step 7: Check file length and commit**

Run:

```bash
find src -maxdepth 1 \( -name '*.ts' -o -name '*.tsx' -o -name '*.css' \) \
  ! -name '*.test.ts' ! -name '*.test.tsx' -print0 |
  xargs -0 wc -l | sort -nr
```

Expected: All implementation files are 450 lines or less.

```bash
git add src/App.tsx src/App.test.tsx \
  src/fast-canvas-transport.ts src/glasses.test.ts \
  src/fast-map-view.ts src/fast-map-view.test.ts
git commit -m "feat: open detail decks from every G2 tab"
```

### Task 8: Full verification, documentation and test servers

**Files:**
- Create: `docs/hardware/2026-07-27-g2-fullscreen-detail-decks.md`
- Modify: `README.md`
- Modify: `package.json`
- Modify: `docs/hardware/2026-07-27-project-completion-audit.md`

- [x] **Step 1: Full Verification**

Run serially:

```bash
npm test
npm run typecheck
npm run build
npm run test:sites
node --test --test-concurrency=1 \
  tests/api-router.test.mjs \
  tests/map-api.test.mjs \
  tests/news-api.test.mjs \
  tests/route-api.test.mjs
git grep -n "ORS_API_KEY" -- src app.json package.json
git diff --check
```

Expected: All tests and builds pass. The client-key search returns no results and exits with code 1.

- [x] **Step 2: Create checkpoint document**

Record the following in the new document:

```text
SDK: 0.0.11
Build: detail-decks-019
Result: PENDING
```

Add physical checks for news summaries, TODO selection and saving, navigation steps, map zoom, return, and the black screen.
Check all four tiles in both eyes and record any `SENDFAILED` result.
For automated verification figures, record only the results of commands that were actually run.

- [x] **Step 3: Update QR and README**

Replace the `qr` build ID in `package.json` with `detail-decks-019`.
Update the physical test URL and detail-deck gestures.

- [x] **Step 4: Document Verification and Commit**

Run:

```bash
git diff --check
git status --short
```

```bash
git add README.md package.json \
  docs/hardware/2026-07-27-g2-fullscreen-detail-decks.md \
  docs/hardware/2026-07-27-project-completion-audit.md
git commit -m "docs: prepare G2 detail deck checkpoint"
```

- [x] **Step 5: Replace the 4176 server only once**

Terminate the existing `fullscreen-map-018` Vite session normally.
Verify that the port is free. Run only one server on the new branch:

```bash
npm run dev -- --host 0.0.0.0 --port 4176 --strictPort
```

Verify that both the local and Tailscale responses to the following URL are HTTP 200.

```text
http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=detail-decks-019
```

In the absence of a key, the following API is also serially checked.

```text
GET /api/routing-status -> 200 { "enabled": false }
GET /api/news?feed=sbs-latest -> 200 RSS
GET /api/map?... -> 200 normalized OSM
```

- [ ] **Step 6: Wait for the actual G2**

After charging the glasses, observe the checkpoint directly.
Until physical verification finishes, do not integrate the implementation branch or push remotely.
Do not send completion notifications or mark the goal complete.
