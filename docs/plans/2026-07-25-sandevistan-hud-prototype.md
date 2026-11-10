# Sandevistan HUD Prototype Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **Legacy evidence:** Historical RELIC names, paths, storage keys, and
> transport identifiers in this record are preserved exactly as they appeared at
> the time. Current main-branch identifiers use Sandevistan.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the selected Peripheral Focus cyan into a static TypeScript HUD with a 576 x 288 G2 aspect ratio.

**Architecture:** React assembles the static HUD areas. One type-safe constant supplies the data. CSS defines the G2 black background, solid green, central viewing area, and collapsible 2:1 canvas. The prototype does not include the Even Hub SDK or a sensor connection.

**Tech Stack:** TypeScript, React 19, Vite 6, Vitest, Testing Library

---

### Task 1: Requirements testing

**Files:**
- Create: `src/App.test.tsx`
- Modify: `package.json`

- [ ] **Step 1: Install the testing tool and add the `npm test` script.**
- [ ] **Step 2: Write a test in which time, location, direction, dB, STT, acceleration, quest and news are rendered.**
- [ ] **Step 3: Run the test. Confirm that it fails on the currently empty app.**

### Task 2: Implementing a static HUD

**Files:**
- Create: `src/App.tsx`
- Create: `src/main.tsx`
- Modify: `src/styles.css`
- Delete: `src/App.jsx`
- Delete: `src/main.jsx`
- Create: `tsconfig.json`

- [ ] **Step 1: Create the mock-data type and `SandevistanHud` component.**
- [ ] **Step 2: Implement the actual 576 x 288 ratio and peripheral focus configuration with CSS.**
- [ ] **Step 3: Run the test. Confirm that it passes.**
- [ ] **Step 4: Check whether the user-created TS/TSX/CSS totals less than 450 lines.**

### Task 3: Documentation and implementation guide

**Files:**
- Create: `README.md`
- Create: `docs/research/2026-07-25-g2-display-ui-constraints.md`
- Copy: `docs/research/2026-07-25-even-hub-development-research.md`
- Copy: `docs/design/selected-peripheral-focus.png`

- [ ] **Step 1: Save the survey data and selected time standard.**
- [ ] **Step 2: Record Windows PowerShell execution commands and prototype scope in README.**

### Task 4: Visual QA

**Files:**
- Create: `design-qa.md`
- Create: `implementation-hud.png`
- Create: `comparison-hud.png`

- [ ] **Step 1: Run the local server and capture a 576 x 288 HUD area.**
- [ ] **Step 2: Review the selection image and implementation capture in the same comparison image.**
- [ ] **Step 3: Correct the differences between P0, P1, and P2 and capture again.**
- [ ] **Step 4: If the final QA passes, record the result as `passed`.**

### Task 5: Verification and public repository

**Files:**
- Verify: all project files

- [ ] **Step 1: Run `npm test`, `npm run build`, and `npm run test:sites`.**
- [ ] **Step 2: Initialize Git repository and review changed files.**
- [ ] **Step 3: Create a public repository `hmmhmmhm/even-relic`.**
- [ ] **Step 4: Commit the verified changes and push them to `main`.**
