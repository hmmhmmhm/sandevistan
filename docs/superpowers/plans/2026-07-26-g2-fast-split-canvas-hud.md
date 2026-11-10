# G2 Fast Split Canvas HUD Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **Legacy evidence:** Historical RELIC names, paths, storage keys, and
> transport identifiers in this record are preserved exactly as they appeared at
> the time. Current main-branch identifiers use Sandevistan.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add an isolated `/hud-canvas-fast` experiment with fully styled Canvas text and a two-tile scroll update while preserving `/hud-canvas`.

**Architecture:** Render a page-invariant map in the left `288px` and all dynamic page content in the right `288px`. Extend the proven Canvas transport with an optional navigation-tile set. Expose a fast wrapper that sends all four tiles initially. After navigation, the wrapper sends only right-side IDs `3` and `5`.

**Tech Stack:** React 19, TypeScript, Vitest, Canvas 2D, Even Hub SDK `0.0.10`, Vite

---

### Task 1: Send only the right two tiles after navigation

**Files:**
- Modify: `src/glasses.test.ts`
- Modify: `src/glasses.ts`

- [x] **Step 1: Write the failing fast transport test**

Add a test that captures the bridge listener and records the tile list passed to
the encoder:

```ts
it("starts fast Canvas with four tiles and scrolls with the right two", async () => {
  const module = await loadGlasses();
  if (!module) return;
  expect(module.G2_RIGHT_TILES.map(({ id }) => id)).toEqual([3, 5]);

  let listener: ((event: EvenHubEvent) => void) | undefined;
  const encodedTileIds: number[][] = [];
  const imageIds: number[] = [];
  const bridge = {
    createStartUpPageContainer: async () => 0,
    rebuildPageContainer: async () => true,
    updateImageRawData: async (update: { containerID?: number }) => {
      imageIds.push(update.containerID!);
      return "success";
    },
    onEvenHubEvent: (next: (event: EvenHubEvent) => void) => {
      listener = next;
      return () => undefined;
    },
    shutDownPageContainer: async () => true,
  };

  await module.transmitFastCanvas(
    {} as HTMLCanvasElement,
    () => undefined,
    async () => undefined,
    {
      waitForBridge: async () => bridge,
      encode: async (_source, _factory, tiles = module.G2_TILES) => {
        encodedTileIds.push(tiles.map(({ id }) => id));
        return tiles.map(({ id }) => new Uint8Array([id]));
      },
    },
  );
  listener!({
    sysEvent: { eventType: OsEventTypeList.SCROLL_BOTTOM_EVENT },
  } as EvenHubEvent);
  await vi.waitFor(() => expect(imageIds).toHaveLength(6));

  expect(encodedTileIds).toEqual([[2, 3, 4, 5], [3, 5]]);
  expect(imageIds).toEqual([2, 3, 4, 5, 3, 5]);
});
```

- [x] **Step 2: Run the focused transport test and verify RED**

Run:

```bash
node node_modules/vitest/vitest.mjs run src/glasses.test.ts
```

Expected: FAIL because `G2_RIGHT_TILES` and `transmitFastCanvas` do not exist.

- [x] **Step 3: Implement optional navigation tiles**

Export the proven right-side container references:

```ts
export const G2_RIGHT_TILES = [G2_TILES[1], G2_TILES[3]] as const;
```

Add `navigationTiles` after `onNavigate` in `transmitCanvas()`:

```ts
navigationTiles: readonly Tile[] = tiles,
```

Change the local refresh function to accept its target list:

```ts
const refreshImages = async (
  targetTiles: readonly Tile[],
  completionMessage: string,
) => {
  const encodedTiles = await dependencies.encode(
    source,
    undefined,
    targetTiles,
  );
  await sendTilesSequentially(encodedTiles, async (bytes, index) => {
    const tile = targetTiles[index];
    const result = ImageRawDataUpdateResult.normalize(
      await bridge.updateImageRawData(new ImageRawDataUpdate({
        containerID: tile.id,
        containerName: tile.name,
        imageData: bytes,
      })),
    );
    if (!ImageRawDataUpdateResult.isSuccess(result)) {
      throw new Error(`${tile.name} transmission failed: ${result}`);
    }
    onProgress(`Transmitting glasses image ${index + 1}/${targetTiles.length}`);
  });
  onProgress(completionMessage);
};
```

Call `refreshImages(tiles, "Glasses transfer complete")` initially and
`refreshImages(navigationTiles, "Page transfer complete")` in the navigation queue.

Add the isolated wrapper:

