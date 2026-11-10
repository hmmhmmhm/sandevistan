# G2 Hybrid Native Text HUD Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **Legacy evidence:** Historical RELIC names, paths, storage keys, and
> transport identifiers in this record are preserved exactly as they appeared at
> the time. Current main-branch identifiers use Sandevistan.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an isolated `/hud-hybrid` experiment that sends a text-free four-tile Canvas background once and switches pages with one native Text update per scroll.

**Architecture:** A focused `hybrid-hud.ts` module owns the static background and native page strings. `transmitHybridCanvas` reuses the proven SDK `0.0.10` page and image transport for startup, then queues only `textContainerUpgrade` calls on scroll. The existing `/hud-canvas` transport remains unchanged.

**Tech Stack:** TypeScript, React 19, HTML Canvas 2D, Vitest, Vite, Even Hub SDK `0.0.10`

---

## File structure

- Create `src/hybrid-hud.test.ts`: text-free background and four page-string
  contracts.
- Create `src/hybrid-hud.ts`: static Canvas background and native Text formatter.
- Modify `src/glasses.test.ts`: initial images plus one native Text update,
  text-only scrolling, and serialized rapid scroll tests.
- Modify `src/glasses.ts`: hybrid page creator and native Text paging transport.
- Modify `src/App.test.tsx`: isolated `/hud-hybrid` route metadata.
- Modify `src/App.tsx`: select the hybrid renderer and transport only on the new
  route.
- Modify `README.md`: explain the A/B and hardware URL.
- Modify `docs/hardware/2026-07-26-first-g2-image-success.md`: record the
  experiment and physical acceptance checks.

### Task 1: Define and implement the text-free background

**Files:**
- Create: `src/hybrid-hud.test.ts`
- Create: `src/hybrid-hud.ts`

- [ ] **Step 1: Write the failing renderer contract**

Create a Canvas recorder with `fillRect`, path methods, `stroke`, and
`fillText`. Call:

```ts
drawHybridHudBackground(canvas);
```

Assert:

```ts
expect(canvas.width).toBe(576);
expect(canvas.height).toBe(288);
expect(texts).toEqual([]);
expect(rectangles).toEqual(expect.arrayContaining([
  { style: "#000000", args: [0, 0, 576, 288] },
  { style: "#555555", args: [0, 63, 576, 1] },
  { style: "#555555", args: [195, 64, 1, 224] },
]));
```

- [ ] **Step 2: Write the failing native page-string contract**

Use a fixed date and assert:

```ts
expect(formatHybridHudText("overview", fixedDate)).toContain("01 / 04");
expect(formatHybridHudText("overview", fixedDate)).toContain("Line 2 operates normally");
expect(formatHybridHudText("navigation", fixedDate)).toContain("Turn right →");
expect(formatHybridHudText("news", fixedDate)).toContain("NEWS // FOCUS");
expect(formatHybridHudText("todo", fixedDate)).toContain("[ ] Bring your umbrella");
expect(formatHybridHudText("todo", fixedDate)).toContain("Check [x] path");
```

Every page string must contain `14:37:42`, `HONGDAE 23°C clear`, and its page
number.

- [ ] **Step 3: Run the tests and verify RED**

Run:

```bash
npm test -- src/hybrid-hud.test.ts
```

Expected: FAIL because `hybrid-hud.ts` does not exist.

- [ ] **Step 4: Implement the background**

Create:

```ts
export function drawHybridHudBackground(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D Canvas cannot be used.");
  canvas.width = 576;
  canvas.height = 288;
  context.imageSmoothingEnabled = false;
  context.fillStyle = "#000000";
  context.fillRect(0, 0, 576, 288);
  // Draw only static frames, map roads, route, and dividers.
  // Never call fillText.
}
```

Use only `#000000`, `#ffffff`, `#aaaaaa`, and `#555555`.

- [ ] **Step 5: Implement one native content string per page**

Export:

```ts
export function formatHybridHudText(page: HudPage, now = new Date()) {
  const time = [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
  const pageNumber = HUD_PAGES.indexOf(page) + 1;
  const body = HYBRID_PAGE_LINES[page];
  return [
    `RELIC // LIVE ${time} HONGDAE 23°C Clear 0${pageNumber} / 04`,
    "",
    ...body,
  ].join("\n");
}
```

Define complete `HYBRID_PAGE_LINES` entries for overview, navigation, news, and
todo with the strings asserted in Step 2.

- [ ] **Step 6: Verify GREEN and commit**

Run:

```bash
npm test -- src/hybrid-hud.test.ts
npm test -- --run
```

Expected: 7 test files and all tests pass.

Commit:

```bash
git add src/hybrid-hud.test.ts src/hybrid-hud.ts
git commit -m "feat: add text-free hybrid HUD background"
```

### Task 2: Add single-call native Text paging

**Files:**
- Modify: `src/glasses.test.ts`
- Modify: `src/glasses.ts`

- [ ] **Step 1: Write the failing hybrid transport test**

Capture the event listener and record calls from a bridge with
`textContainerUpgrade`. Call:

```ts
await transmitHybridCanvas(
  source,
  "OVERVIEW 01 / 04",
  () => undefined,
  async (direction) => `${direction} PAGE`,
  dependencies,
);
```

After initial completion, emit bottom and top scroll events. Assert:

```ts
expect(imageIds).toEqual([2, 3, 4, 5]);
expect(textContents).toEqual([
  "OVERVIEW 01 / 04",
  "next PAGE",
  "previous PAGE",
]);
expect(createCount).toBe(1);
expect(rebuildCount).toBe(0);
```

Also inspect the startup page and assert ID 1 remains the full-screen,
event-capturing blank Text container.

- [ ] **Step 2: Write the failing rapid-scroll serialization test**

Block `textContainerUpgrade` calls after the initial content, emit two bottom
events immediately, then release both deferred calls. Assert:

```ts
expect(maximumActiveTextUpdates).toBe(1);
expect(textContents).toEqual(["INITIAL", "next:1", "next:2"]);
expect(imageIds).toEqual([2, 3, 4, 5]);
```

- [ ] **Step 3: Run the transport tests and verify RED**

Run:

```bash
npm test -- src/glasses.test.ts
```

Expected: FAIL because `transmitHybridCanvas` does not exist.

- [ ] **Step 4: Define hybrid dependencies and Text update**

Add:

```ts
type HybridDependencies = {
  waitForBridge: () => Promise<OfficialBridge>;
  encode: typeof encodeCanvasTiles;
};

