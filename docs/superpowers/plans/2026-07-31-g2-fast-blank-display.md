# G2 Fast Blank Display Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in `hide=blank` G2 display toggle that replaces the four-tile HUD page with one blank event-capture container, then rebuilds and fully restores the normal image page on the next double tap.

**Architecture:** Resolve the strategy once at the App boundary and pass it through the existing controller, session, and transport options. Keep blank-page construction in a focused module. Preserve the query-free black-tile path byte-for-byte. Whenever the candidate rebuilds image containers, clear the successful-image cache. Restoration must resend all four tiles. The experiment remains fail-fast with no queue, retry, or same-event fallback.

**Tech Stack:** TypeScript 5.9, React 19, Vitest 4 with jsdom, Even Hub SDK 0.0.13, Vite 6

---

### Task 1: Add the hide-strategy resolver and blank page factory

**Files:**
- Create: `src/g2-display-hide.ts`
- Create: `src/g2-display-hide.test.ts`

- [ ] **Step 1: Write the failing resolver and page-shape tests**

```ts
import { describe, expect, it } from "vitest";
import {
  createBlankDisplayPage,
  resolveG2DisplayHideStrategy,
} from "./g2-display-hide";

describe("G2 display hide strategy", () => {
  it.each([
    ["", "black-tiles"],
    ["?hide=blank", "blank-rebuild"],
    ["?hide=BLACK", "black-tiles"],
    ["?hide=invalid", "black-tiles"],
  ] as const)("resolves %s to %s", (search, expected) => {
    expect(resolveG2DisplayHideStrategy(search)).toBe(expected);
  });

  it("builds one full-screen blank event-capture container", () => {
    const page = createBlankDisplayPage().toJson();
    expect(page.containerTotalNum).toBe(1);
    expect(page.listObject ?? []).toEqual([]);
    expect(page.imageObject ?? []).toEqual([]);
    expect(page.textObject).toEqual([expect.objectContaining({
      xPosition: 0,
      yPosition: 0,
      width: 576,
      height: 288,
      borderWidth: 0,
      paddingLength: 0,
      containerID: 1,
      containerName: "eventLayer",
      content: " ",
      isEventCapture: 1,
    })]);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the RED state**

Run: `npm test -- --run src/g2-display-hide.test.ts`

Expected: FAIL because `src/g2-display-hide.ts` does not exist.

- [ ] **Step 3: Implement the strict resolver and blank page factory**

```ts
import {
  RebuildPageContainer,
  TextContainerProperty,
} from "@evenrealities/even_hub_sdk";

export type G2DisplayHideStrategy = "black-tiles" | "blank-rebuild";

export function resolveG2DisplayHideStrategy(
  search: string,
): G2DisplayHideStrategy {
  return new URLSearchParams(search).get("hide") === "blank"
    ? "blank-rebuild"
    : "black-tiles";
}

export function createBlankDisplayPage(): RebuildPageContainer {
  return new RebuildPageContainer({
    containerTotalNum: 1,
    textObject: [new TextContainerProperty({
      xPosition: 0,
      yPosition: 0,
      width: 576,
      height: 288,
      borderWidth: 0,
      borderColor: 0,
      borderRadius: 0,
      paddingLength: 0,
      containerID: 1,
      containerName: "eventLayer",
      content: " ",
      isEventCapture: 1,
    })],
  });
}
```

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run: `npm test -- --run src/g2-display-hide.test.ts`

Expected: 1 file passes with no failures.

- [ ] **Step 5: Commit the focused unit**

```bash
git add src/g2-display-hide.ts src/g2-display-hide.test.ts
git commit -m "feat: add G2 blank display strategy"
```

### Task 2: Propagate the opt-in strategy to the fast transport

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/hud-controller-types.ts`
- Modify: `src/fast-hud-controller.ts`
- Modify: `src/fast-canvas-types.ts`
- Modify: `src/fast-canvas-session.ts`

- [ ] **Step 1: Write failing App propagation tests**

Extend `FastTestOptions` with `displayHideStrategy` and add:

```ts
it("enables blank rebuild only on the explicit candidate route", async () => {
  window.history.replaceState({}, "", "/hud-canvas-fast?hide=blank");
  mocks.transmitFast.mockResolvedValue(vi.fn());
  render(<App />);
  await vi.waitFor(() => expect(mocks.transmitFast).toHaveBeenCalledOnce());
  expect(fastOptions().displayHideStrategy).toBe("blank-rebuild");
});

it("keeps black tiles as the query-free display toggle", async () => {
  window.history.replaceState({}, "", "/hud-canvas-fast");
  mocks.transmitFast.mockResolvedValue(vi.fn());
  render(<App />);
  await vi.waitFor(() => expect(mocks.transmitFast).toHaveBeenCalledOnce());
  expect(fastOptions().displayHideStrategy).toBe("black-tiles");
});
```

