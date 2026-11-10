# G2 Hybrid z-order Backport Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an isolated `/hud-hybrid-z` hardware route with SDK `0.0.10` image transport. Serialize explicit unique z-order values that place native Text above all four Canvas images.

**Architecture:** Extend the existing container factory with an opt-in explicit layering flag. Expose `createLayeredGlassesPage()` for the contract test. Reuse `transmitHybridCanvas()` internally through a `transmitLayeredHybridCanvas()` wrapper. Image sequencing, Text updates, event handling, and the legacy `/hud-hybrid` path keep one implementation.

**Tech Stack:** React 19, TypeScript, Vitest, Even Hub SDK `0.0.10`, Canvas, Vite

---

### Task 1: Serialize a unique Text-above-image layer contract

**Files:**
- Modify: `src/glasses.test.ts:27-38`
- Modify: `src/glasses.ts:122-164`

- [ ] **Step 1: Write the failing layered-page test**

Add this test after the existing blank event-layer page test:

```ts
it("serializes explicit unique z-order with Text above every image", async () => {
  const module = await loadGlasses();
  if (!module) return;
  const createLayeredGlassesPage = (
    module as unknown as {
      createLayeredGlassesPage?: () => {
        toJson: () => {
          textObject?: Array<{ zOrderIndex?: number }>;
          imageObject?: Array<{ zOrderIndex?: number }>;
        };
      };
    }
  ).createLayeredGlassesPage;
  expect(createLayeredGlassesPage).toBeTypeOf("function");
  if (!createLayeredGlassesPage) return;

  const legacy = module.createGlassesPage().toJson();
  const layered = createLayeredGlassesPage().toJson();
  expect([
    ...legacy.imageObject!.map(({ zOrderIndex }) => zOrderIndex),
    legacy.textObject![0].zOrderIndex,
  ]).toEqual([undefined, undefined, undefined, undefined, undefined]);
  expect(layered.imageObject?.map(({ zOrderIndex }) => zOrderIndex)).toEqual([
    1,
    2,
    3,
    4,
  ]);
  expect(layered.textObject?.[0].zOrderIndex).toBe(5);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node node_modules/vitest/vitest.mjs run src/glasses.test.ts
```

Expected: FAIL because `createLayeredGlassesPage` is `undefined`.

- [ ] **Step 3: Add the minimal opt-in layer assignment**

Change the container factory and add a separate page builder:

```ts
type ZOrderedContainer = {
  zOrderIndex?: number;
};

function createContainerObjects(
  tiles: readonly Tile[],
  eventPadding = 0,
  explicitZOrder = false,
) {
  const eventLayer = new TextContainerProperty({
    xPosition: 0,
    yPosition: 0,
    width: 576,
    height: 288,
    borderWidth: 0,
    borderColor: 0,
    paddingLength: eventPadding,
    containerID: 1,
    containerName: "eventLayer",
    content: " ",
    isEventCapture: 1,
  });
  const imageObject = tiles.map((tile) => new ImageContainerProperty({
    xPosition: tile.x,
    yPosition: tile.y,
    width: tile.width,
    height: tile.height,
    containerID: tile.id,
    containerName: tile.name,
  }));
  if (explicitZOrder) {
    imageObject.forEach((image, index) => {
      (image as ImageContainerProperty & ZOrderedContainer).zOrderIndex =
        index + 1;
    });
    (eventLayer as TextContainerProperty & ZOrderedContainer).zOrderIndex =
      imageObject.length + 1;
  }
  return { eventLayer, imageObject };
}

export function createLayeredGlassesPage(
  tiles: readonly Tile[] = G2_TILES,
) {
  const { eventLayer, imageObject } = createContainerObjects(tiles, 8, true);
  return new CreateStartUpPageContainer({
    containerTotalNum: tiles.length + 1,
    textObject: [eventLayer],
    imageObject,
  });
}
```

