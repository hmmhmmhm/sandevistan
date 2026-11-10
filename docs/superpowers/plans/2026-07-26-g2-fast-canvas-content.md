# G2 Fast Canvas Content Refresh Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorder the fast Canvas pages, replace ambiguous samples with useful overview/news/TODO content, and render the single device battery snapshot exposed by SDK `0.0.10`.

**Architecture:** Keep the proven `/hud-canvas` page order and four-tile transport unchanged. Define the fast-route page order in `fast-canvas-hud.ts`. Before the first image encoding, let `transmitFastCanvas()` fetch one `DeviceInfo`. Pass the normalized battery snapshot to `App`. The app redraws the Canvas before transmission. Battery failures degrade to `BATTERY --` and never block the HUD.

**Tech Stack:** React 19, TypeScript, Canvas 2D, `@evenrealities/even_hub_sdk` `0.0.10`, Vitest, Testing Library

---

### Task 1: Fast-only page order and content

**Files:**
- Modify: `src/fast-canvas-hud.test.ts`
- Modify: `src/fast-canvas-hud.ts`
- Modify: `src/App.tsx`

- [x] **Step 1: Write failing page-order and content tests**

Extend the fast HUD module type and renderer helper in
`src/fast-canvas-hud.test.ts`:

```ts
type FastCanvasBattery = {
  label: "G1" | "G2" | "R1";
  level?: number;
  charging?: boolean;
};

type FastHudModule = {
  FAST_HUD_PAGES?: readonly HudPage[];
  getAdjacentFastHudPage?: (
    page: HudPage,
    direction: "next" | "previous",
  ) => HudPage;
  drawFastCanvasHud?: (
    canvas: HTMLCanvasElement,
    now?: Date,
    page?: HudPage,
    battery?: FastCanvasBattery,
  ) => void;
};
```

Pass an optional battery through `renderFastHud()`, then assert:

```ts
expect(module.FAST_HUD_PAGES).toEqual([
  "overview",
  "news",
  "todo",
  "navigation",
]);
expect(module.getAdjacentFastHudPage?.("overview", "next")).toBe("news");
expect(module.getAdjacentFastHudPage?.("navigation", "next")).toBe("overview");
expect(module.getAdjacentFastHudPage?.("overview", "previous")).toBe("navigation");

const pages = module.FAST_HUD_PAGES!.map((page) =>
  renderFastHud(module, page)
);
for (const [index, hud] of pages.entries()) {
  expect(hud.values).toContain("14:37");
  expect(hud.values).not.toContain("14:37:42");
  expect(hud.values).toContain(`0${index + 1} / 04`);
}

const news = renderFastHud(module, "news");
expect(news.values.filter((value) => value.startsWith("· "))).toHaveLength(6);
expect(news.values).not.toContain("Line 2 operates normally");

const todo = renderFastHud(module, "todo");
expect(todo.values).toContain("Completed 1 / 3");
expect(todo.values).not.toContain("CONNECTED");
expect(todo.values).not.toContain("LINK // G2 + R1");
```

- [x] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx vitest run src/fast-canvas-hud.test.ts
```

Expected: FAIL because `FAST_HUD_PAGES`, the fast navigation helper, minute-only
time, six headlines, and TODO progress do not exist yet.

- [x] **Step 3: Implement the fast-only order and content**

Add to `src/fast-canvas-hud.ts` without changing `HUD_PAGES`:

```ts
export const FAST_HUD_PAGES = [
  "overview",
  "news",
  "todo",
  "navigation",
] as const satisfies readonly HudPage[];

