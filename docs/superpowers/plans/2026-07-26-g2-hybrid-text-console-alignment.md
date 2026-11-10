# G2 Hybrid Text Console Alignment Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **Legacy evidence:** Historical RELIC names, paths, storage keys, and
> transport identifiers in this record are preserved exactly as they appeared at
> the time. Current main-branch identifiers use Sandevistan.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Align `/hud-hybrid-z` to a fixed right-hand Text console. Keep one native Text update per scroll and a large static map on the left.

**Architecture:** Add an isolated layered-hybrid background renderer. Export its console geometry as the shared coordinate contract for rendering and page creation. Keep the legacy hybrid renderer and transport unchanged. Only the explicit z-order route selects the new background and right-side Text container.

**Tech Stack:** React 19, TypeScript, Vitest, Canvas 2D, Even Hub SDK `0.0.10`, Vite

---

### Task 1: Fix the native Text shape

**Files:**
- Modify: `src/hybrid-hud.test.ts`
- Modify: `src/hybrid-hud.ts`

- [x] **Step 1: Write the failing eight-line Text test**

Extend the module type with `HYBRID_TEXT_CONSOLE`, then replace the loose content
assertions with this exact structural contract:

```ts
for (const [index, content] of [
  overview,
  navigation,
  news,
  todo,
].entries()) {
  const lines = content.split("\n");
  expect(lines).toHaveLength(8);
  expect(lines[0]).toContain("14:37:42");
  expect(lines[0]).toContain("23°C sunny");
  expect(lines[0]).toContain(`0${index + 1} / 04`);
  expect(lines[1]).toBe("RELIC // LIVE   HONGDAE");
  expect(lines[2]).toBe("");
  expect(Math.max(...lines.map((line) => Array.from(line).length)))
    .toBeLessThanOrEqual(27);
}
expect(overview.split("\n").slice(3)).toEqual([
  "NEWS // OVERVIEW",
  “Line 2 operates normally”,
  "Hongik University Station is moderately crowded",
  "[ ] Go to subway station",
  "MIC -24 dBFS",
]);
```

- [x] **Step 2: Run the focused test and verify RED**

Run:

```bash
node node_modules/vitest/vitest.mjs run src/hybrid-hud.test.ts
```

Expected: FAIL because the current pages have nine lines and the shared header is
one long line.

- [x] **Step 3: Implement the minimal fixed-width Text content**

Change `HYBRID_PAGE_LINES` so every page contains exactly five content lines,
and change the shared prefix to two lines:

```ts
return [
  `${time} 23°C Clear ${pageNumber} / 04`,
  "RELIC // LIVE   HONGDAE",
  "",
  ...HYBRID_PAGE_LINES[page],
].join("\n");
```

Use these five-line page payloads:

```ts
overview: [
  "NEWS // OVERVIEW",
  “Line 2 operates normally”,
  "Hongik University Station is moderately crowded",
  "[ ] Go to subway station",
  "MIC -24 dBFS",
],
navigation: [
  "NAVIGATION // ACTIVE",
  "NEXT 120m   DEST 0.8km",
  “Turn right →”,
  “At the next intersection”;
  "right",
],
news: [
  "NEWS // FOCUS",
  “Line 2 operates normally”,
  "Hongik University Station is moderately crowded",
  "23°C today, clear",
  “10% chance of precipitation”;
],
todo: [
  "TODO // FOCUS",
  "[ ] Go to subway station",
  "[ ] Bring an umbrella",
  "Check path [x]",
  "G2 + R1 CONNECTED",
],
```

- [x] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
node node_modules/vitest/vitest.mjs run src/hybrid-hud.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit the Text contract**

```bash
git add src/hybrid-hud.ts src/hybrid-hud.test.ts
git commit -m "fix: fit hybrid HUD text to one console"
```

### Task 2: Align Canvas and the layered Text container

**Files:**
- Modify: `src/hybrid-hud.test.ts`
- Modify: `src/hybrid-hud.ts`
- Modify: `src/glasses.test.ts`
- Modify: `src/glasses.ts`

- [x] **Step 1: Write failing Canvas and container geometry tests**

Add a `drawLayeredHybridHudBackground` test that records Canvas rectangles and
asserts:

```ts
expect(module.HYBRID_TEXT_CONSOLE).toEqual({
  x: 196,
  y: 8,
  width: 372,
  height: 272,
  padding: 8,
});
expect(rectangles).toEqual(expect.arrayContaining([
  { style: "#555555", args: [8, 8, 14, 1] },
  { style: "#555555", args: [196, 8, 14, 1] },
]));
expect(rectangles).not.toContainEqual({
  style: "#555555",
  args: [0, 63, 576, 1],
});
expect(texts).toEqual([]);
```

Extend the layered page test with:

```ts
expect(layered.textObject?.[0]).toMatchObject({
  xPosition: 196,
  yPosition: 8,
  width: 372,
  height: 272,
  paddingLength: 8,
  zOrderIndex: 5,
});
```

Add a separate invalid-startup test that captures `rebuildPageContainer` and
asserts its Text object has the same five geometry fields. This covers reloads
where an old page is still open and the SDK chooses the rebuild path.

- [x] **Step 2: Run both focused tests and verify RED**

Run:

```bash
node node_modules/vitest/vitest.mjs run src/hybrid-hud.test.ts src/glasses.test.ts
```