```ts
export function transmitFastCanvas(
  source: HTMLCanvasElement,
  onProgress: (message: string) => void,
  onNavigate: (direction: PageDirection) => void | Promise<void>,
  dependencies: TransportDependencies = {
    waitForBridge: waitForEvenAppBridge,
    encode: encodeCanvasTiles,
  },
) {
  return transmitCanvas(
    source,
    onProgress,
    dependencies,
    G2_TILES,
    onNavigate,
    G2_RIGHT_TILES,
  );
}
```

- [x] **Step 4: Run the focused transport test and verify GREEN**

Run:

```bash
node node_modules/vitest/vitest.mjs run src/glasses.test.ts
```

Expected: PASS, including the existing full four-tile navigation tests.

- [x] **Step 5: Commit the transport contract**

```bash
git add src/glasses.ts src/glasses.test.ts
git commit -m "feat: update only right Canvas tiles on scroll"
```

### Task 2: Render the high-contrast split HUD

**Files:**
- Create: `src/fast-canvas-hud.test.ts`
- Create: `src/fast-canvas-hud.ts`

- [x] **Step 1: Write the failing renderer contract**

Create a Canvas recorder equivalent to the existing dense HUD recorder, but
include `x` and `y` on text records. Load `drawFastCanvasHud()` dynamically and
render all four pages at `2026-07-26 14:37:42`.

Assert:

```ts
for (const [index, hud] of pages.entries()) {
  expect(hud.canvas.width).toBe(576);
  expect(hud.canvas.height).toBe(288);
  expect(hud.values).toEqual(expect.arrayContaining([
    "14:37:42",
    "HONGDAE 23°C clear",
    `0${index + 1} / 04`,
    "MAP // HONGDAE",
  ]));
  expect(hud.texts.some(({ font }) => /(?:2[0-8])px/.test(font))).toBe(true);
}
expect(new Set(pages[0].paintedStyles)).toEqual(new Set([
  "#000000",
  "#ffffff",
  "#d0d0d0",
  "#808080",
]));
expect(pages.map(leftSnapshot)).toEqual([
  leftSnapshot(pages[0]),
  leftSnapshot(pages[0]),
  leftSnapshot(pages[0]),
  leftSnapshot(pages[0]),
]);
expect(pages[1].values).toEqual(expect.arrayContaining([
  "NAV // ACTIVE",
  "120m",
  "right",
  "Next intersection",
]));
expect(pages[2].values).toContain("Line 2 operates normally");
expect(pages[3].values).toEqual(expect.arrayContaining([
  "TODO // ACTIVE",
  “Go to the subway station”,
  “Bring an umbrella”,
  "Check path",
]));
```

`leftSnapshot()` must include rectangles fully inside `x < 288`, text records
with `x < 288`, and paths whose every point is left of `288`.

- [x] **Step 2: Run the renderer test and verify RED**

Run:

```bash
node node_modules/vitest/vitest.mjs run src/fast-canvas-hud.test.ts
```

Expected: FAIL because `src/fast-canvas-hud.ts` and `drawFastCanvasHud()` do not
exist.

- [x] **Step 3: Implement the split renderer**

Create `src/fast-canvas-hud.ts` with:

```ts
import { HUD_PAGES, type HudPage } from "./canvas-hud";

const COLOR = {
  background: "#000000",
  primary: "#ffffff",
  secondary: "#d0d0d0",
  dim: "#808080",
} as const;
const WIDTH = 576;
const HEIGHT = 288;
```

Implement private `drawText`, `drawPath`, `drawFrame`, `drawCheckbox`, and
`fillPolygon` helpers using square corners and monospaced Canvas text.

Implement `drawStaticMap()` entirely within `x = 8–280`. It must draw:

```text
MAP // HONGDAE
RELIC // LOCAL
DEST 0.8km
N ↑
```

plus the road grid, white active route, arrow marker, and destination marker.
No argument to this function may depend on the current page or time.

Implement `drawDynamicHeader()` at `x = 296–568` with `14:37:42`,
`HONGDAE 23°C clear`, and the current `01 / 04` style page number.

Implement three right-side frames at `(296, 8, 272, 54)`,
`(296, 72, 272, 134)`, and `(296, 216, 272, 64)`. Draw these exact page
payloads:

```ts
overview: ["NEWS // OVERVIEW", "Line 2 operating normally", "Congestion is normal", "TODO 01"],
navigation: ["NAV // ACTIVE", "120m", "Turn right", "Next intersection"],
news: ["NEWS // FOCUS", "Line 2 operating normally", "Hongik University Station normal", "Precipitation 10%"],
todo: ["TODO // ACTIVE", "Go to the subway station", "Bring an umbrella", "Check the route"],
```