Keep `createGlassesPage()` calling `createContainerObjects(tiles, eventPadding)`
without the third argument.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
node node_modules/vitest/vitest.mjs run src/glasses.test.ts
```

Expected: `src/glasses.test.ts` passes, including the legacy undefined layers
and explicit `[1, 2, 3, 4, 5]` contract.

- [ ] **Step 5: Commit the layer contract**

```bash
git add src/glasses.ts src/glasses.test.ts
git commit -m "feat: serialize hybrid HUD z-order"
```

### Task 2: Reuse hybrid transport with explicit layered pages

**Files:**
- Modify: `src/glasses.test.ts:226-313`
- Modify: `src/glasses.ts:361-442`

- [ ] **Step 1: Write the failing layered transport test**

Add a test after the current hybrid transport test:

```ts
it("keeps layered hybrid images static while scrolling native Text", async () => {
  const module = await loadGlasses();
  if (!module) return;
  const transmitLayeredHybridCanvas = (
    module as unknown as {
      transmitLayeredHybridCanvas?: (
        ...args: unknown[]
      ) => Promise<() => void>;
    }
  ).transmitLayeredHybridCanvas;
  expect(transmitLayeredHybridCanvas).toBeTypeOf("function");
  if (!transmitLayeredHybridCanvas) return;

  let listener: ((event: EvenHubEvent) => void) | undefined;
  let startupPage: { toJson: () => {
    textObject?: Array<{ zOrderIndex?: number }>;
    imageObject?: Array<{ zOrderIndex?: number }>;
  } } | undefined;
  const imageIds: number[] = [];
  const textContents: string[] = [];
  const bridge = {
    createStartUpPageContainer: async (page: typeof startupPage) => {
      startupPage = page;
      return 0;
    },
    rebuildPageContainer: async () => true,
    updateImageRawData: async (update: { containerID?: number }) => {
      imageIds.push(update.containerID!);
      return "success";
    },
    textContainerUpgrade: async (update: { content?: string }) => {
      textContents.push(update.content!);
      return true;
    },
    onEvenHubEvent: (next: (event: EvenHubEvent) => void) => {
      listener = next;
      return () => undefined;
    },
    shutDownPageContainer: async () => true,
  };

  await transmitLayeredHybridCanvas(
    {} as HTMLCanvasElement,
    "OVERVIEW",
    () => undefined,
    async () => "NAVIGATION",
    {
      waitForBridge: async () => bridge,
      encode: async () => module.G2_TILES.map(({ id }) => new Uint8Array([id])),
    },
  );
  expect(startupPage!.toJson().imageObject?.map(
    ({ zOrderIndex }) => zOrderIndex,
  )).toEqual([1, 2, 3, 4]);
  expect(startupPage!.toJson().textObject?.[0].zOrderIndex).toBe(5);

  listener!({
    sysEvent: { eventType: OsEventTypeList.SCROLL_BOTTOM_EVENT },
  } as EvenHubEvent);
  await vi.waitFor(() => expect(textContents).toHaveLength(2));
  expect(imageIds).toEqual([2, 3, 4, 5]);
  expect(textContents).toEqual(["OVERVIEW", "NAVIGATION"]);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node node_modules/vitest/vitest.mjs run src/glasses.test.ts
```

Expected: FAIL because `transmitLayeredHybridCanvas` is `undefined`.

- [ ] **Step 3: Add one optional layer flag and a thin wrapper**

Add `explicitZOrder = false` as the final optional parameter of
`transmitHybridCanvas()`. Select the page and rebuild objects with that flag:

```ts
const startupPage = explicitZOrder
  ? createLayeredGlassesPage(tiles)
  : createGlassesPage(tiles, 8);
const created = StartUpPageCreateResult.normalize(
  await bridge.createStartUpPageContainer(startupPage),
);
```

For the invalid-page branch use:

```ts
const { eventLayer, imageObject } = createContainerObjects(
  tiles,
  8,
  explicitZOrder,
);
const rebuildFailure = explicitZOrder
  ? “Layer hybrid glasses page reconstruction failed”
  : "Hybrid Glasses Page Reconstruction Failed";
```

Throw `new Error(rebuildFailure)` when `rebuildPageContainer()` returns
`false`.

Then add the wrapper after `transmitHybridCanvas()`:

```ts
export function transmitLayeredHybridCanvas(
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
  return transmitHybridCanvas(
    source,
    initialContent,
    onProgress,
    onNavigate,
    dependencies,
    tiles,
    true,
  );
}
```

Do not change the image update, Text queue, or event handling code.

- [ ] **Step 4: Run transport tests and verify GREEN**

Run:

```bash
node node_modules/vitest/vitest.mjs run src/glasses.test.ts
```

Expected: all raster transport tests pass. The layered test sees
`[1, 2, 3, 4]`, Text layer `5`, four initial images, and one Text-only scroll.

- [ ] **Step 5: Run the SDK compatibility contract**

Run:

```bash
node node_modules/vitest/vitest.mjs run src/sdk-version.test.ts
```

Expected: SDK stays `0.0.10` and `ImageRawDataUpdate.toJson()` still omits
`compressMode`.

- [ ] **Step 6: Commit the layered transport**

```bash
git add src/glasses.ts src/glasses.test.ts
git commit -m "feat: transmit layered hybrid HUD"
```

### Task 3: Add the isolated `/hud-hybrid-z` route

**Files:**
- Modify: `src/App.test.tsx:72-83`
- Modify: `src/App.tsx:3-170`

- [ ] **Step 1: Write the failing route test**

Add this test after the legacy hybrid route test:

```tsx
it("isolates the explicit z-order hybrid experiment", () => {
  window.history.replaceState({}, "", "/hud-hybrid-z");
  render(<App autoStart={false} />);

  const hud = screen.getByTestId("hud-frame");
  expect(screen.getByText(
    /STATIC CANVAS \+ NATIVE TEXT \+ Z-ORDER/,
  )).toBeTruthy();
  expect(hud.dataset.renderer).toBe("hybrid-z");
  expect(hud.dataset.layering).toBe("explicit");
  expect(hud.dataset.textContainers).toBe("1");
  expect(hud.dataset.imageContainers).toBe("4");
  expect(hud.dataset.pages).toBe("4");
});
```

- [ ] **Step 2: Run the route test and verify RED**

Run:

```bash
node node_modules/vitest/vitest.mjs run src/App.test.tsx
```

Expected: FAIL because `/hud-hybrid-z` still renders the default image route.

- [ ] **Step 3: Route only the new path to layered transport**

Import `transmitLayeredHybridCanvas` and define:

```ts
const legacyHybridHudMode = window.location.pathname === "/hud-hybrid";
const layeredHybridHudMode = window.location.pathname === "/hud-hybrid-z";
const hybridHudMode = legacyHybridHudMode || layeredHybridHudMode;
```

Before calling the hybrid transport select:

```ts
const transmitHybrid = layeredHybridHudMode
  ? transmitLayeredHybridCanvas
  : transmitHybridCanvas;
```

Use `transmitHybrid(...)` in the existing hybrid branch. Keep background
drawing and page navigation shared.

Render route evidence with:

```tsx
{hardwareBmpMode
  ? "1-BIT BMP · CLICK TO SEND"
  : diagnosticMode
    ? "OFFICIAL SAMPLE.PNG · RAW BYTES"
    : calibrationMode
      ? "576×288 MAX BOUNDARY"
      : layeredHybridHudMode
        ? "STATIC CANVAS + NATIVE TEXT + Z-ORDER · SCROLL · 4 PAGES"
        : hybridHudMode
          ? "STATIC CANVAS + NATIVE TEXT · SCROLL · 4 PAGES"
          : canvasHudMode
            ? "576×288 · CANVAS HUD · SCROLL · 4 PAGES"
            : "576×288 · 4 IMAGE TILES"}
```

and:

```tsx
data-renderer={
  layeredHybridHudMode
    ? "hybrid-z"
    : hybridHudMode
      ? "hybrid"
      : canvasHudMode
        ? "canvas"
        : calibrationMode
          ? "calibration"
          : "image"
}
data-layering={layeredHybridHudMode ? "explicit" : undefined}
```

Add `layeredHybridHudMode` to the effect dependency list. Do not change
`/hud-hybrid` or `/hud-canvas` behavior.

- [ ] **Step 4: Run route tests and verify GREEN**

Run:

```bash
node node_modules/vitest/vitest.mjs run src/App.test.tsx
```

Expected: all App route tests pass and the new route reports `hybrid-z` with
explicit layering.

- [ ] **Step 5: Commit the route**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: add layered hybrid HUD route"
```

### Task 4: Preserve the hardware result and prepare the A/B URL

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `docs/hardware/2026-07-26-first-g2-image-success.md`

- [ ] **Step 1: Record the durable routing rule**

Extend the hybrid rule in `AGENTS.md` to state:

```markdown
- Preserve `/hud-hybrid` as the hardware-proven missing-z-order diagnosis.
  Test SDK `0.0.10` z-order backport only on `/hud-hybrid-z`: image layers
  1–4, full-screen Text layer 5, and no image resend during scroll.
```

- [ ] **Step 2: Document the observed failure and new experiment**

In `README.md`, record that `/hud-hybrid` Text appears only while the system
close panel is open and disappears immediately after cancellation. Add:

```text
http://100.96.68.73:4173/hud-hybrid-z?sdk=0.0.10&build=hybrid-zorder-006
```

Explain that the new route keeps SDK `0.0.10` image transport and injects
unique layer values with Text at 5.

- [ ] **Step 3: Add a hardware checklist**

In `docs/hardware/2026-07-26-first-g2-image-success.md`, append a
`hybrid-zorder-006` section with the observed `/hud-hybrid` result and these
exact contents:

````markdown
## Explicit layer candidate `hybrid-zorder-006`

In the `hybrid-text-005` actual device test, only the Canvas layout was visible as usual.
Native Text appears while the System Close panel is open, and closes the panel.
As soon as I canceled it, it disappeared again. It's not a text transmission failure, it's behind your image
It was determined to be a problem with the order of layers being composited.

SDK `0.0.10` maintains image transfer and sends images 1–4 to five container JSONs,
Added a separate route to inject Text 5's unique `zOrderIndex`.

```text
http://100.96.68.73:4173/hud-hybrid-z?sdk=0.0.10&build=hybrid-zorder-006
```

- [ ] Text is displayed on the Canvas without a close panel.
- [ ] Even if you cancel the close panel, the text remains visible.
- [ ] Scroll only updates the text once without retransmitting the image.
- [ ] Your image is sent without `SENDFAILED`.
- [ ] The same text and layout are visible on both sides.
````

- [ ] **Step 4: Check documentation and commit**

Run:

```bash
git diff --check
rg -n "hybrid-zorder-006|/hud-hybrid-z" AGENTS.md README.md docs/hardware/2026-07-26-first-g2-image-success.md
```

Expected: no whitespace errors and all three files contain the new experiment.

```bash
git add AGENTS.md README.md docs/hardware/2026-07-26-first-g2-image-success.md
git commit -m "docs: record hybrid HUD layer diagnosis"
```

### Task 5: Verify, integrate, and open the physical checkpoint

**Files:**
- Verify all changed files

- [ ] **Step 1: Run fresh complete verification**

Run sequentially:

```bash
npm test -- --run
npm run typecheck
npm run build
npm run test:sites
npm ls @evenrealities/even_hub_sdk
git diff --check
git status --short
```

Expected: 7 Vitest files pass with the new tests, TypeScript and build succeed,
4 Sites tests pass, SDK is `0.0.10`, and the worktree is clean.

- [ ] **Step 2: Review the branch diff**

Run:

```bash
git diff --stat main...HEAD
git diff --check main...HEAD
git log --oneline main..HEAD
```

Expected: only the approved layered page, transport, route, tests, and
documentation are present.

- [ ] **Step 3: Fast-forward main and verify the live route**

After applying `superpowers:finishing-a-development-branch`, fast-forward the
clean main worktree, run the complete verification again, and push `main`.
Verify:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' \
  'http://100.96.68.73:4173/hud-hybrid-z?sdk=0.0.10&build=hybrid-zorder-006'
```

Expected: HTTP `200`.

- [ ] **Step 4: Open the Even Hub QR**

```bash
npx evenhub qr \
  --url 'http://100.96.68.73:4173/hud-hybrid-z?sdk=0.0.10&build=hybrid-zorder-006' \
  --external
```

Expected: the CLI prints the exact URL and opens the QR for the physical G2
checkpoint.
