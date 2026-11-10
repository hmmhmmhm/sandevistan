# G2 Fullscreen Map Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open a full-display live map from the overview. Retain one zoom state across map modes and movement. Route gestures without disturbing serialized G2 image transport.

**Architecture:** Add a pure map-view state machine. Parameterize the existing vector map renderer for embedded and fullscreen viewports. Let the current transport queue ask the App whether it handles an SDK input. Handled redraws use the proven four-tile `3/5/2/4` order; unhandled input preserves dashboard paging and black-frame hiding.

**Tech Stack:** React 19, TypeScript 5.9, Vitest 4, Even Hub SDK 0.0.11, Canvas 2D, Vite

**Execution:** Inline in the current worktree. The user explicitly requested direct work without subagents.

---

### Task 1: Add the pure fullscreen-map interaction state

**Files:**
- Create: `src/fast-map-view.ts`
- Create: `src/fast-map-view.test.ts`

- [x] **Step 1: Write failing state-transition tests**

Create tests that establish the public contract:

```ts
import { describe, expect, it } from "vitest";
import {
  FAST_MAP_DEFAULT_ZOOM_INDEX,
  FAST_MAP_ZOOM_RADII,
  createFastMapViewState,
  reduceFastMapInput,
} from "./fast-map-view";

describe("fast map view state", () => {
  it("enters only from overview and returns on fullscreen double tap", () => {
    const initial = createFastMapViewState();
    expect(reduceFastMapInput(initial, "news", "tap")).toEqual({
      state: initial,
      result: "unhandled",
    });
    const entered = reduceFastMapInput(initial, "overview", "tap");
    expect(entered).toEqual({
      state: { mode: "fullscreen", zoomIndex: FAST_MAP_DEFAULT_ZOOM_INDEX },
      result: "redraw",
    });
    expect(reduceFastMapInput(
      entered.state,
      "overview",
      "double-tap",
    )).toEqual({
      state: initial,
      result: "redraw",
    });
  });

  it("zooms in on bottom, out on top, and consumes both bounds", () => {
    let state = { mode: "fullscreen" as const, zoomIndex: 1 };
    state = reduceFastMapInput(state, "overview", "scroll-next").state;
    expect(FAST_MAP_ZOOM_RADII[state.zoomIndex]).toBe(500);
    state = reduceFastMapInput(state, "overview", "scroll-previous").state;
    expect(FAST_MAP_ZOOM_RADII[state.zoomIndex]).toBe(650);
    expect(reduceFastMapInput(
      { mode: "fullscreen", zoomIndex: 0 },
      "overview",
      "scroll-previous",
    ).result).toBe("consume");
    expect(reduceFastMapInput(
      {
        mode: "fullscreen",
        zoomIndex: FAST_MAP_ZOOM_RADII.length - 1,
      },
      "overview",
      "scroll-next",
    ).result).toBe("consume");
  });

  it("leaves dashboard scroll and double tap unhandled", () => {
    const state = createFastMapViewState();
    for (const input of [
      "scroll-next",
      "scroll-previous",
      "double-tap",
    ] as const) {
      expect(reduceFastMapInput(state, "overview", input)).toEqual({
        state,
        result: "unhandled",
      });
    }
  });
});
```

- [x] **Step 2: Run the state test and verify RED**

Run:

```bash
npx vitest run src/fast-map-view.test.ts \
  --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because `fast-map-view.ts` does not exist.

- [x] **Step 3: Implement the minimal pure reducer**

Create:

```ts
import type { HudPage } from "./canvas-hud";

export const FAST_MAP_ZOOM_RADII = [850, 650, 500, 375, 280] as const;
export const FAST_MAP_DEFAULT_ZOOM_INDEX = 1;

export type FastMapInput =
  | "tap"
  | "double-tap"
  | "scroll-next"
  | "scroll-previous";
export type FastMapInputResult = "unhandled" | "consume" | "redraw";
export type FastMapViewState = {
  readonly mode: "dashboard" | "fullscreen";
  readonly zoomIndex: number;
};
export type FastMapTransition = {
  readonly state: FastMapViewState;
  readonly result: FastMapInputResult;
};

export function createFastMapViewState(): FastMapViewState {
  return {
    mode: "dashboard",
    zoomIndex: FAST_MAP_DEFAULT_ZOOM_INDEX,
  };
}

