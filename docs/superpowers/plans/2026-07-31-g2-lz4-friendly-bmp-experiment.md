# G2 LZ4-Friendly BMP Experiment Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For Codex:** Follow the repository's TDD and verification gates. Execute
> each task serially because the hardware transport contract forbids concurrent
> test activity.

**Goal:** Add an opt-in 1-bit BMP content encoder for an isolated SDK `0.0.13`
speed comparison while preserving the query-free PNG baseline.

**Architecture:** A pure format module resolves `format=bmp1` and converts RGBA
pixels to a monochrome mask. The existing tile encoder selects PNG or the
proven BMP writer from one option. The resolved format flows from `App` through
the fast controller and session to the transport. Hide calls override both
palette and format so solid-black frames remain on the proven PNG path.

**Tech Stack:** TypeScript, React, Vitest, Canvas 2D, Even Hub SDK `0.0.13`

---

### Task 1: Define format behavior with failing tests

**Files:**
- Create: `src/g2-tile-format.test.ts`
- Create: `src/g2-tile-format.ts`
- Modify: `src/glasses.test.ts`

1. Test that only `format=bmp1` selects `bmp-1` and all other values select
   `png`.
2. Test deterministic RGBA-to-monochrome conversion at the threshold.
3. Test that a tile encoded in BMP mode has a valid 1-bit BMP header and exact
   288×144 geometry.
4. Run the focused tests and confirm the missing behavior fails before adding
   production code.

### Task 2: Implement the isolated encoder

**Files:**
- Modify: `src/g2-canvas.ts`
- Modify: `src/g2-tile-format.ts`
- Modify: `src/g2-tile-palette.ts`

1. Add the minimal resolver and monochrome conversion needed by the tests.
2. Extend tile encoding options with `png | bmp-1`.
3. Keep PNG as the default and bypass `toBlob` only in BMP mode.
4. Include the format in encode diagnostics.
5. Run focused tests until green.

### Task 3: Carry the format through the fast HUD

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/hud-controller-types.ts`
- Modify: `src/fast-hud-controller.ts`
- Modify: `src/fast-canvas-types.ts`
- Modify: `src/fast-canvas-session.ts`
- Modify: `src/fast-canvas-transport.ts`
- Modify: `src/glasses.test.ts`

1. Add failing tests for the App option and content-versus-hide encoder modes.
2. Pass the resolved mode without changing legacy routes.
3. Force hide frames to `original + png` and restore content to the selected
   mode.
4. Run App and transport tests until green.

### Task 4: Expose the physical test URL

**Files:**
- Modify: `package.json`

1. Add a `qr:bmp1` script using SDK `0.0.13`, pipeline four, and a unique build
   marker.
2. Preserve the current `qr` and rollback URLs.

### Task 5: Verify and serve

**Files:**
- Verify only

1. Run focused tests.
2. Run `npm test`, `npm run typecheck`, and `npm run build` serially.
3. Confirm the baseline and BMP URLs return the application shell.
4. Keep one local server on port 4177 and provide both Tailscale URLs for the
   physical comparison.