- [ ] **Step 2: Run App tests and confirm the RED state**

Run: `npm test -- --run src/App.test.tsx`

Expected: FAIL because no strategy is passed to `transmitFastCanvas`.

- [ ] **Step 3: Add the typed option chain**

In `App.tsx`, resolve the value once:

```ts
const displayHideStrategy = resolveG2DisplayHideStrategy(
  window.location.search,
);
```

Add `displayHideStrategy: G2DisplayHideStrategy` to
`UseHudControllerOptions`, add optional
`displayHideStrategy?: G2DisplayHideStrategy` to `FastCanvasOptions`, and pass
the value through `useHudController`, `transmitFastCanvas`, and the final
`transmitCanvas` argument. Include `hide ${displayHideStrategy}` in the startup
transport diagnostic without changing defaults.

- [ ] **Step 4: Run focused propagation tests and type checking**

Run: `npm test -- --run src/App.test.tsx`

Expected: all App tests pass.

Run: `npm run typecheck`

Expected: TypeScript exits with code 0.

- [ ] **Step 5: Commit propagation separately**

```bash
git add src/App.test.tsx src/App.tsx src/hud-controller-types.ts \
  src/fast-hud-controller.ts src/fast-canvas-types.ts \
  src/fast-canvas-session.ts
git commit -m "feat: route G2 display hide strategy"
```

### Task 3: Implement fail-fast blank hide and full restore

**Files:**
- Create: `src/image-send-timeout.ts`
- Modify: `src/fast-canvas-transport.ts`
- Modify: `src/glasses.test.ts`
- Test: `src/transport-boundaries.test.ts`

- [ ] **Step 1: Extend the transport harness before production changes**

Track every rebuild payload in `createFastRefreshHarness`, allow a test-provided
`rebuild` result, and expose `rebuiltPages`. Add a candidate test that performs
hide and restore:

```ts
it("blank rebuild hides without images and restores all four tiles", async () => {
  const harness = await createFastRefreshHarness({
    displayHideStrategy: "blank-rebuild",
  });

  harness.emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
  await vi.waitFor(() => expect(harness.rebuiltPages).toHaveLength(1));
  expect(harness.encodedSources).toEqual(["hud"]);
  expect(harness.imageIds).toEqual([3, 5, 2, 4]);
  expect(harness.rebuiltPages[0].containerTotalNum).toBe(1);

  harness.emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
  await vi.waitFor(() => expect(harness.rebuiltPages).toHaveLength(2));
  await vi.waitFor(() => expect(harness.imageIds).toEqual([
    3, 5, 2, 4,
    3, 5, 2, 4,
  ]));
  expect(harness.encodedSources).toEqual(["hud", "hud"]);
  expect(harness.rebuiltPages[1].containerTotalNum).toBe(5);
});
```

Add independent tests for failed hide and restore operations. A false hide rebuild must not encode, retry, or switch to hidden input behavior. A failed restore remains hidden until a new double tap starts a fresh restore.

- [ ] **Step 2: Run transport tests and confirm the RED state**

Run: `npm test -- --run src/glasses.test.ts src/transport-boundaries.test.ts`

Expected: FAIL because blank rebuild behavior is not implemented.

- [ ] **Step 3: Restore the timeout helper boundary**

Move the existing `TILE_SEND_TIMEOUT_MS` and `waitForTileSend` implementation
without behavior changes from `fast-canvas-transport.ts` into
`src/image-send-timeout.ts`. Import the helper back into the transport file so
the new candidate logic does not exceed the repository's 450-line source-file
limit.

- [ ] **Step 4: Implement the candidate hide branch**

In `performDisplayToggle`, keep the existing black-tile branch unchanged and
add:

```ts
if (!hidden && displayHideStrategy === "blank-rebuild") {
  logDiagnostic("REFRESH", "hide start · strategy blank-rebuild");
  onProgress("<localized hiding status>");
  const rebuildStartedAt = diagnosticNow();
  const rebuilt = await bridge.rebuildPageContainer(createBlankDisplayPage());
  if (!rebuilt) throw new Error("<blank page rebuild failed>");
  logDiagnostic(
    "REFRESH",
    "blank rebuild success",
    diagnosticDuration(rebuildStartedAt),
  );
  lastSuccessfulTilePayload.clear();
  hidden = true;
  onProgress("<localized hidden status>");
  logDiagnostic("REFRESH", "hide complete");
  return;
}
```