export function reduceFastMapInput(
  state: FastMapViewState,
  page: HudPage,
  input: FastMapInput,
): FastMapTransition {
  if (state.mode === "dashboard") {
    if (page === "overview" && input === "tap") {
      return {
        state: { ...state, mode: "fullscreen" },
        result: "redraw",
      };
    }
    return { state, result: "unhandled" };
  }
  if (input === "double-tap") {
    return {
      state: { ...state, mode: "dashboard" },
      result: "redraw",
    };
  }
  if (input === "scroll-next") {
    if (state.zoomIndex >= FAST_MAP_ZOOM_RADII.length - 1) {
      return { state, result: "consume" };
    }
    return {
      state: { ...state, zoomIndex: state.zoomIndex + 1 },
      result: "redraw",
    };
  }
  if (input === "scroll-previous") {
    if (state.zoomIndex <= 0) return { state, result: "consume" };
    return {
      state: { ...state, zoomIndex: state.zoomIndex - 1 },
      result: "redraw",
    };
  }
  return { state, result: "consume" };
}
```

- [x] **Step 4: Run the state tests and commit**

Run:

```bash
npx vitest run src/fast-map-view.test.ts \
  --no-file-parallelism --maxWorkers=1
npm run typecheck
```

Expected: every command exits 0.

Commit:

```bash
git add src/fast-map-view.ts src/fast-map-view.test.ts
git commit -m "feat: model fullscreen G2 map input"
```

### Task 2: Generalize the OSM renderer and draw a full-display map

**Files:**
- Modify: `src/map-label-layout.ts`
- Modify: `src/map-label-layout.test.ts`
- Modify: `src/fast-map.ts`
- Modify: `src/fast-map.test.ts`
- Modify: `src/fast-canvas-hud.ts`
- Modify: `src/fast-canvas-hud.test.ts`

- [x] **Step 1: Write failing viewport and fullscreen renderer tests**

Extend label layout with a fullscreen options assertion:

```ts
const labels = layoutMapLabels(input, CENTER, {
  viewport: {
    minX: 18,
    maxX: 558,
    minY: 34,
    maxY: 244,
    centerX: 288,
    centerY: 144,
    pixelRadius: 112,
  },
  radiusMeters: 500,
  maximumLabels: 18,
});
expect(labels.every(({ x, y, width, height }) =>
  x >= 18 && x + width <= 558 && y >= 34 && y + height <= 244
)).toBe(true);
```

In `fast-map.test.ts`, capture text coordinates and assert:

```ts
const full = drawFullscreen(liveState(), 500);
expect(full.texts.map(({ value }) => value)).toEqual(expect.arrayContaining([
  "MAP // LIVE · OSM",
  "ZOOM // 500m",
  "© OSM CONTRIBUTORS",
  "DOUBLE TAP // BACK",
]));
expect(full.strokes.some(({ points }) =>
  points.some(([x]) => x > 288)
)).toBe(true);
expect(full.fills.at(-1)?.points).toContainEqual([288, 130]);
```

In `fast-canvas-hud.test.ts`, render the dashboard at 500 metres and assert the
embedded footer contains `Z // 500m` while its geometry remains inside the
left viewport.

- [x] **Step 2: Run renderer tests and verify RED**

Run separately:

```bash
npx vitest run src/map-label-layout.test.ts \
  --no-file-parallelism --maxWorkers=1
npx vitest run src/fast-map.test.ts \
  --no-file-parallelism --maxWorkers=1
npx vitest run src/fast-canvas-hud.test.ts \
  --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because renderer options and fullscreen drawing are missing.

- [x] **Step 3: Add configurable projection and label layout**

Add exported types and preserve exact embedded defaults:

```ts
export type FastMapViewport = {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly centerX: number;
  readonly centerY: number;
  readonly pixelRadius: number;
};

