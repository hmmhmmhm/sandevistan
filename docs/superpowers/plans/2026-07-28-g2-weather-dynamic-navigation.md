# G2 Weather Detail and Dynamic Navigation Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a weather-focused fourth Fast Canvas page and full-screen weather detail while showing Navigation only when ORS is enabled.

**Architecture:** Keep legacy Canvas and Hybrid page models unchanged. Add a Fast Canvas-only page model that derives a four- or five-page circular list from route status. Pass the model through the raster dashboard, detail-state reducer, detail renderer, refresh selector, and App session. Reuse the existing keyless Open-Meteo `WeatherValue`. Do not expand the network response or cache schema.

**Tech Stack:** TypeScript, React, Canvas 2D, Vitest with jsdom, Vite, Even Realities G2 raster transport.

---

Implementation is inline in the existing isolated worktree because the user has
explicitly requested no subagents. Run every test command serially with
`--no-file-parallelism --maxWorkers=1` or `--test-concurrency=1`.

### Task 1: Isolate the Fast Canvas Dynamic Page Model

**Files:**
- Create: `src/fast-hud-pages.ts`
- Create: `src/fast-hud-pages.test.ts`
- Modify: `src/fast-canvas-hud.ts`
- Modify: `src/fast-canvas-hud.test.ts`

- [ ] **Step 1: Write failing dynamic page-list tests**

Create `src/fast-hud-pages.test.ts` with explicit keyless and routed orders,
normalization, and circular movement:

```ts
import { describe, expect, it } from "vitest";
import {
  getAdjacentFastHudPage,
  getFastHudPages,
  normalizeFastHudPage,
} from "./fast-hud-pages";

describe("Fast Canvas page model", () => {
  it("uses Weather as the fourth and final keyless page", () => {
    expect(getFastHudPages("disabled")).toEqual([
      "overview",
      "news",
      "todo",
      "weather",
    ]);
    expect(getAdjacentFastHudPage(
      "weather",
      "next",
      "disabled",
    )).toBe("overview");
    expect(getAdjacentFastHudPage(
      "overview",
      "previous",
      "disabled",
    )).toBe("weather");
  });

  it("adds Navigation last whenever routing is enabled", () => {
    expect(getFastHudPages("fresh")).toEqual([
      "overview",
      "news",
      "todo",
      "weather",
      "navigation",
    ]);
    expect(getAdjacentFastHudPage(
      "weather",
      "next",
      "fresh",
    )).toBe("navigation");
  });

  it("normalizes a removed Navigation page to Weather", () => {
    expect(normalizeFastHudPage("navigation", "disabled")).toBe("weather");
    expect(normalizeFastHudPage("news", "disabled")).toBe("news");
  });
});
```

- [ ] **Step 2: Run the page-list test and verify RED**

Run:

```bash
npx vitest run src/fast-hud-pages.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because `src/fast-hud-pages.ts` does not exist.

- [ ] **Step 3: Implement the focused Fast Canvas page model**

Create `src/fast-hud-pages.ts`:

```ts
import type { HudPage } from "./canvas-hud";
import type { DataStatus } from "./live-state";

export type FastHudPage = HudPage | "weather";
export type FastHudPageDirection = "next" | "previous";

const KEYLESS_FAST_HUD_PAGES = [
  "overview",
  "news",
  "todo",
  "weather",
] as const satisfies readonly FastHudPage[];

const ROUTED_FAST_HUD_PAGES = [
  ...KEYLESS_FAST_HUD_PAGES,
  "navigation",
] as const satisfies readonly FastHudPage[];

export function getFastHudPages(
  routeStatus: DataStatus,
): readonly FastHudPage[] {
  return routeStatus === "disabled"
    ? KEYLESS_FAST_HUD_PAGES
    : ROUTED_FAST_HUD_PAGES;
}

export function normalizeFastHudPage(
  page: FastHudPage,
  routeStatus: DataStatus,
): FastHudPage {
  const pages = getFastHudPages(routeStatus);
  return pages.includes(page) ? page : "weather";
}

