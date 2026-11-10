# README Showcase Composite Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved five-image B-layout showcase, make it the README hero, and publish the change on `main`.

**Architecture:** Compose the supplied screenshots as immutable raster inputs on a fixed 1920×1200 canvas. Use native macOS image drawing for deterministic cover crops and pixel-preserving placement, then update only the README image reference and ignore the local browser-companion workspace.

**Tech Stack:** PNG, macOS AppKit/Core Graphics, Markdown, Git

---

### Task 1: Produce the approved B-layout PNG

**Files:**
- Create: `docs/design/sandevistan-g2-showcase.png`
- Read: `/tmp/sandevistan-readme-images/01.png`
- Read: `/tmp/sandevistan-readme-images/02.png`
- Read: `/tmp/sandevistan-readme-images/03.png`
- Read: `/tmp/sandevistan-readme-images/04.png`
- Read: `/tmp/sandevistan-readme-images/05.png`

- [ ] **Step 1: Confirm all five source images are available**

Run:

```bash
file /tmp/sandevistan-readme-images/{01,02,03,04,05}.png
```

Expected: five valid PNG records with the previously reviewed source dimensions.

- [ ] **Step 2: Render the exact 1920×1200 composition**

Run a native AppKit compositor that:

```text
fills #020302
places 01 at x=16,   y=16,  width=1352, height=672
places 02 at x=1378, y=16,  width=526,  height=672
places 03 at x=16,   y=698, width=623,  height=486
places 04 at x=649,  y=698, width=623,  height=486
places 05 at x=1282, y=698, width=622,  height=486
draws a one-pixel #315b31 border around each panel
uses aspect-fill cover cropping for every source
uses a 60% vertical focal point for source 02
```

Expected: `docs/design/sandevistan-g2-showcase.png` exists with no generated or rewritten screenshot content.

- [ ] **Step 3: Validate and inspect the output**

Run:

```bash
sips -g pixelWidth -g pixelHeight docs/design/sandevistan-g2-showcase.png
```

Expected: `pixelWidth: 1920` and `pixelHeight: 1200`. Inspect the PNG at original resolution and confirm the original B cover crop is present in the bottom-right panel.

### Task 2: Integrate the showcase into repository documentation

**Files:**
- Modify: `README.md:17`
- Modify: `.gitignore`

- [ ] **Step 1: Replace the README hero**

Change the current hero Markdown to:

```markdown
![Sandevistan running on Even Realities G2 with dashboard, map, weather, and news views](docs/design/sandevistan-g2-showcase.png)
```

- [ ] **Step 2: Ignore local visual-design previews**

Append this repository-local rule:

```gitignore
.superpowers/
```

- [ ] **Step 3: Confirm the relative image link resolves**

Run:

```bash
test -f docs/design/sandevistan-g2-showcase.png
```

Expected: exit status 0.

### Task 3: Verify and publish

**Files:**
- Verify: `README.md`
- Verify: `.gitignore`
- Verify: `docs/design/sandevistan-g2-showcase.png`

- [ ] **Step 1: Run repository validation serially**

Run:

```bash
npm run test:repo
git diff --check
```

Expected: repository checks pass and Git reports no whitespace errors.

- [ ] **Step 2: Review the exact staged scope**

Run:

```bash
git status --short
git diff --stat
git diff -- README.md .gitignore
```

Expected: only the approved asset, README reference, ignore rule, and this implementation plan are included.

- [ ] **Step 3: Commit and push `main`**

Run:

```bash
git add README.md .gitignore docs/design/sandevistan-g2-showcase.png docs/superpowers/plans/2026-07-28-readme-showcase-composite.md
git commit -m "docs: add G2 showcase composite"
git push origin main
```

Expected: the commit is accepted by `origin/main`.