export function getAdjacentFastHudPage(
  page: HudPage,
  direction: "next" | "previous",
) {
  const offset = direction === "next" ? 1 : -1;
  const index = FAST_HUD_PAGES.indexOf(page);
  return FAST_HUD_PAGES[
    (index + offset + FAST_HUD_PAGES.length) % FAST_HUD_PAGES.length
  ];
}
```

Change the clock formatter to `HH:MM`. Use `FAST_HUD_PAGES` for the page number.
Replace the overview with a battery, weather, and TODO summary.
Render six general-news headlines, four in the upper panel and two in the lower panel.
Replace the TODO connection footer with `Complete 1 / 3`.

In `src/App.tsx`, route fast navigation through `getAdjacentFastHudPage()` and
legacy Canvas/hybrid navigation through the existing `getAdjacentHudPage()`:

```ts
const navigateCanvas = async (direction: "next" | "previous") => {
  page = fastCanvasHudMode
    ? getAdjacentFastHudPage(page, direction)
    : getAdjacentHudPage(page, direction);
  drawCurrentPage();
};
```

- [x] **Step 4: Run focused and legacy tests and verify GREEN**

Run:

```bash
npx vitest run src/fast-canvas-hud.test.ts src/canvas-hud.test.ts src/App.test.tsx
```

Expected: PASS. The legacy Canvas test must retain
`overview → navigation → news → todo`.

- [x] **Step 5: Commit the page and content change**

```bash
git add src/fast-canvas-hud.test.ts src/fast-canvas-hud.ts src/App.tsx
git commit -m "feat: refresh fast Canvas page content"
```

### Task 2: SDK battery snapshot

**Files:**
- Modify: `src/glasses.test.ts`
- Modify: `src/glasses.ts`
- Modify: `src/fast-canvas-hud.test.ts`
- Modify: `src/fast-canvas-hud.ts`
- Modify: `src/App.tsx`

- [x] **Step 1: Write failing battery renderer tests**

Make `renderFastHud()` accept a battery and add:

```ts
it("renders one SDK battery snapshot with a safe fallback", async () => {
  const module = await loadFastHud();
  if (!module?.drawFastCanvasHud) return;

  expect(renderFastHud(module, "overview", {
    label: "G2",
    level: 82,
    charging: true,
  }).values).toEqual(expect.arrayContaining(["G2 82% +"]));

  expect(renderFastHud(module, "overview").values).toContain("BATTERY --");
});
```

- [x] **Step 2: Write failing transport-order and fallback tests**

Add a fast Canvas transport test in `src/glasses.test.ts` whose bridge records
`"device"` from `getDeviceInfo()`, whose encoder records `"encode"`, and whose
`onBattery` captures the normalized value:

```ts
expect(order.indexOf("device")).toBeLessThan(order.indexOf("encode"));
expect(batteries).toEqual([{
  label: "G2",
  level: 82,
  charging: true,
}]);
expect(imageIds).toEqual([2, 3, 4, 5]);
```

Add a second case where `getDeviceInfo()` rejects and assert that `onBattery`
receives `undefined` while image IDs `2, 3, 4, 5` are still transmitted.

- [x] **Step 3: Run the battery tests and verify RED**

Run:

```bash
npx vitest run src/fast-canvas-hud.test.ts src/glasses.test.ts
```

Expected: FAIL because the renderer has no battery argument and fast transport
has no device lookup or callback.

- [x] **Step 4: Implement battery normalization and pre-encode lookup**

Import `DeviceInfo` and `DeviceModel` in `src/glasses.ts`, extend the internal
bridge with optional `getDeviceInfo()`, and add:

```ts
export type FastCanvasBattery = {
  label: "G1" | "G2" | "R1";
  level?: number;
  charging?: boolean;
};