async function updateHybridText(
  bridge: OfficialBridge,
  content: string,
) {
  const updated = await bridge.textContainerUpgrade(new TextContainerUpgrade({
    containerID: 1,
    containerName: "eventLayer",
    content,
  }));
  if (!updated) throw new Error("Failed to send native HUD text");
}
```

- [ ] **Step 5: Implement initial images and text-only scroll**

Export:

```ts
export async function transmitHybridCanvas(
  source: HTMLCanvasElement,
  initialContent: string,
  onProgress: (message: string) => void,
  onNavigate: (direction: PageDirection) => string | Promise<string>,
  dependencies: HybridDependencies = {
    waitForBridge: waitForEvenAppBridge,
    encode: encodeCanvasTiles,
  },
  tiles: readonly Tile[] = G2_TILES,
) {
  // Create/rebuild the same five-container page.
  // Encode and send image IDs 2–5 once.
  // Update eventLayer with initialContent after all images.
  // Queue scroll callbacks and one updateHybridText call per event.
  // Keep double-click shutdown.
}
```

The scroll queue must catch an error, report its message, and resolve so later
events can still run. It must never call `updateImageRawData` after startup.

- [ ] **Step 6: Verify GREEN and commit**

Run:

```bash
npm test -- src/glasses.test.ts
npm run typecheck
npm test -- --run
```

Expected: all transport, diagnostic, and full-suite tests pass.

Commit:

```bash
git add src/glasses.test.ts src/glasses.ts
git commit -m "feat: switch hybrid pages with native text"
```

### Task 3: Connect the isolated hardware route

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write the failing route test**

Navigate to `/hud-hybrid`, render with `autoStart={false}`, and assert:

```ts
expect(screen.getByText(/STATIC CANVAS \\+ NATIVE TEXT/)).toBeTruthy();
expect(hud.dataset.renderer).toBe("hybrid");
expect(hud.dataset.textContainers).toBe("1");
expect(hud.dataset.imageContainers).toBe("4");
expect(hud.dataset.pages).toBe("4");
```

Retain the existing `/hud-canvas` assertions to prove isolation.

- [ ] **Step 2: Run the App test and verify RED**

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: FAIL because `/hud-hybrid` is treated as the image-reference route.

- [ ] **Step 3: Wire the hybrid renderer and transport**

Add `hybridHudMode` and import the new renderer, formatter, and transport.
Initialize `page` to `overview`. On the hybrid route:

```ts
drawHybridHudBackground(canvas);
unsubscribe = await transmitHybridCanvas(
  canvas,
  formatHybridHudText(page),
  report,
  async (direction) => {
    page = getAdjacentHudPage(page, direction);
    return formatHybridHudText(page);
  },
);
```

Render `STATIC CANVAS + NATIVE TEXT · SCROLL · 4 PAGES`, set renderer metadata
to `hybrid`, and explain that the phone Canvas preview excludes native text.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```bash
npm test -- src/App.test.tsx
npm run typecheck
npm test -- --run
```

Expected: the new route and unchanged Canvas route both pass.

Commit:

```bash
git add src/App.test.tsx src/App.tsx
git commit -m "feat: add hybrid native text test route"
```

### Task 4: Document, verify, integrate, and open the test

**Files:**
- Modify: `README.md`
- Modify: `docs/hardware/2026-07-26-first-g2-image-success.md`

- [ ] **Step 1: Document the A/B**

Explain that `/hud-hybrid` sends the image background only at startup, updates
one native Text container per scroll, preserves `/hud-canvas`, and uses:

```text
http://100.96.68.73:4173/hud-hybrid?sdk=0.0.10&build=hybrid-text-005
```

- [ ] **Step 2: Record physical checks**

Add checks for Text-over-image order, transparent background, Korean and symbol
glyphs, single-step transition, speed difference, and binocular synchronization.

- [ ] **Step 3: Run fresh verification**

Run:

```bash
npm test -- --run
npm run typecheck
npm run build
npm run test:sites
npm ls @evenrealities/even_hub_sdk
git diff --check
```

Expected: all commands exit 0 and the SDK remains `0.0.10`.

- [ ] **Step 4: Commit documentation**

```bash
git add README.md docs/hardware/2026-07-26-first-g2-image-success.md \
  docs/superpowers/plans/2026-07-26-g2-hybrid-native-text.md
git commit -m "docs: add hybrid native text hardware test"
```

- [ ] **Step 5: Integrate and publish**

Fast-forward the feature branch into `main`, rerun the full verification from
`main`, push `main`, and confirm HTTP 200 for the exact Tailscale URL. Open its
Even Hub QR for the physical G2 test.
