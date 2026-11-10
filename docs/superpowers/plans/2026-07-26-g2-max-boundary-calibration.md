# G2 Maximum Boundary Calibration Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/calibration-max` mode that draws and transmits an exact `576×288` boundary grid through the proven SDK `0.0.10` four-tile path.

**Architecture:** A focused `src/calibration.ts` module owns deterministic Canvas drawing and has no bridge dependency. `App.tsx` selects the renderer from the URL, then reuses the existing `transmitCanvas()` transport without changing the root HUD, diagnostics, or SDK contract.

**Tech Stack:** React 19, TypeScript, HTML Canvas 2D, Vitest, Testing Library, Vite, Even Hub SDK `0.0.10`

---

## File structure

- Create `src/calibration.ts`: draw the deterministic maximum-boundary pattern.
- Create `src/calibration.test.ts`: verify exact Canvas dimensions, boundary rectangles, center lines, tick marks, and labels.
- Modify `src/App.tsx`: select calibration mode from `/calibration-max` and reuse the four-tile transport.
- Modify `src/App.test.tsx`: verify route metadata without starting the hardware bridge.

### Task 1: Deterministic maximum-boundary renderer

**Files:**
- Create: `src/calibration.ts`
- Create: `src/calibration.test.ts`

- [ ] **Step 1: Write the failing renderer test**

Create `src/calibration.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { drawCalibrationPattern } from "./calibration";

type Rectangle = {
  style: string;
  args: [number, number, number, number];
};

describe("G2 maximum-boundary calibration", () => {
  it("draws exact outer, inset, and center boundaries on a 576 by 288 canvas", () => {
    const rectangles: Rectangle[] = [];
    const labels: string[] = [];
    let fillStyle = "";

    const context = {
      get fillStyle() {
        return fillStyle;
      },
      set fillStyle(value: string | CanvasGradient | CanvasPattern) {
        fillStyle = String(value);
      },
      font: "",
      textAlign: "start",
      textBaseline: "alphabetic",
      fillRect: (x: number, y: number, width: number, height: number) => {
        rectangles.push({ style: fillStyle, args: [x, y, width, height] });
      },
      fillText: (value: string) => labels.push(value),
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => context,
    } as unknown as HTMLCanvasElement;

    drawCalibrationPattern(canvas);

    expect(canvas.width).toBe(576);
    expect(canvas.height).toBe(288);
    expect(rectangles).toEqual(expect.arrayContaining([
      { style: "#000000", args: [0, 0, 576, 288] },
      { style: "#ffffff", args: [0, 0, 576, 4] },
      { style: "#ffffff", args: [0, 284, 576, 4] },
      { style: "#ffffff", args: [0, 0, 4, 288] },
      { style: "#ffffff", args: [572, 0, 4, 288] },
      { style: "#ffffff", args: [8, 8, 560, 2] },
      { style: "#ffffff", args: [8, 278, 560, 2] },
      { style: "#ffffff", args: [8, 8, 2, 272] },
      { style: "#ffffff", args: [566, 8, 2, 272] },
      { style: "#ffffff", args: [287, 0, 2, 288] },
      { style: "#ffffff", args: [0, 143, 576, 2] },
      { style: "#ffffff", args: [32, 4, 2, 12] },
      { style: "#ffffff", args: [4, 32, 12, 2] },
    ]));
    expect(labels).toEqual(["TL", "TR", "BL", "BR", "576×288 MAX"]);
  });
});
```

- [ ] **Step 2: Run the renderer test and verify RED**

Run:

```bash
npm test -- src/calibration.test.ts
```

Expected: FAIL because `./calibration` does not exist.

- [ ] **Step 3: Implement the minimum deterministic renderer**

Create `src/calibration.ts`:

```ts
const WIDTH = 576;
const HEIGHT = 288;

export function drawCalibrationPattern(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D Canvas cannot be used.");

  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  context.fillStyle = "#000000";
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.fillStyle = "#ffffff";

  const rectangles: Array<[number, number, number, number]> = [
    [0, 0, WIDTH, 4],
    [0, HEIGHT - 4, WIDTH, 4],
    [0, 0, 4, HEIGHT],
    [WIDTH - 4, 0, 4, HEIGHT],
    [8, 8, WIDTH - 16, 2],
    [8, HEIGHT - 10, WIDTH - 16, 2],
    [8, 8, 2, HEIGHT - 16],
    [WIDTH - 10, 8, 2, HEIGHT - 16],
    [287, 0, 2, HEIGHT],
    [0, 143, WIDTH, 2],
  ];

  for (let x = 32; x < WIDTH; x += 32) {
    rectangles.push([x, 4, 2, 12], [x, HEIGHT - 16, 2, 12]);
  }
  for (let y = 32; y < HEIGHT; y += 32) {
    rectangles.push([4, y, 12, 2], [WIDTH - 16, y, 12, 2]);
  }
  for (const rectangle of rectangles) context.fillRect(...rectangle);

  context.font = "bold 20px monospace";
  context.textBaseline = "top";
  context.textAlign = "left";
  context.fillText("TL", 24, 24);
  context.fillText("TR", 522, 24);
  context.fillText("BL", 24, 242);
  context.fillText("BR", 522, 242);
  context.fillText("576×288 MAX", 218, 112);
}
```

