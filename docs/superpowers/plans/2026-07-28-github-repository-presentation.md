# GitHub Repository Presentation Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the approved development warning, accurate HUD page list, repository description, and discovery topics for Sandevistan.

**Architecture:** Keep the release-status warning and hardware-accurate page list in the tracked README, and manage repository-page metadata through the authenticated GitHub CLI. Validate the local documentation before publishing, then read the remote repository metadata back to confirm the external mutation.

**Tech Stack:** GitHub-flavored Markdown, GitHub CLI, Git

---

### Task 1: Update top-level status and HUD page documentation

**Files:**
- Modify: `README.md:7`
- Modify: `README.md:58`

- [ ] **Step 1: Confirm the warning is not already present**

Run:

```bash
! rg -n "\\[!WARNING\\]|has not been officially published on Even Hub" README.md
```

Expected: exit status 0, proving the new warning is absent before the edit.

- [ ] **Step 2: Insert the approved GitHub alert**

Place this block immediately after the centered tagline and before the badge
row:

```markdown
> [!WARNING]
> **Development status:** Sandevistan is still under active development and has not been officially published on Even Hub. Builds from this repository are experimental and intended for local testing on supported G2 hardware.
```

- [ ] **Step 3: Document the implemented HUD page set**

Add `WEATHER` after `TODO`, describe it as:

```markdown
| `WEATHER` | Current conditions, apparent temperature, humidity, precipitation, and wind |
```

Change the navigation label and detail rows to:

```markdown
| `NAVIGATION` *(active route only)* | Route state, remaining distance, next maneuver, and destination |
- `WEATHER` opens current conditions, hourly context, and a large tactical weather icon.
```

- [ ] **Step 4: Validate content and placement**

Run:

```bash
node - <<'NODE'
const fs = require('node:fs');
const readme = fs.readFileSync('README.md', 'utf8');
const warning = readme.indexOf('> [!WARNING]');
const badges = readme.indexOf('<p align="center">', readme.indexOf('</p>') + 4);
if (warning < 0 || warning > badges) process.exit(1);
if ((readme.match(/\\[!WARNING\\]/g) || []).length !== 1) process.exit(1);
const pages = ['`OVERVIEW`', '`NEWS`', '`TODO`', '`WEATHER`'];
const positions = pages.map((page) => readme.indexOf(`| ${page} |`));
if (positions.some((position) => position < 0)) process.exit(1);
if (!positions.every((position, index) => index === 0 || positions[index - 1] < position)) process.exit(1);
if (!readme.includes('| `NAVIGATION` *(active route only)* |')) process.exit(1);
NODE
```

Expected: exit status 0. One alert appears before the badge row. The four keyless pages appear in implementation order. Navigation is marked as conditional.

### Task 2: Verify and publish the tracked documentation

**Files:**
- Verify: `README.md`
- Verify: `docs/superpowers/specs/2026-07-28-github-repository-presentation-design.md`
- Verify: `docs/superpowers/plans/2026-07-28-github-repository-presentation.md`

- [ ] **Step 1: Run repository validation serially**

Run:

```bash
npm run test:repo
git diff --check
```

Expected: five repository tests pass, the copy check passes, and Git reports no
whitespace errors.

- [ ] **Step 2: Review the complete local change**

Run:

```bash
git status --short
git diff -- README.md
```

Expected: the README diff contains only the approved warning and HUD page
documentation corrections, while the design and plan documents are already
committed.

- [ ] **Step 3: Commit and push `main`**

Run:

```bash
git add README.md docs/superpowers/plans/2026-07-28-github-repository-presentation.md
git commit -m "docs: clarify Sandevistan development status"
git push origin main
```

Expected: the README warning and planning records are accepted by
`origin/main`.

### Task 3: Update and verify GitHub repository metadata

**External target:**
- Repository: `hmmhmmhm/sandevistan`

- [ ] **Step 1: Confirm authenticated access**

Run:

```bash
gh repo view hmmhmmhm/sandevistan --json nameWithOwner,url
```

Expected: GitHub returns `hmmhmmhm/sandevistan`.

- [ ] **Step 2: Apply the approved description and topics**

Run:

```bash
gh repo edit hmmhmmhm/sandevistan \
  --description "An unofficial, hardware-tested tactical HUD for Even Realities G2, built with React, TypeScript, Canvas, and the Even Hub SDK." \
  --add-topic "even-realities,even-realities-g2,smart-glasses,heads-up-display,hud,wearable,augmented-reality,typescript,react,vite,canvas,even-hub-sdk"
```

Expected: the GitHub CLI exits successfully.

- [ ] **Step 3: Read back and validate the remote state**

Run:

```bash
gh repo view hmmhmmhm/sandevistan \
  --json description,repositoryTopics,url,defaultBranchRef
git status --short --branch
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

Expected: GitHub returns the exact approved description and twelve topics;
local `main` is clean and its commit matches `origin/main`.