Expected: FAIL because the layered renderer and console constant do not exist,
and the layered Text is still full-screen.

- [x] **Step 3: Add the isolated renderer and shared geometry**

Export:

```ts
export const HYBRID_TEXT_CONSOLE = {
  x: 196,
  y: 8,
  width: 372,
  height: 272,
  padding: 8,
} as const;
```

Add `drawLayeredHybridHudBackground(canvas)` that:

- clears the `576×288` Canvas to black;
- draws corner frames at `(8, 8, 180, 272)` and `(196, 8, 372, 272)`;
- draws the existing road network and route inside the left frame;
- adds only short edge ticks to the right frame;
- never calls `fillText`.

Import the constant in `src/glasses.ts`. Extend `createContainerObjects` with a
fourth geometry parameter that defaults to the full screen:

```ts
type EventLayerGeometry = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

const FULLSCREEN_EVENT_LAYER: EventLayerGeometry = {
  x: 0,
  y: 0,
  width: 576,
  height: 288,
};

function createContainerObjects(
  tiles: readonly Tile[],
  eventPadding = 0,
  explicitZOrder = false,
  geometry: EventLayerGeometry = FULLSCREEN_EVENT_LAYER,
) {
```

Construct its Text object from `geometry`:

```ts
const eventLayer = new TextContainerProperty({
  xPosition: geometry.x,
  yPosition: geometry.y,
  width: geometry.width,
  height: geometry.height,
  borderWidth: 0,
  borderColor: 0,
  paddingLength: eventPadding,
  containerID: 1,
  containerName: "eventLayer",
  content: " ",
  isEventCapture: 1,
});
```

Add a private helper so startup and rebuild cannot diverge:

```ts
function createLayeredContainerObjects(tiles: readonly Tile[]) {
  return createContainerObjects(
    tiles,
    HYBRID_TEXT_CONSOLE.padding,
    true,
    HYBRID_TEXT_CONSOLE,
  );
}
```

Use this helper in both `createLayeredGlassesPage()` and the
`explicitZOrder` rebuild branch. The non-layered rebuild continues to call
`createContainerObjects(tiles, 8)`.

Leave `createGlassesPage()` and the old `drawHybridHudBackground()` unchanged.

- [x] **Step 4: Run both focused tests and verify GREEN**

Run:

```bash
node node_modules/vitest/vitest.mjs run src/hybrid-hud.test.ts src/glasses.test.ts
```

Expected: both files pass.

- [x] **Step 5: Commit the coordinate contract**

```bash
git add src/hybrid-hud.ts src/hybrid-hud.test.ts src/glasses.ts src/glasses.test.ts
git commit -m "fix: align layered HUD to native text console"
```

### Task 3: Select the aligned renderer only on `/hud-hybrid-z`

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/App.tsx`

- [x] **Step 1: Write the failing route contract**

Extend the explicit z-order route test:

```ts
expect(hud.dataset.layout).toBe("map-text-console");
```

Extend the legacy hybrid route test:

```ts
expect(hud.dataset.layout).toBeUndefined();
```

- [x] **Step 2: Run the focused test and verify RED**

Run:

```bash
node node_modules/vitest/vitest.mjs run src/App.test.tsx
```

Expected: FAIL because `data-layout` is not present.

- [x] **Step 3: Route the new Canvas renderer**

Import `drawLayeredHybridHudBackground`. In the hybrid initialization branch,
select it only when `layeredHybridHudMode` is true:

```ts
} else if (hybridHudMode) {
  if (layeredHybridHudMode) drawLayeredHybridHudBackground(canvas);
  else drawHybridHudBackground(canvas);
}
```

Add the semantic route marker:

```tsx
data-layout={layeredHybridHudMode ? "map-text-console" : undefined}
```

- [x] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
node node_modules/vitest/vitest.mjs run src/App.test.tsx
```

Expected: PASS.

- [x] **Step 5: Commit the isolated route**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: show aligned console on layered HUD route"
```

### Task 4: Document and verify the hardware candidate

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/hardware/2026-07-26-first-g2-image-success.md`

- [x] **Step 1: Record the new candidate**

Document build identifier `hybrid-console-007`, the left-map/right-console
layout, the preserved single-update contract, and the remaining G2 alignment
check. Do not mark hardware-only items complete before the user confirms them.

- [x] **Step 2: Run the complete verification**

Run:

```bash
npm test
npm run typecheck
npm run build
npm run test:sites
test "$(node -p "require('./node_modules/@evenrealities/even_hub_sdk/package.json').version")" = "0.0.10"
git diff --check
```

Expected: all commands exit `0`. Vitest reports no failures. Vite and the Sites preparation script create the required `dist` files. The SDK version is `0.0.10`. The diff has no whitespace errors.

- [x] **Step 3: Start the isolated Tailscale preview**

Keep the existing feature server on port `4174`, verify it serves the current
commit, and open:

```text
http://100.96.68.73:4174/hud-hybrid-z?sdk=0.0.10&build=hybrid-console-007
```

- [x] **Step 4: Commit the candidate documentation**

```bash
git add README.md AGENTS.md docs/hardware/2026-07-26-first-g2-image-success.md
git commit -m "docs: prepare aligned hybrid HUD hardware test"
```

- [x] **Step 5: Stop before integration**

Report the Tailscale URL and ask for the actual G2 result. Do not merge or push
until the user confirms Text alignment and the preserved scroll speed.
