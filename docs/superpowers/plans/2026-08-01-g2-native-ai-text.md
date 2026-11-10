# Native Ask AI Text Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

Status: `IMPLEMENTED AND INTEGRATED`

Implementation commit: `bbe792e` (`feat: stream Ask AI with native text`)

**Goal:** Stream Ask AI detail text through one official Even Hub text
container instead of retransmitting four Canvas tiles.

**Architecture:** Add a small native-AI page formatter and a mode controller
inside the fast transport. The controller rebuilds between the existing image page and a one-container text page. While native mode is active, it suppresses image refreshes. The controller exposes a direct latest-snapshot update request to the HUD controller. Keep transcript/history state renderer-independent.

**Tech stack:** TypeScript, Vitest, React, Even Hub SDK 0.0.13.

---

### Task 1: Specify native content and page geometry

- Add failing tests for a full-screen event-capture text page and bounded
  transcript content.
- Implement the pure formatter and page factory.
- Run the focused formatter tests.

### Task 2: Add native mode to fast transport

- Add failing transport tests for native entry, text-only updates, suppressed
  image refresh, and Canvas restoration.
- Extend the bridge type with `textContainerUpgrade`.
- Implement strict busy-drop native updates with no event queue.
- Run transport and session tests.

### Task 3: Connect AI controller and faster sampling

- Add failing controller/scheduler tests for entering AI before microphone
  start, 100 ms progressive refresh, manual paging, pause, and final refresh.
- Wire the native text controller into `useHudController`.
- Keep dashboard and non-AI detail behavior unchanged.
- Run all AI and HUD controller tests.

### Task 4: Verify and deliver

- Run `npm test`, `npm run typecheck`, `npm run test:repo`,
  `npm run test:sites`, `npm run build`, `npm run pack`, and
  `git diff --check`.
- Merge the feature branch into `main`, push it, restart the existing 4179
  test server, and verify `/hud-canvas-fast` over the Tailscale URL.