export function getAdjacentFastHudPage(
  page: FastHudPage,
  direction: FastHudPageDirection,
  routeStatus: DataStatus,
): FastHudPage {
  const pages = getFastHudPages(routeStatus);
  const current = normalizeFastHudPage(page, routeStatus);
  const index = pages.indexOf(current);
  const offset = direction === "next" ? 1 : -1;
  return pages[(index + offset + pages.length) % pages.length];
}
```

Remove the fixed `FAST_HUD_PAGES` and adjacency implementation from
`src/fast-canvas-hud.ts`; import the new page type and helpers instead.
Update `src/fast-canvas-hud.test.ts` imports/types so later renderer tests can
pass route status explicitly.

- [ ] **Step 4: Run page model tests and verify GREEN**

Run:

```bash
npx vitest run src/fast-hud-pages.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit the dynamic page model**

```bash
git add src/fast-hud-pages.ts src/fast-hud-pages.test.ts \
  src/fast-canvas-hud.ts src/fast-canvas-hud.test.ts
git commit -m "feat: model dynamic G2 weather pages"
```

### Task 2: Render the Weather-Only Dashboard Page

**Files:**
- Modify: `src/fast-canvas-hud.ts`
- Modify: `src/fast-canvas-hud.test.ts`

- [ ] **Step 1: Write failing weather dashboard tests**

Add tests that render `weather` with a fresh `WeatherValue`, loading state, and
unavailable state. The fresh assertion must include:

```ts
expect(hud.values).toEqual(expect.arrayContaining([
  "WEATHER // NOW",
  "28°C",
  "lucidity",
  “Feels like 30°”,
  “Humidity 63%”,
  "Precipitation 20%",
  “Wind 8 km/h”,
  "04 / 04",
]));
expect(hud.values).not.toContain("Route key required");
expect(hud.values).not.toContain("Use after connecting ORS");
```

Add a routed-state assertion:

```ts
expect(renderFastHud(module, "navigation", {
  live: routedLive,
}).values).toContain("05 / 05");
```

Add a disabled-navigation normalization assertion:

```ts
const disabled = renderFastHud(module, "navigation");
expect(disabled.values).toContain("WEATHER // LOADING");
expect(disabled.values).not.toContain("NAV // DISABLED");
```

- [ ] **Step 2: Run renderer tests and verify RED**

Run:

```bash
npx vitest run src/fast-canvas-hud.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because `weather` is unsupported and the page counter is fixed
at four.

- [ ] **Step 3: Implement weather rendering and dynamic counters**

In `src/fast-canvas-hud.ts`:

1. Change `drawDynamicHeader` and `drawDynamicPage` to accept
   `FastHudPage`.
2. In `drawFastCanvasHud`, normalize the requested page using
   `normalizeFastHudPage(page, data.live.route.status)`.
3. Derive `pages = getFastHudPages(data.live.route.status)` and render
   `${current} / ${pages.length}` rather than the fixed `/ 04`.
4. Add a focused renderer:

```ts
function drawWeather(
  context: CanvasRenderingContext2D,
  live: LiveDashboardState,
) {
  const weather = usableWeather(live);
  const status = live.weather.status === "stale"
    ? "WEATHER // LAST"
    : live.weather.status === "loading"
      ? "WEATHER // LOADING"
      : weather
        ? "WEATHER // NOW"
        : "WEATHER // UNAVAILABLE";
  drawText(context, status, 308, 82, 11, COLOR.secondary, "bold");
  if (!weather) {
    drawText(
      context,
      live.weather.status === "loading"
        ? "Loading weather"
        : "WEATHER DATA UNAVAILABLE",
      308,
      112,
      18,
      COLOR.primary,
      "bold",
    );
    return;
  }
  drawText(
    context,
    `${Math.round(weather.temperature)}°C`,
    308,
    104,
    30,
    COLOR.primary,
    "bold",
  );
  drawText(context, weather.condition, 410, 112, 18, COLOR.secondary, "bold");
  drawText(
    context,
    `Feel ${Math.round(weather.apparentTemperature)}°`,
    308,
    158,
    15,
    COLOR.primary,
    "bold",
  );
  drawText(
    context,
    `Humidity ${Math.round(weather.humidity)}%`,
    430,
    158,
    15,
    COLOR.primary,
    "bold",
  );
  drawText(
    context,
    `Precipitation ${Math.round(weather.precipitationProbability)}%`,
    308,
    230,
    15,
    COLOR.secondary,
    "bold",
  );
  drawText(
    context,
    `Wind ${Math.round(weather.windSpeed)}km/h`,
    430,
    230,
    15,
    COLOR.primary,
    "bold",
  );
}
```

Call `drawWeather` only for the `weather` page. Do not draw battery, news,
TODO, route, ORS, or companion instructions on this page.

- [ ] **Step 4: Run dashboard renderer tests and verify GREEN**

Run:

```bash
npx vitest run src/fast-hud-pages.test.ts src/fast-canvas-hud.test.ts \
  --no-file-parallelism --maxWorkers=1