- [ ] **Step 4: Run the renderer test and verify GREEN**

Run:

```bash
npm test -- src/calibration.test.ts
```

Expected: `src/calibration.test.ts` passes with no warnings.

- [ ] **Step 5: Commit the focused renderer**

```bash
git add src/calibration.ts src/calibration.test.ts
git commit -m "feat: add G2 boundary calibration renderer"
```

### Task 2: Calibration route and existing transport integration

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write the failing route test**

Add this test to `src/App.test.tsx`:

```tsx
it("selects the four-tile maximum-boundary calibration route", () => {
  window.history.replaceState({}, "", "/calibration-max");
  render(<App autoStart={false} />);

  const hud = screen.getByTestId("hud-frame");
  expect(screen.getByText(/576×288 MAX BOUNDARY/)).toBeTruthy();
  expect(hud.dataset.textContainers).toBe("1");
  expect(hud.dataset.imageContainers).toBe("4");
});
```

- [ ] **Step 2: Run the route test and verify RED**

Run:

```bash
npm test -- src/App.test.tsx -t "selects the four-tile maximum-boundary calibration route"
```

Expected: FAIL because the calibration label is not rendered.

- [ ] **Step 3: Select the renderer and reuse `transmitCanvas()`**

Add the calibration import to `src/App.tsx`:

```ts
import { drawCalibrationPattern } from "./calibration";
```

Define calibration mode immediately before the existing diagnostic modes:

```ts
const calibrationMode = window.location.pathname === "/calibration-max";
```

Replace the beginning of the asynchronous effect body:

```ts
if (calibrationMode) {
  drawCalibrationPattern(canvasRef.current!);
} else {
  await drawHudReference(canvasRef.current!, hudReferenceUrl);
}
report("Even waiting for app bridge connection · Safari only shows preview");
unsubscribe = hardwareBmpMode
  ? await transmitHardwareBmp(report)
  : diagnosticMode
    ? await transmitOfficialSample(report)
    : await transmitCanvas(canvasRef.current!, report);
```

Add `calibrationMode` to the effect dependency list:

```ts
}, [autoStart, calibrationMode, diagnosticMode, hardwareBmpMode]);
```

Update the header mode selection:

```tsx
{hardwareBmpMode
  ? "1-BIT BMP · CLICK TO SEND"
  : diagnosticMode
    ? "OFFICIAL SAMPLE.PNG · RAW BYTES"
    : calibrationMode
      ? "576×288 MAX BOUNDARY"
      : "576×288 · 4 IMAGE TILES"}
```

Update the preview note selection:

```tsx
{hardwareBmpMode
  ? “If you display the ready message on the glasses and click the ring/touch bar, 200×100 1-bit BMP will be transmitted.”
  : diagnosticMode
    ? "In diagnostic mode, the original Even Realities official sample.png bytes are transmitted as is."
    : calibrationMode
      ? "Transfers the outline strip, secondary border, center cross and 32px grid to four tiles."
      : "This Canvas is divided into four PNGs and sequentially transferred to the glasses."}
```

- [ ] **Step 4: Run the route and renderer tests and verify GREEN**

Run:

```bash
npm test -- src/App.test.tsx src/calibration.test.ts
```

Expected: both test files pass, including the new route and exact geometry tests.

- [ ] **Step 5: Commit the route integration**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: add G2 boundary calibration route"
```

### Task 3: Full verification and hardware handoff

**Files:**
- Verify only; no source change.

- [ ] **Step 1: Run the full automated verification**

Run:

```bash
npm test
npm run typecheck
npm run build
npm run test:sites
git diff --check
```

Expected:

- all Vitest files and tests pass;
- TypeScript exits with code 0;
- Vite and Sites packaging finish successfully;
- all four Sites worker tests pass;
- `git diff --check` prints nothing.

- [ ] **Step 2: Verify the Tailscale endpoint**

Run:

```bash
curl --fail --silent --show-error --output /dev/null \
  --write-out 'HTTP %{http_code}\n' \
  'http://100.96.68.73:4173/calibration-max?sdk=0.0.10&build=max-boundary-001'
```

Expected: `HTTP 200`.

- [ ] **Step 3: Generate the Even Hub QR**

Run:

```bash
npx evenhub qr \
  --url 'http://100.96.68.73:4173/calibration-max?sdk=0.0.10&build=max-boundary-001' \
  --external
```

Expected: the CLI prints or opens a QR that the Even app developer scanner accepts.

- [ ] **Step 4: Compare the glasses boundary**

On the actual G2:

1. Wait until all four image updates complete.
2. Confirm the outer and inset borders are continuous.
3. Confirm the center cross has no seam.
4. Without moving the glasses, switch to Dashboard.
5. Report whether Dashboard content extends outside, matches, or stays inside the calibration border.