Use `24–28px` for the main page value and `16–20px` for important body text.
Export:

```ts
export function drawFastCanvasHud(
  canvas: HTMLCanvasElement,
  now = new Date(),
  page: HudPage = "overview",
) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D Canvas cannot be used.");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  context.imageSmoothingEnabled = false;
  context.fillStyle = COLOR.background;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  drawStaticMap(context);
  drawDynamicHeader(context, now, page);
  drawDynamicPage(context, page);
}
```

- [x] **Step 4: Run the renderer test and verify GREEN**

Run:

```bash
node node_modules/vitest/vitest.mjs run src/fast-canvas-hud.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit the renderer**

```bash
git add src/fast-canvas-hud.ts src/fast-canvas-hud.test.ts
git commit -m "feat: draw high-contrast split Canvas HUD"
```

### Task 3: Isolate the fast route

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/App.tsx`

- [x] **Step 1: Write the failing route test**

Add:

```ts
it("isolates the two-tile fast Canvas experiment", () => {
  window.history.replaceState({}, "", "/hud-canvas-fast");
  render(<App autoStart={false} />);

  const hud = screen.getByTestId("hud-frame");
  expect(hud.dataset.renderer).toBe("canvas-fast");
  expect(hud.dataset.layout).toBe("static-left-dynamic-right");
  expect(hud.dataset.updateTiles).toBe("2");
  expect(screen.getByText(/CANVAS HUD · FAST 2-TILE/)).toBeTruthy();
});
```

Keep the existing `/hud-canvas` assertions unchanged.

- [x] **Step 2: Run the route test and verify RED**

Run:

```bash
node node_modules/vitest/vitest.mjs run src/App.test.tsx
```

Expected: FAIL because `/hud-canvas-fast` has no route metadata.

- [x] **Step 3: Wire the renderer and transport**

Import `drawFastCanvasHud` and `transmitFastCanvas`. Add:

```ts
const legacyCanvasHudMode = window.location.pathname === "/hud-canvas";
const fastCanvasHudMode = window.location.pathname === "/hud-canvas-fast";
const canvasHudMode = legacyCanvasHudMode || fastCanvasHudMode;
```

Make `drawCurrentPage()` select `drawFastCanvasHud` only for the fast route.
Select `transmitFastCanvas` only for the fast route; legacy Canvas continues to
call `transmitCanvas`. Add route labels and:

```tsx
data-renderer={fastCanvasHudMode ? "canvas-fast" : /* existing chain */}
data-layout={fastCanvasHudMode
  ? "static-left-dynamic-right"
  : layeredHybridHudMode
    ? "map-text-console"
    : undefined}
data-update-tiles={fastCanvasHudMode ? "2" : undefined}
```

- [x] **Step 4: Run the route test and verify GREEN**

Run:

```bash
node node_modules/vitest/vitest.mjs run src/App.test.tsx
```

Expected: PASS.

- [x] **Step 5: Commit the route**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: add fast split Canvas HUD route"
```

### Task 4: Prepare the G2 A/B

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/hardware/2026-07-26-first-g2-image-success.md`

- [x] **Step 1: Document the candidate**

Record build `fast-canvas-008`, the preserved `/hud-canvas` baseline, initial
four-tile transfer, scroll IDs `3, 5`, high-contrast palette, and unchecked G2
latency and seam checks.

- [x] **Step 2: Run complete verification**

Run:

```bash
npm test
npm run typecheck
npm run build
npm run test:sites
test "$(node -p "require('./node_modules/@evenrealities/even_hub_sdk/package.json').version")" = "0.0.10"
git diff --check
```

Expected: all commands exit `0`, all Vitest and Sites tests pass, Vite creates
the three required Sites files, and the installed SDK remains `0.0.10`.

- [x] **Step 3: Verify the Tailscale candidate**

Keep the feature server on port `4174` and verify both URLs respond:

```text
http://100.96.68.73:4174/hud-canvas?sdk=0.0.10&build=paged-hud-004
http://100.96.68.73:4174/hud-canvas-fast?sdk=0.0.10&build=fast-canvas-008
```

- [x] **Step 4: Commit the hardware checkpoint**

```bash
git add README.md AGENTS.md docs/hardware/2026-07-26-first-g2-image-success.md docs/superpowers/plans/2026-07-26-g2-fast-split-canvas-hud.md
git commit -m "docs: prepare fast Canvas HUD hardware test"
```

- [x] **Step 5: Stop before integration**

Report both A/B links. Do not merge or push until the user confirms both conditions. The route must be fast enough. The two right tiles must not show a distracting top-to-bottom seam.