```

Expected: all focused page and dashboard tests pass.

- [ ] **Step 5: Commit the weather dashboard**

```bash
git add src/fast-canvas-hud.ts src/fast-canvas-hud.test.ts
git commit -m "feat: add focused G2 weather dashboard"
```

### Task 3: Add Weather Detail State and Input Isolation

**Files:**
- Modify: `src/fast-hud-view.ts`
- Modify: `src/fast-hud-view.test.ts`

- [ ] **Step 1: Write failing weather-detail input tests**

Extend the entry test:

```ts
expect(reduceFastHudInput(
  initial,
  "weather",
  "tap",
  CONTEXT,
).state.mode).toBe("weather");
```

Add a focused input test:

```ts
it("consumes weather detail gestures and returns on double tap", () => {
  const state = {
    ...createFastHudViewState(),
    mode: "weather",
  } as const;
  for (const input of ["tap", "scroll-next", "scroll-previous"] as const) {
    expect(reduceFastHudInput(state, "weather", input, CONTEXT)).toEqual({
      state,
      result: "consume",
    });
  }
  expect(reduceFastHudInput(
    state,
    "weather",
    "double-tap",
    CONTEXT,
  )).toMatchObject({
    state: { mode: "dashboard" },
    result: "redraw",
  });
});
```

- [ ] **Step 2: Run reducer tests and verify RED**

Run:

```bash
npx vitest run src/fast-hud-view.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because `weather` is not a view mode or page.

- [ ] **Step 3: Implement weather detail mode**

In `src/fast-hud-view.ts`:

- Import `FastHudPage` from `fast-hud-pages`.
- Add `"weather"` to `FastHudViewMode`.
- Change `pageMode` and `reduceFastHudInput` page parameters from `HudPage` to
  `FastHudPage`.
- Map the weather page to weather mode.
- After the existing map and news branches, add:

```ts
if (state.mode === "weather") {
  return { state, result: "consume" };
}
```

Keep the double-tap branch before this block so it returns to dashboard.

- [ ] **Step 4: Run reducer tests and verify GREEN**

Run:

```bash
npx vitest run src/fast-hud-view.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: all reducer tests pass, including unchanged map zoom and article
pagination direction tests.

- [ ] **Step 5: Commit detail-state support**

```bash
git add src/fast-hud-view.ts src/fast-hud-view.test.ts
git commit -m "feat: add isolated G2 weather detail state"
```

### Task 4: Render and Refresh the Full-Screen Weather Detail

**Files:**
- Modify: `src/fast-detail-hud.ts`
- Modify: `src/fast-detail-hud.test.ts`
- Modify: `src/fast-detail-refresh.ts`
- Modify: `src/fast-detail-refresh.test.ts`

- [ ] **Step 1: Write failing full-screen weather renderer tests**

Extend the test fixture with a fresh weather value. Render mode `weather` and
assert:

```ts
expect(values(texts)).toEqual(expect.arrayContaining([
  "WEATHER // LIVE",
  "28°C",
  "lucidity",
  “Perceived Temperature”,
  "30°",
  "humidity",
  "63%",
  “Precipitation probability”,
  "20%",
  "wind",
  "8km/h",
  "DOUBLE TAP // BACK",
]));
expect(values(texts)).not.toContain("Requires path key");
```

Add table-driven checks for `stale`, `loading`, and `unavailable`; stale must
show `WEATHER // LAST`, while empty states must not mention keys or ORS.

