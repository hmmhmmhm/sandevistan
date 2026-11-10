# G2 Tactical HUD Polish Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the proven full-size Canvas HUD. Replace the ACC block and repetitive dashboard boxes with a large readable mission card and layered tactical-game styling.

**Architecture:** Keep `drawDenseCanvasHud()` and the existing `/hud-canvas` transport route stable. Refactor only the deterministic Canvas renderer into reusable tactical-frame and layered-path primitives, then update its rendering-contract test and the hardware-test documentation.

**Tech Stack:** TypeScript, HTML Canvas 2D, Vitest, React 19, Vite, Even Hub SDK `0.0.10`

---

## File structure

- Modify `src/canvas-hud.test.ts`: record text fonts and assert the new content,
  typography, right-card bounds, and layered paths.
- Modify `src/canvas-hud.ts`: replace closed panels with corner frames, redraw the
  route/navigation, remove ACC, and render the combined mission card.
- Modify `README.md`: point the Canvas hardware test at build
  `tactical-hud-002`.
- Modify `docs/hardware/2026-07-26-first-g2-image-success.md`: record the new
  hardware candidate and its visual acceptance criteria.

### Task 1: Lock the tactical rendering contract

**Files:**
- Modify: `src/canvas-hud.test.ts`

- [ ] **Step 1: Capture font size in text records**

Change the text record and mock to retain the font used for every label:

```ts
type TextRecord = {
  style: string;
  font: string;
  value: string;
};

fillText: (value: string) => {
  texts.push({ style: fillStyle, font: context.font, value });
},
```

- [ ] **Step 2: Add the new information-architecture assertions**

Replace the ACC expectations with:

```ts
const values = texts.map(({ value }) => value);
expect(values).toEqual(expect.arrayContaining([
  "NAV // ROUTE 01",
  "NEWS // 02",
  "MISSION ACTIVE",
  “To the subway station”,
  "movement",
  "ROUTE UPDATED",
]));
expect(values).not.toEqual(expect.arrayContaining([
  "ACC",
  "X +0.12",
  "Y -0.03",
  "Z +0.98",
]));

const newsBody = texts.find(({ value }) => value === "To the subway station");
const missionAction = texts.find(({ value }) => value === "Move");
expect(newsBody?.font).toContain("17px");
expect(missionAction?.font).toContain("24px");
```

Assert the combined card corners and layered routes:

```ts
expect(rectangles).toEqual(expect.arrayContaining([
  { style: "#555555", args: [404, 142, 16, 1] },
  { style: "#555555", args: [552, 279, 16, 1] },
]));
expect(strokedPaths).toEqual(expect.arrayContaining([
  expect.objectContaining({ style: "#aaaaaa", width: 6 }),
  expect.objectContaining({ style: "#ffffff", width: 2 }),
  expect.objectContaining({ style: "#aaaaaa", width: 8 }),
  expect.objectContaining({ style: "#ffffff", width: 3 }),
]));
```

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```bash
npm test -- src/canvas-hud.test.ts
```

Expected: FAIL because the existing renderer still draws ACC, lacks the mission
labels, and has no tactical frame or layered navigation path.

- [ ] **Step 4: Commit the failing contract**

```bash
git add src/canvas-hud.test.ts
git commit -m "test: define tactical HUD rendering contract"
```

### Task 2: Implement open tactical frames and layered routes

**Files:**
- Modify: `src/canvas-hud.ts`

- [ ] **Step 1: Replace the closed-panel primitive**

Replace `drawPanel()` with a corner-frame primitive that uses the same four-color
palette:

```ts
function drawFrame(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  accent: "top-left" | "top-right" = "top-left",
) {
  const corner = 16;
  const right = x + width;
  const bottom = y + height;
  context.fillStyle = COLOR.dim;
  context.fillRect(x, y, corner, 1);
  context.fillRect(x, y, 1, corner);
  context.fillRect(right - corner, y, corner, 1);
  context.fillRect(right - 1, y, 1, corner);
  context.fillRect(x, bottom - 1, corner, 1);
  context.fillRect(x, bottom - corner, 1, corner);
  context.fillRect(right - corner, bottom - 1, corner, 1);
  context.fillRect(right - 1, bottom - corner, 1, corner);
  context.fillStyle = COLOR.primary;
  const accentX = accent === "top-left" ? x : right - 8;
  context.fillRect(accentX, y, 8, 2);
}
```

Use it for all existing regions while preserving their current outer bounds.

- [ ] **Step 2: Layer the map route**

Draw the existing route twice:

```ts
const activeRoute: readonly Point[] = [
  [42, 226], [60, 196], [102, 184], [102, 150], [154, 150], [154, 110],
];
drawPath(context, activeRoute, COLOR.secondary, 6);
drawPath(context, activeRoute, COLOR.primary, 2);
```