export const EMBEDDED_MAP_VIEWPORT: FastMapViewport = {
  minX: 18,
  maxX: 270,
  minY: 34,
  maxY: 244,
  centerX: 144,
  centerY: 144,
  pixelRadius: 112,
};
export const FULLSCREEN_MAP_VIEWPORT: FastMapViewport = {
  minX: 18,
  maxX: 558,
  minY: 34,
  maxY: 244,
  centerX: 288,
  centerY: 144,
  pixelRadius: 112,
};
```

Update label layout to accept optional viewport, radius, maximum count, and
derive its arrow exclusion from `centerX`/`centerY`. Convert the existing
`projectCoordinate()` offset:

```ts
const base = projectCoordinate(label.point, center, radiusMeters);
const anchor = {
  x: viewport.centerX
    + (base.x - 144) * viewport.pixelRadius / 112,
  y: viewport.centerY
    + (base.y - 144) * viewport.pixelRadius / 112,
};
```

Keep the default maximum at 10 and font sizes at 14/12.

- [x] **Step 4: Parameterize the map layers and add fullscreen drawing**

Change the embedded entrypoint to:

```ts
export function drawFastMap(
  context: CanvasRenderingContext2D,
  live: LiveDashboardState,
  radiusMeters = 650,
)
```

Pass viewport and radius through roads, labels, route, arrow, and footer. Add:

```ts
export function drawFastFullscreenMap(
  canvas: HTMLCanvasElement,
  live: LiveDashboardState,
  radiusMeters: number,
) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D Canvas cannot be used.");
  canvas.width = 576;
  canvas.height = 288;
  context.imageSmoothingEnabled = false;
  context.fillStyle = COLOR.background;
  context.fillRect(0, 0, 576, 288);
  drawMapLayers(
    context,
    live,
    FULLSCREEN_MAP_VIEWPORT,
    radiusMeters,
    18,
  );
  drawFullscreenHeader(context, live, radiusMeters);
  drawFullscreenFooter(context);
}
```

The header values must be exactly `MAP // <source> · <layer>` and
`ZOOM // <radius>m`. The footer must include the OSM attribution and exit hint.

- [x] **Step 5: Thread zoom through the dashboard HUD**

Extend `FastCanvasHudData`:

```ts
type FastCanvasHudData = {
  readonly battery?: FastCanvasBattery;
  readonly live: LiveDashboardState;
  readonly mapRadiusMeters?: number;
};
```

Call:

```ts
drawFastMap(context, data.live, data.mapRadiusMeters ?? 650);
```

Keep the existing function arguments compatible so callers without the field
retain the approved 650-metre view.

- [x] **Step 6: Run focused renderer tests and commit**

Run separately:

```bash
npx vitest run src/map-label-layout.test.ts \
  --no-file-parallelism --maxWorkers=1
npx vitest run src/fast-map.test.ts \
  --no-file-parallelism --maxWorkers=1
npx vitest run src/fast-canvas-hud.test.ts \
  --no-file-parallelism --maxWorkers=1
npm run typecheck
```

Expected: every command exits 0.

Commit:

```bash
git add src/map-label-layout.ts src/map-label-layout.test.ts \
  src/fast-map.ts src/fast-map.test.ts \
  src/fast-canvas-hud.ts src/fast-canvas-hud.test.ts
git commit -m "feat: render live map across the full G2 display"
```

### Task 3: Route normalized input through the serialized transport

**Files:**
- Modify: `src/fast-canvas-transport.ts`
- Modify: `src/glasses.ts`
- Modify: `src/glasses.test.ts`

- [x] **Step 1: Write failing gesture-routing transport tests**

Build on the existing fast transport harness. Pass an `onInput` spy and assert:

```ts
harness.setInputResult("redraw");
harness.emit(OsEventTypeList.CLICK_EVENT);
await vi.waitFor(() => expect(harness.imageIds).toHaveLength(8));
expect(harness.inputs).toEqual(["tap"]);
expect(harness.encodedTileIds.at(-1)).toEqual([3, 5, 2, 4]);

harness.setInputResult("consume");
harness.emit(OsEventTypeList.SCROLL_BOTTOM_EVENT);
await Promise.resolve();
expect(harness.imageIds).toHaveLength(8);

harness.setInputResult("unhandled");
harness.emit(OsEventTypeList.SCROLL_BOTTOM_EVENT);
await vi.waitFor(() => expect(harness.imageIds).toHaveLength(10));
expect(harness.encodedTileIds.at(-1)).toEqual([3, 5]);
```

Add separate assertions that:

- handled double tap redraws instead of sending black;
- unhandled double tap still sends black and the next double tap restores;
- hidden scroll and tap are ignored;
- two rapid handled redraws never overlap image updates;
- cleanup cancels a queued handled redraw.