- [ ] **Step 2: Write failing weather refresh-selection tests**

In `src/fast-detail-refresh.test.ts`, add:

```ts
it("refreshes weather detail only for displayed weather changes", () => {
  const before = baseState();
  const changed = withState(before, {
    weather: {
      ...before.weather,
      fetchedAt: 2,
      value: { ...before.weather.value!, humidity: 63 },
    },
  });
  const newsChanged = withState(before, {
    news: { ...before.news, fetchedAt: 2 },
  });
  expect(detailRefreshTarget("weather", before, changed, "right"))
    .toBe("all");
  expect(detailRefreshTarget("weather", before, newsChanged, "right"))
    .toBeUndefined();
});
```

- [ ] **Step 3: Run detail tests and verify RED**

Run:

```bash
npx vitest run src/fast-detail-hud.test.ts src/fast-detail-refresh.test.ts \
  --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because weather detail rendering and matching do not exist.

- [ ] **Step 4: Implement the weather detail renderer**

Extend `FastDetailHudOptions["mode"]` with `"weather"`. Add
`weatherLabel` and `drawWeather` functions:

```ts
function weatherLabel(
  state: LiveDashboardState["weather"],
): string {
  if (state.status === "fresh") return "WEATHER // LIVE";
  if (state.status === "stale") return "WEATHER // LAST";
  if (state.status === "loading") return "WEATHER // LOADING";
  return "WEATHER // UNAVAILABLE";
}
```

Use the full 576×288 rendering area. Place the current temperature at 44px or larger. Place the condition beside it. Arrange four metrics in a two-by-two grid. Use labels at 13–15px and values at 22–26px. For loading
and unavailable, call `drawEmptyState` with weather-only copy. Dispatch
`options.mode === "weather"` before the TODO and Navigation branches.

- [ ] **Step 5: Implement exact weather-state matching**

In `src/fast-detail-refresh.ts`, add `weatherStateMatches` that compares
status, `fetchedAt`, and every `WeatherValue` field:

```ts
function weatherStateMatches(
  left: LiveDashboardState,
  right: LiveDashboardState,
): boolean {
  const a = left.weather.value;
  const b = right.weather.value;
  return left.weather.status === right.weather.status
    && left.weather.fetchedAt === right.weather.fetchedAt
    && a?.temperature === b?.temperature
    && a?.apparentTemperature === b?.apparentTemperature
    && a?.humidity === b?.humidity
    && a?.windSpeed === b?.windSpeed
    && a?.precipitationProbability === b?.precipitationProbability
    && a?.weatherCode === b?.weatherCode
    && a?.condition === b?.condition;
}
```

Route `mode === "weather"` to this matcher and return `"all"` only when the
visible weather state changed.

- [ ] **Step 6: Run detail tests and verify GREEN**

Run:

```bash
npx vitest run src/fast-detail-hud.test.ts src/fast-detail-refresh.test.ts \
  --no-file-parallelism --maxWorkers=1
```

Expected: all focused renderer and refresh tests pass.

- [ ] **Step 7: Commit weather detail rendering**

```bash
git add src/fast-detail-hud.ts src/fast-detail-hud.test.ts \
  src/fast-detail-refresh.ts src/fast-detail-refresh.test.ts
git commit -m "feat: render live G2 weather detail"
```

### Task 5: Wire Dynamic Pages and Weather Detail Through App

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Write failing App integration tests**

Capture the Fast Canvas navigation callback. With disabled routing, call
`next` three times from Overview and assert the last dashboard render is
Weather; call once more and assert Overview. Tap Weather and assert
`drawFastDetailHud` receives `{ mode: "weather" }`.

Then emit a live state with `route.status = "fresh"`, return to dashboard, and
assert the sequence after Weather contains Navigation before wrapping.

Add a refresh assertion: while weather detail is open, a changed weather state
requests `"all"` and a news-only update requests nothing.

- [ ] **Step 2: Run App tests and verify RED**

Run:

```bash
npx vitest run src/App.test.tsx --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because App still uses the legacy `HudPage` type and fixed
adjacency signature and does not render weather detail.