Do not catch and convert failure to black tiles. Existing operation ownership
must log the failure once and release `busy` in `finally`.

- [ ] **Step 5: Implement candidate restore-page rebuilding**

Before `refreshImages` in the hidden restore branch:

```ts
if (displayHideStrategy === "blank-rebuild") {
  const rebuildStartedAt = diagnosticNow();
  const { eventLayer, imageObject } = createContainerObjects(tiles);
  const rebuilt = await bridge.rebuildPageContainer(new RebuildPageContainer({
    containerTotalNum: tiles.length + 1,
    textObject: [eventLayer],
    imageObject,
  }));
  if (!rebuilt) throw new Error("<display restore rebuild failed>");
  logDiagnostic(
    "REFRESH",
    "restore page rebuild success",
    diagnosticDuration(rebuildStartedAt),
  );
  lastSuccessfulTilePayload.clear();
}
await refreshImages(source, tiles, "<localized restore complete status>");
hidden = false;
```

Clearing the cache after every successful normal-page rebuild is mandatory.
Otherwise a retry after a partial restore could skip tiles whose containers
were recreated and are now empty.

- [ ] **Step 6: Run the transport and boundary tests**

Run: `npm test -- --run src/glasses.test.ts src/transport-boundaries.test.ts`

Expected: all focused tests pass and `fast-canvas-transport.ts` remains at or
below 450 lines.

- [ ] **Step 7: Commit the transport behavior**

```bash
git add src/image-send-timeout.ts src/fast-canvas-transport.ts \
  src/glasses.test.ts
git commit -m "feat: add fast blank G2 display toggle"
```

### Task 4: Document and expose the isolated hardware gate

**Files:**
- Modify: `README.md`
- Modify: `package.json`
- Create: `docs/hardware/2026-07-31-g2-fast-blank-display-experiment.md`

- [ ] **Step 1: Add the candidate QR command without changing `npm run qr`**

Add:

```json
"qr:hide-blank": "evenhub qr --url \"http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.13&hide=blank&build=hide-blank-sdk0013-047\""
```

The query-free `qr` script remains the production control.

- [ ] **Step 2: Write the hardware gate record**

Record the control and candidate URLs, exact ten-cycle serial procedure, and required diagnostics. Include the 25% hide-median threshold, restore integrity rules, and zero-failure rule. Mark the result table `Awaiting physical evidence`. State
that the candidate is not promoted by automated success alone.

- [ ] **Step 3: Add concise README instructions**

Document `npm run qr:hide-blank` as an isolated candidate and link the hardware
record. Keep the query-free black-tile behavior described as production.

- [ ] **Step 4: Run repository checks and commit**

Run: `npm run test:repo`

Expected: 5 repository-policy tests and the copy check pass.

```bash
git add README.md package.json \
  docs/hardware/2026-07-31-g2-fast-blank-display-experiment.md
git commit -m "docs: add fast blank display hardware gate"
```

### Task 5: Complete serial verification and start the hardware server

**Files:**
- Verify only

- [ ] **Step 1: Run all automated gates serially**

Run each command separately:

```bash
npm run typecheck
npm test -- --run
npm run build
npm run test:repo
npm run test:sites
git diff --check
```

Expected: every command exits with code 0; Vitest uses one worker with file
parallelism disabled.

- [ ] **Step 2: Verify both HTTP routes**

```bash
curl -I --max-time 5 \
  'http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.13&build=hide-black-control-047'
curl -I --max-time 5 \
  'http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.13&hide=blank&build=hide-blank-sdk0013-047'
```

Expected: both return HTTP 200 from the single existing Vite server. Do not
start a competing process if port 4177 is already owned by the project.

- [ ] **Step 3: Inspect final repository state**

Run:

```bash
git status --short
git log -6 --oneline --decorate
```

Expected: only intentional commits are present and the worktree is clean.

- [ ] **Step 4: Push the approved experiment checkpoints**

```bash
git push origin main
```

Expected: `origin/main` advances through the design, plan, implementation, and
hardware-gate commits. Report the control and candidate URLs for a serial
physical comparison. Do not claim physical success before the owner supplies
the trace.