export function toFastCanvasBattery(
  device: DeviceInfo | null | undefined,
): FastCanvasBattery | undefined {
  if (!device) return undefined;
  const label = device.model === DeviceModel.Ring1
    ? "R1"
    : device.model === DeviceModel.G2
      ? "G2"
      : "G1";
  return {
    label,
    level: device.status.batteryLevel,
    charging: device.status.isCharging,
  };
}
```

Give `transmitFastCanvas()` a fourth options object:

```ts
type FastCanvasOptions = {
  dependencies?: TransportDependencies;
  onBattery?: (battery: FastCanvasBattery | undefined) => void;
};
```

Wrap `waitForBridge()` so it calls `getDeviceInfo()` and `onBattery()` before
`transmitCanvas()` reaches its initial `encode()`. Catch lookup errors, send
`undefined` to the callback, and return the bridge so image transmission
continues.

- [x] **Step 5: Wire the snapshot into the fast renderer**

In `src/fast-canvas-hud.ts`, import the `FastCanvasBattery` type, accept it as
the fourth argument of `drawFastCanvasHud()`, and format:

```ts
const batteryText = battery?.level === undefined
  ? "BATTERY --"
  : `${battery.label} ${battery.level}%${battery.charging ? " +" : ""}`;
```

In `src/App.tsx`, hold the latest snapshot inside the effect, pass it to
`drawFastCanvasHud()`, and give `transmitFastCanvas()` this option:

```ts
{
  onBattery: (nextBattery) => {
    battery = nextBattery;
    drawCurrentPage();
  },
}
```

- [x] **Step 6: Run the focused tests and verify GREEN**

Run:

```bash
npx vitest run src/fast-canvas-hud.test.ts src/glasses.test.ts src/App.test.tsx
```

Expected: PASS, including initial IDs `2, 3, 4, 5` and scroll IDs `3, 5`.

- [x] **Step 7: Commit the battery integration**

```bash
git add src/glasses.test.ts src/glasses.ts src/fast-canvas-hud.test.ts src/fast-canvas-hud.ts src/App.tsx
git commit -m "feat: show SDK battery on fast Canvas overview"
```

### Task 3: Documentation and full verification

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/hardware/2026-07-26-first-g2-image-success.md`

- [x] **Step 1: Document the content build**

Record the order `OVERVIEW → NEWS → TODO → NAVIGATION`, minute-only clock,
six static general-news samples, TODO progress footer, and single-device
battery limitation. State that battery failure falls back to `BATTERY --`.

Add a new hardware URL using build marker `fast-content-009`:

```text
http://100.96.68.73:4175/hud-canvas-fast?sdk=0.0.10&build=fast-content-009
```

- [x] **Step 2: Check documentation and source diffs**

Run:

```bash
git diff --check
rg -n "fast-content-009|OVERVIEW.*NEWS.*TODO.*NAVIGATION|BATTERY --" \
  README.md AGENTS.md docs/hardware/2026-07-26-first-g2-image-success.md
```

Expected: no whitespace errors and all durable decisions present.

- [x] **Step 3: Run complete verification**

Run:

```bash
npm test
npm run typecheck
npm run build
npm run test:sites
```

Expected: all Vitest files pass, TypeScript emits no errors, Vite produces
`dist/client`, and all four Sites worker tests pass.

- [x] **Step 4: Commit documentation**

```bash
git add README.md AGENTS.md docs/hardware/2026-07-26-first-g2-image-success.md
git commit -m "docs: prepare fast Canvas content hardware test"
```

### Task 4: Tailscale hardware handoff

**Files:**
- No source changes

- [x] **Step 1: Start the isolated feature server**

Run:

```bash
npm run dev -- --host 0.0.0.0 --port 4175
```

Expected: Vite listens on port `4175` without replacing the existing baseline
server.

- [x] **Step 2: Verify local and Tailscale responses**

Run:

```bash
curl --fail --max-time 5 \
  "http://127.0.0.1:4175/hud-canvas-fast?sdk=0.0.10&build=fast-content-009"
curl --fail --max-time 5 \
  "http://100.96.68.73:4175/hud-canvas-fast?sdk=0.0.10&build=fast-content-009"
```

Expected: both requests return the Vite app with HTTP 200.

- [x] **Step 3: Preserve the worktree for physical testing**

Keep the feature worktree and server alive until the user approves the content
on G2. Do not merge or push the implementation before the hardware checkpoint.