- [x] **Step 2: Run the focused transport tests and verify RED**

Run:

```bash
npx vitest run src/glasses.test.ts -t "input" \
  --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because `onInput` is missing.

- [x] **Step 3: Add normalized input types and option**

In `fast-canvas-transport.ts`:

```ts
export type FastCanvasInput =
  | "tap"
  | "double-tap"
  | "scroll-next"
  | "scroll-previous";
export type FastCanvasInputResult = "unhandled" | "consume" | "redraw";

export type FastCanvasOptions = {
  // existing fields
  readonly onInput?: (
    input: FastCanvasInput,
  ) => FastCanvasInputResult | Promise<FastCanvasInputResult>;
};
```

Re-export both types from `glasses.ts`.

- [x] **Step 4: Run handled input inside the existing queue**

Extract `performNavigation()` and `performDisplayToggle()` from their queue
wrappers. Add an optional final `onInput` argument to `transmitCanvas()`, and
pass `options.onInput` from `transmitFastCanvas()`. Add:

```ts
const queueInput = (
  input: FastCanvasInput,
  fallback?: () => void | Promise<void>,
) => {
  if (disposed || (hidden && input !== "double-tap")) return;
  queueOperation(async () => {
    if (disposed) return;
    if (hidden && input === "double-tap") {
      await performDisplayToggle();
      return;
    }
    const result = await onInput?.(input) ?? "unhandled";
    if (disposed) return;
    if (result === "redraw") {
      await refreshImages(source, G2_FAST_TILES, "Map screen transfer complete");
    } else if (result === "unhandled") {
      await fallback?.();
    }
  });
};
```

Map SDK events:

```ts
if (eventType === OsEventTypeList.CLICK_EVENT) {
  queueInput("tap");
} else if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
  queueInput("double-tap", performDisplayToggle);
} else if (eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
  queueInput("scroll-next", () => performNavigation("next"));
} else if (eventType === OsEventTypeList.SCROLL_TOP_EVENT) {
  queueInput("scroll-previous", () => performNavigation("previous"));
}
```

Do not create a second promise queue or bypass `refreshImages()`.

- [x] **Step 5: Run transport regression tests and commit**

Run separately:

```bash
npx vitest run src/glasses.test.ts -t "input" \
  --no-file-parallelism --maxWorkers=1
npx vitest run src/glasses.test.ts -t "fast Canvas" \
  --no-file-parallelism --maxWorkers=1
npx vitest run src/glasses.test.ts -t "live refresh" \
  --no-file-parallelism --maxWorkers=1
npm run typecheck
```

Expected: every command exits 0.

Commit:

```bash
git add src/fast-canvas-transport.ts src/glasses.ts src/glasses.test.ts
git commit -m "feat: serialize G2 fullscreen map gestures"
```

### Task 4: Integrate map mode, zoom, and live refresh routing in App

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [x] **Step 1: Write failing App interaction tests**

Extend `FastTestOptions` with `onInput`. Capture the callback and assert:

```ts
expect(await input?.("tap")).toBe("redraw");
expect(mocks.drawFullscreen).toHaveBeenLastCalledWith(
  expect.any(HTMLCanvasElement),
  expect.any(Object),
  650,
);
expect(await input?.("scroll-next")).toBe("redraw");
expect(mocks.drawFullscreen).toHaveBeenLastCalledWith(
  expect.any(HTMLCanvasElement),
  expect.any(Object),
  500,
);
expect(await input?.("double-tap")).toBe("redraw");
expect(mocks.drawFast).toHaveBeenLastCalledWith(
  expect.any(HTMLCanvasElement),
  expect.any(Date),
  "overview",
  expect.objectContaining({ mapRadiusMeters: 500 }),
);
```

Navigate to news before tapping and assert `unhandled`. Enter fullscreen and
invoke provider updates:

```ts
sessionOptions().onUpdate({ state: moved, target: "left" });
expect(requestRefresh).toHaveBeenCalledWith("all");
sessionOptions().onUpdate({ state: weather, target: "right" });
expect(requestRefresh).not.toHaveBeenCalled();
```

Assert minute and battery `right-top` sends are also suppressed in fullscreen,
then exit and confirm the latest state is rendered.

- [x] **Step 2: Run App tests and verify RED**

Run:

```bash
npx vitest run src/App.test.tsx -t "fullscreen map" \
  --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because App has no fullscreen mode or input callback.