- [ ] **Step 3: Implement dynamic App wiring**

In `src/App.tsx`:

- Import `FastHudPage`, `getAdjacentFastHudPage`, and
  `normalizeFastHudPage` from `fast-hud-pages`.
- Keep legacy `HudPage` for non-fast modes, but declare the shared variable as
  `let page: FastHudPage = "overview"`.
- At the start of `drawCurrentPage`, normalize Fast Canvas page state:

```ts
if (fastCanvasHudMode) {
  page = normalizeFastHudPage(page, live.route.status);
  if (view.mode === "navigation" && live.route.status === "disabled") {
    view = { ...view, mode: "weather" };
  }
}
```

- Include `mode === "weather"` in the full-screen detail renderer branch.
- Pass `live.route.status` to `getAdjacentFastHudPage`.
- For legacy Canvas and Hybrid calls, narrow `page` to `HudPage`; those paths
  never assign the Fast Canvas-only weather page.
- Keep existing news refill-on-exit, map zoom, TODO effect, busy-drop, and
  minute-refresh logic unchanged.

- [ ] **Step 4: Run App and direction regression tests**

Run:

```bash
npx vitest run src/App.test.tsx src/glasses.test.ts \
  src/fast-hud-view.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: all App, transport-direction, and detail-state tests pass.

- [ ] **Step 5: Commit App integration**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: wire dynamic G2 weather navigation"
```

### Task 6: Verify Serially and Prepare the G2 Hardware Checkpoint

**Files:**
- Create: `docs/hardware/2026-07-28-g2-weather-dynamic-navigation.md`
- Modify: `docs/hardware/2026-07-28-g2-honest-map-news-pages-todo.md`

- [ ] **Step 1: Run all frontend tests serially**

```bash
npm test
```

Expected: all Vitest files and tests pass with zero failures.

- [ ] **Step 2: Run all server tests serially**

```bash
node --test --test-concurrency=1 tests/*.test.mjs
```

Expected: 28 tests pass with zero failures.

- [ ] **Step 3: Run typecheck and production build in sequence**

```bash
npm run typecheck
npm run build
```

Expected: TypeScript exits zero and Vite produces `dist/client`.

- [ ] **Step 4: Write the hardware checkpoint**

Create a checkpoint with build label `weather-pages-028`, the full Tailscale
URL, automatic test counts, and these physical checks:

```md
- Without the [ ] key, only four pages cycle: Overview → News → TODO → Weather.
- The [ ] key required or ORS information does not appear on the glasses.
- [ ] Weather Only weather information appears on the dashboard.
- [ ] Go to the full screen details using the Weather tab.
- [ ] The current temperature, conditions, feeling, humidity, precipitation, and wind can be read clearly.
- [ ] Weather detail scrolling does not change the page, but double tapping returns.
- [ ] In an ORS active environment, Navigation is added as the fifth.
- [ ] The map zoom direction and general page direction remain in the previously approved state.
```

Mark the previous pending checkpoint `SUPERSEDED`.

- [ ] **Step 5: Verify formatting and Tailscale response**

```bash
git diff --check
curl -fsS -o /dev/null -w '%{http_code}\n' \
  'http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11&build=weather-pages-028'
```

Expected: no diff errors and HTTP `200`.

- [ ] **Step 6: Commit the checkpoint without pushing**

```bash
git add docs/hardware/2026-07-28-g2-weather-dynamic-navigation.md \
  docs/hardware/2026-07-28-g2-honest-map-news-pages-todo.md
git commit -m "docs: prepare G2 weather page checkpoint"
```

Do not push and do not send a completion notification until the user confirms
the physical G2 checkpoint.