Retain the road grid, but replace the solid position shape with an angular marker
and add a second square around the destination.

- [ ] **Step 3: Replace the solid navigation arrow**

Draw a bent tactical route twice and an open arrowhead:

```ts
const turnRoute: readonly Point[] = [[248, 174], [248, 130], [316, 130]];
drawPath(context, turnRoute, COLOR.secondary, 8);
drawPath(context, turnRoute, COLOR.primary, 3);
drawPath(context, [[304, 116], [320, 130], [304, 144]], COLOR.primary, 3);
drawText(context, "NAV // ROUTE 01", 216, 80, 9, COLOR.secondary, "bold");
drawText(context, "120m", 216, 96, 16, COLOR.primary, "bold");
drawText(context, "turn right", 286, 166, 18, COLOR.primary, "bold");
```

Keep the lower navigation card at `204,214,188×66`, with a 13-pixel preface and
22-pixel action.

- [ ] **Step 4: Run the focused test**

Run:

```bash
npm test -- src/canvas-hud.test.ts
```

Expected: still FAIL only on mission-card assertions because ACC has not yet been
removed.

### Task 3: Merge ACC and news into the mission card

**Files:**
- Modify: `src/canvas-hud.ts`

- [ ] **Step 1: Keep the microphone and remove ACC**

Rename `drawSensors()` to `drawRightRail()` and retain only the microphone region
at `404,72,164×62`. Delete all calls that draw `ACC` and X/Y/Z values.

- [ ] **Step 2: Draw the combined card**

Use the freed space exactly:

```ts
drawFrame(context, 404, 142, 164, 138, "top-right");
drawText(context, "NEWS // 02", 416, 151, 11, COLOR.primary, "bold");
drawText(context, "MISSION ACTIVE", 416, 168, 9, COLOR.secondary, "bold");
drawText(context, "To the subway station", 416, 190, 17, COLOR.primary, "bold");
drawText(context, "move", 416, 214, 24, COLOR.primary, "bold");
drawText(context, "ROUTE UPDATED", 416, 257, 9, COLOR.secondary, "bold");
drawText(context, "02:14", 520, 257, 9, COLOR.primary, "bold");
```

Add a two-pixel status rail at `408,166` and five short progress ticks below it.

- [ ] **Step 3: Run RED-to-GREEN verification**

Run:

```bash
npm test -- src/canvas-hud.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run the full suite**

Run:

```bash
npm test -- --run
```

Expected: 6 test files and 25 tests pass.

- [ ] **Step 5: Commit the renderer**

```bash
git add src/canvas-hud.ts
git commit -m "feat: polish Canvas HUD with tactical mission layout"
```

### Task 4: Update the hardware candidate documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/hardware/2026-07-26-first-g2-image-success.md`

- [ ] **Step 1: Update the Canvas URL**

Document:

```text
http://100.96.68.73:4173/hud-canvas?sdk=0.0.10&build=tactical-hud-002
```

Describe the ACC removal, larger news typography, open frames, and layered route.

- [ ] **Step 2: Add a hardware checklist**

Record these unresolved checks in
`docs/hardware/2026-07-26-first-g2-image-success.md`:

```markdown
- [ ] The news text is clearly read larger than the existing 10-pixel text.
- [ ] The open corner frame divides the area without interruption in G2.
- [ ] The dual routes of the map and central directions are not lumped together.
- [ ] Key information is not lost at the four tile boundaries.
```

- [ ] **Step 3: Commit the documentation**

```bash
git add README.md docs/hardware/2026-07-26-first-g2-image-success.md \
  docs/superpowers/specs/2026-07-26-g2-tactical-hud-polish-design.md \
  docs/superpowers/plans/2026-07-26-g2-tactical-hud-polish.md
git commit -m "docs: define tactical HUD hardware candidate"
```

### Task 5: Verify, integrate, and open the G2 test

**Files:**
- No production-file changes expected.

- [ ] **Step 1: Run fresh verification**

Run:

```bash
npm test -- --run
npm run typecheck
npm run build
npm run test:sites
```

Expected: every command exits with status 0.

- [ ] **Step 2: Review the exact diff**

Run:

```bash
git diff main...HEAD --check
git diff --stat main...HEAD
git status --short
```

Expected: no whitespace errors and only the renderer, its test, and documentation
are changed.

- [ ] **Step 3: Integrate and push**

Fast-forward `feature/game-hud-polish` into `main`, rerun the focused Canvas test
from `main`, then push `main` to `origin`.

- [ ] **Step 4: Open the hardware URL**

Run:

```bash
npx evenhub qr \
  --url 'http://100.96.68.73:4173/hud-canvas?sdk=0.0.10&build=tactical-hud-002' \
  --external
```

Confirm that the Tailscale URL returns HTTP 200 and leave the existing Vite server
running for the user’s G2 test.