- [x] **Step 3: Add App-owned view state and renderer selection**

Initialize inside the effect:

```ts
let mapView = createFastMapViewState();
const currentMapRadius = () => FAST_MAP_ZOOM_RADII[mapView.zoomIndex];
const drawCurrentPage = () => {
  if (fastCanvasHudMode && mapView.mode === "fullscreen") {
    drawFastFullscreenMap(canvas, live, currentMapRadius());
  } else if (fastCanvasHudMode) {
    drawFastCanvasHud(canvas, new Date(), page, {
      battery,
      live,
      mapRadiusMeters: currentMapRadius(),
    });
  } else {
    drawDenseCanvasHud(canvas, new Date(), page);
  }
};
```

Pass:

```ts
onInput: (input) => {
  const transition = reduceFastMapInput(mapView, page, input);
  mapView = transition.state;
  if (transition.result === "redraw") drawCurrentPage();
  return transition.result;
},
```

- [x] **Step 4: Route external updates by visible mode**

Add one wrapper:

```ts
const requestVisibleRefresh = (target: FastCanvasRefreshTarget) => {
  if (!requestLiveRefresh) return;
  if (mapView.mode === "dashboard") {
    requestLiveRefresh(target);
  } else if (target === "left") {
    requestLiveRefresh("all");
  }
};
```

Use it for dashboard session updates, minute ticks, and battery changes. Keep
the existing initial draw behavior before the transport exposes its request
function.

- [x] **Step 5: Run focused App and integration tests**

Run separately:

```bash
npx vitest run src/App.test.tsx -t "fullscreen map" \
  --no-file-parallelism --maxWorkers=1
npx vitest run src/App.test.tsx \
  --no-file-parallelism --maxWorkers=1
npx vitest run src/live-dashboard-map.test.ts \
  --no-file-parallelism --maxWorkers=1
npm run typecheck
```

Expected: every command exits 0.

- [x] **Step 6: Commit App integration**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: open and zoom fullscreen G2 map"
```

### Task 5: Prepare the serial physical G2 checkpoint

**Files:**
- Modify: `src/sdk-version.test.ts`
- Modify: `package.json`
- Create: `docs/hardware/2026-07-27-g2-fullscreen-map.md`
- Modify: `docs/superpowers/plans/2026-07-27-g2-fullscreen-map.md`

- [x] **Step 1: Write the failing build identity assertion**

Set the expected QR URL to:

```text
http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=fullscreen-map-018
```

- [x] **Step 2: Run the SDK test and verify RED**

Run:

```bash
npx vitest run src/sdk-version.test.ts \
  --no-file-parallelism --maxWorkers=1
```

Expected: 1/2 fails because the package script still identifies
`live-refresh-017`.

- [x] **Step 3: Update the QR script and verify GREEN**

Update `package.json`, then rerun the SDK test. Expected: 2/2 pass.

- [x] **Step 4: Run the full serial verification gate**

Run one command at a time:

```bash
npm test
npm run typecheck
npm run build
npm run test:sites
node --test --test-concurrency=1 tests/api-router.test.mjs
node --test --test-concurrency=1 tests/map-api.test.mjs
node --test --test-concurrency=1 tests/news-api.test.mjs
git diff --check
```

Expected: every command exits 0 and no test file runs in parallel.

- [x] **Step 5: Record truthful automated evidence**

Create the hardware record with:

- exact tested implementation commit and URL;
- exact source, typecheck, build, Sites, and API results;
- `PENDING` for every physical observation in the approved design;
- no inference from automated gesture or transport tests.

Commit the code and pending record without pushing.

- [x] **Step 6: Restart only port 4176 and open the QR**

Restart the current Vite process with:

```bash
npm run dev -- --host 0.0.0.0 --port 4176 --strictPort
```

Verify HTTP 200 for the exact URL, then run `npm run qr`.

- [ ] **Step 7: Record the direct G2 result and push**

After the user reports the physical result, replace only the observed
`PENDING` entries, commit, run `git status -sb`, and push
`feature/g2-fast-content`.
