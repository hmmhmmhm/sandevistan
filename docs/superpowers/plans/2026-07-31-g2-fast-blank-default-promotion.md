# G2 Fast Blank Default Promotion Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the validated blank-page rebuild the default G2 display toggle and retain black-tile hiding only behind `hide=black`.

**Architecture:** Change strategy resolution at the URL boundary and align the direct session and transport defaults with it. Preserve both runtime branches, converting existing black-specific tests to explicit control tests and making the lifecycle test exercise the new default.

**Tech Stack:** TypeScript, React, Vitest, Even Hub SDK 0.0.13, Markdown repository checks

---

### Task 1: Lock the promoted strategy contract

**Files:**
- Modify: `src/g2-display-hide.test.ts`
- Modify: `src/App.test.tsx`
- Modify: `src/glasses.test.ts`

- [ ] **Step 1: Write the failing resolver and App tests**

Change the resolver table to expect `blank-rebuild` for missing, blank, and
unknown values, and `black-tiles` only for `?hide=black`. Change the App tests
to expect query-free blank rebuild and explicit black override.

```ts
it.each([
  ["", "blank-rebuild"],
  ["?hide=blank", "blank-rebuild"],
  ["?hide=black", "black-tiles"],
  ["?hide=BLACK", "blank-rebuild"],
  ["?hide=invalid", "blank-rebuild"],
] as const)("resolves %s to %s", (search, expected) => {
  expect(resolveG2DisplayHideStrategy(search)).toBe(expected);
});
```

```ts
it("uses blank rebuild as the query-free display toggle", async () => {
  window.history.replaceState({}, "", "/hud-canvas-fast");
  mocks.transmitFast.mockResolvedValue(vi.fn());
  render(<App />);
  await vi.waitFor(() => expect(mocks.transmitFast).toHaveBeenCalledOnce());
  expect(fastOptions().displayHideStrategy).toBe("blank-rebuild");
});

it("keeps black tiles behind the explicit control route", async () => {
  window.history.replaceState({}, "", "/hud-canvas-fast?hide=black");
  mocks.transmitFast.mockResolvedValue(vi.fn());
  render(<App />);
  await vi.waitFor(() => expect(mocks.transmitFast).toHaveBeenCalledOnce());
  expect(fastOptions().displayHideStrategy).toBe("black-tiles");
});
```

- [ ] **Step 2: Make the runtime default test fail**

Remove the explicit blank strategy from the successful blank lifecycle test.
Add `displayHideStrategy: "black-tiles"` to the three tests that specifically
verify black image generation, palette bypass, and PNG override.

```ts
const harness = await createFastRefreshHarness();
```

```ts
const harness = await createFastRefreshHarness({
  displayHideStrategy: "black-tiles",
  tilePaletteMode: "hud-4",
});
```

- [ ] **Step 3: Run focused tests and confirm RED**

Run:

```bash
npx vitest run src/g2-display-hide.test.ts src/App.test.tsx src/glasses.test.ts --no-file-parallelism --maxWorkers=1
```

Expected: resolver, App query-free, explicit black, and default transport
assertions fail because production still defaults to black tiles.

### Task 2: Promote blank rebuild with the smallest source change

**Files:**
- Modify: `src/g2-display-hide.ts`
- Modify: `src/fast-canvas-session.ts`
- Modify: `src/fast-canvas-transport.ts`

- [ ] **Step 1: Change URL resolution**

Return `black-tiles` only when `new URLSearchParams(search).get("hide")` is the
exact string `"black"`. Otherwise return `blank-rebuild`.

```ts
export function resolveG2DisplayHideStrategy(
  search: string,
): G2DisplayHideStrategy {
  return new URLSearchParams(search).get("hide") === "black"
    ? "black-tiles"
    : "blank-rebuild";
}
```

- [ ] **Step 2: Align direct defaults**

Change the default `displayHideStrategy` argument in `transmitCanvas` and the
fallback in `transmitFastCanvas` from `black-tiles` to `blank-rebuild`.

```ts
displayHideStrategy: G2DisplayHideStrategy = "blank-rebuild",
```

```ts
options.displayHideStrategy ?? "blank-rebuild",
```

- [ ] **Step 3: Run focused tests and confirm GREEN**

Run the Task 1 Vitest command. Expected: all selected tests pass with zero
failures.

- [ ] **Step 4: Commit runtime promotion**

```bash
git add src/g2-display-hide.ts src/g2-display-hide.test.ts src/App.test.tsx \
  src/fast-canvas-session.ts src/fast-canvas-transport.ts src/glasses.test.ts
git commit -m "feat: promote fast blank display toggle"
```

### Task 3: Update production documentation and controls

**Files:**
- Modify: `README.md`
- Modify: `package.json`
- Modify: `docs/hardware/2026-07-31-g2-fast-blank-display-experiment.md`

- [ ] **Step 1: Update operator-facing copy**

Describe blank rebuild as the production default, document `?hide=black` as
the diagnostic rollback, and mark the hardware decision as promoted by owner
acceptance.

```md
The query-free fast HUD uses the blank-page rebuild display toggle. Add
`?hide=black` only to run the former four-black-tile diagnostic control.
```

- [ ] **Step 2: Replace the obsolete candidate QR helper**

Replace `qr:hide-blank` with `qr:hide-black`, pointing to the same fast HUD URL
with `hide=black` and a distinct build identifier.

```json
"qr:hide-black": "evenhub qr --url \"http://100.127.255.11:4177/hud-canvas-fast?sdk=0.0.13&hide=black&build=hide-black-control-048\""
```

- [ ] **Step 3: Run repository and package checks**

Run:

```bash
npm run test:repo
npm run typecheck
```

Expected: both commands exit 0.

### Task 4: Verify and publish

**Files:**
- Verify all files changed by Tasks 1–3

- [ ] **Step 1: Run full serial verification**

```bash
npm test
npm run build
git diff --check
```

Expected: all Vitest files pass, the production build exits 0, and the diff
check prints no errors.

- [ ] **Step 2: Commit documentation**

```bash
git add README.md package.json \
  docs/hardware/2026-07-31-g2-fast-blank-display-experiment.md \
  docs/superpowers/plans/2026-07-31-g2-fast-blank-default-promotion.md
git commit -m "docs: promote fast blank display default"
```

- [ ] **Step 3: Push and verify parity**

```bash
git push origin main
git status --short --branch
git rev-parse HEAD
git rev-parse origin/main
```

Expected: clean `main`, and local and remote commit IDs match.
