# Sandevistan Rebrand and English Documentation Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task by task.

**Goal:** Rebrand the main branch from `even-relic` / `RELIC` to Sandevistan, make the npm project private, publish a polished English repository surface, and translate every tracked Markdown document without altering the `0.0.12-reproduce` branch.

**Architecture:** Keep the existing React, Vite, TypeScript, Even Hub SDK, Canvas HUD, and serverless API architecture intact. Apply the new identity at the package, app manifest, storage, G2 container, runtime copy, browser preview, test, and documentation layers. Add a dependency-free repository policy checker so the English-only documentation and non-publishable package constraints remain enforceable.

**Tech Stack:** TypeScript, React 19, Vite 6, Node.js test runner, Even Hub SDK 0.0.11, Canvas 2D, Git, GitHub CLI

---

## Constraints

- Work only on `main`. Do not check out, amend, merge into, or rewrite `0.0.12-reproduce`.
- Keep Korean product data and user-facing live content where it is part of the Korean HUD experience; translate every tracked Markdown file to English.
- Preserve historical evidence exactly where old identifiers are materially part of a log, command, URL, filename, or measured result.
- Do not publish to npm or Even Hub.
- Run every test command serially.
- Do not force-push, rewrite history, or delete branches.

### Task 1: Add the repository policy checker with tests

**Files:**

- Create: `tests/repository-copy.test.mjs`
- Create: `scripts/check-repository-copy.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1: Write the failing unit tests**

Add tests for:

- Hangul detection with file and line reporting.
- Legacy current-brand detection while allowing explicitly marked historical evidence.
- Package metadata validation for `name: "sandevistan"` and `private: true`.
- App manifest validation for `package: "com.hmmhmmhm.sandevistan"`.

**Step 2: Run the focused test to verify RED**

Run:

```bash
node --test --test-concurrency=1 tests/repository-copy.test.mjs
```

Expected: FAIL because `scripts/check-repository-copy.mjs` does not exist.

**Step 3: Implement the checker**

Implement dependency-free exported validation functions and a CLI that:

- Enumerates tracked Markdown with `git ls-files`.
- Reports Hangul with path and line number.
- Validates current package/app identifiers.
- Rejects a publishable npm package.
- Scans current source and configuration for active Sandevistan branding.
- Allows old identifiers only on lines explicitly marked as legacy evidence.
- Exits nonzero when any violation exists.

Add:

```json
"test:repo": "node --test --test-concurrency=1 tests/repository-copy.test.mjs && node scripts/check-repository-copy.mjs"
```

**Step 4: Run the focused unit test to verify GREEN**

Run:

```bash
node --test --test-concurrency=1 tests/repository-copy.test.mjs
```

Expected: PASS. The full checker may still fail until later tasks remove the repository violations.

**Step 5: Commit**

```bash
git add tests/repository-copy.test.mjs scripts/check-repository-copy.mjs package.json package-lock.json
git commit -m "test: guard Sandevistan repository identity"
```

### Task 2: Rebrand package, app, storage, and G2 transport identifiers

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `app.json`
- Modify: `src/App.tsx`
- Modify: `src/components/G2CanvasHud.tsx`
- Modify: `src/components/G2FastCanvasHud.tsx`
- Modify: `src/components/G2HybridHud.tsx`
- Modify: `src/components/G2TextConsole.tsx`
- Modify: `src/lib/g2-canvas.ts`
- Modify: `src/lib/g2-live-data.ts`
- Modify: `src/lib/g2-storage.ts`
- Modify: `src/lib/g2-transport.ts`
- Modify: affected files under `tests/`

**Step 1: Update tests first**

Change active expectations from:

- `even-relic` to `sandevistan`
- `com.hmmhmmhm.evenrelic` to `com.hmmhmmhm.sandevistan`
- `relic:*` to `sandevistan:*`
- `relicTL/TR/BL/BR` to `sandevistanTL/TR/BL/BR`
- `RELIC` to `SANDEVISTAN`

Retain old values only inside tests that intentionally verify legacy-evidence handling.

**Step 2: Run the affected tests to verify RED**

Run the relevant individual Node and Vitest files serially.

Expected: FAIL against the old production identifiers.

**Step 3: Update implementation identifiers**

Apply the canonical mappings throughout current source and configuration. Keep transport order, dimensions, timing, and no-queue behavior unchanged.

**Step 4: Run the affected tests to verify GREEN**

Run the same focused tests serially.

Expected: PASS.

**Step 5: Commit**

```bash
git add package.json package-lock.json app.json src tests
git commit -m "refactor: rename runtime identity to Sandevistan"
```

### Task 3: Rebrand browser, HUD, diagnostics, and accessibility copy

**Files:**

- Modify: `index.html`
- Modify: `src/App.css`
- Modify: `src/index.css`
- Modify: all current `src/` files found by `rg -n 'RELIC|Relic|even-relic|evenrelic|relic[A-Z:]' src index.html`
- Modify: affected snapshots and expectations under `tests/`

**Step 1: Add or update copy assertions**

Require the browser title, HUD masthead, status labels, accessible labels, and diagnostic text to use Sandevistan.

**Step 2: Run focused tests to verify RED**

Run each affected test file serially.

**Step 3: Replace active branding**

Use `SANDEVISTAN` for tactical display copy and `Sandevistan` for prose. Do not change unrelated Korean runtime content.

**Step 4: Run focused tests to verify GREEN**

Run each affected test file serially.

**Step 5: Commit**

```bash
git add index.html src tests
git commit -m "feat: present the Sandevistan HUD identity"
```

### Task 4: Create the public repository surface

**Files:**

- Rewrite: `README.md`
- Create: `LICENSE`
- Modify: `AGENTS.md`
- Modify: `design-qa.md`
- Modify: `docs/design/README.md`
- Rename: `docs/plans/2026-07-25-relic-hud-prototype.md` to `docs/plans/2026-07-25-sandevistan-hud-prototype.md`

**Step 1: Write the polished English README**

Include:

- Sandevistan title and concise tagline.
- Shields.io badges for TypeScript, React, Vite, Even Hub SDK 0.0.11, physical G2 validation, exact tests, and MIT.
- The existing project HUD screenshot from `docs/design/selected-peripheral-focus.png`.
- Table of contents.
- Overview, design principles, feature pages, interaction model, transport design, no-queue policy, data sources, ORS routing, local development, QR launch, build, test, packaging, project structure, compatibility, SDK 0.0.12 reproduction branch, privacy, attribution, limitations, contributing, license, and trademark disclaimer.
- No CI, deployment, npm publication, or official affiliation claims.

**Step 2: Add licensing**

Add the MIT License with copyright:

```text
Copyright (c) 2026 hmmhmmhm
```

Add an unofficial fan-project disclaimer that does not imply affiliation with CD PROJEKT RED, Cyberpunk 2077, Even Realities, or their trademark owners.

**Step 3: Translate and rename the root/design documents**

Preserve all technical facts, command examples, checklist state, and links while translating prose into natural technical English.

**Step 4: Verify the repository surface**

Run:

```bash
rg -n '[\uAC00-\uD7A3]' README.md AGENTS.md design-qa.md docs/design docs/plans/2026-07-25-sandevistan-hud-prototype.md
rg -n 'even-relic|com\\.hmmhmmhm\\.evenrelic' README.md AGENTS.md design-qa.md docs/design docs/plans/2026-07-25-sandevistan-hud-prototype.md
```

Expected: no unintended matches.

**Step 5: Commit**

```bash
git add README.md LICENSE AGENTS.md design-qa.md docs/design docs/plans
git commit -m "docs: introduce the Sandevistan project"
```

### Task 5: Translate durable hardware and research documentation

**Files:**

- Modify: every tracked file under `docs/hardware/`
- Modify: every tracked file under `docs/research/`

**Step 1: Translate the hardware records**

Translate prose, headings, tables, decisions, limitations, and validation instructions. Preserve exact measurements and exact historical evidence.

**Step 2: Translate the research records**

Translate every Korean passage without changing citations, source URLs, command syntax, or conclusions.

**Step 3: Verify this directory batch**

Run:

```bash
rg -n '[\uAC00-\uD7A3]' docs/hardware docs/research
```

Expected: no matches.

**Step 4: Commit**

```bash
git add docs/hardware docs/research
git commit -m "docs: translate hardware and research records"
```

### Task 6: Translate all design specifications

**Files:**

- Modify: every tracked file under `docs/superpowers/specs/`

**Step 1: Translate every specification**

Preserve each document’s structure, decisions, alternatives, state machines, failure behavior, exact commands, code, test evidence, and implementation status.

**Step 2: Rebrand narrative references**

Use Sandevistan for current and narrative project identity. Keep old identifiers only when they are exact historical evidence and mark their context as legacy.

**Step 3: Verify the specification batch**

Run:

```bash
rg -n '[\uAC00-\uD7A3]' docs/superpowers/specs
```

Expected: no matches.

**Step 4: Commit**

```bash
git add docs/superpowers/specs
git commit -m "docs: translate design specifications"
```

### Task 7: Translate all implementation plans

**Files:**

- Modify: every tracked file under `docs/superpowers/plans/`

**Step 1: Translate every historical plan**

Preserve task order, status, exact commands, code blocks, file paths, commits, measurements, and verification claims.

**Step 2: Rebrand narrative references**

Use Sandevistan for current and narrative project identity. Retain legacy literals only where changing them would falsify an exact historical record.

**Step 3: Verify the plan batch**

Run:

```bash
rg -n '[\uAC00-\uD7A3]' docs/superpowers/plans
```

Expected: no matches.

**Step 4: Commit**

```bash
git add docs/superpowers/plans
git commit -m "docs: translate implementation plans"
```

### Task 8: Run repository-wide validation

**Files:**

- Modify: any file exposed by verification
- Modify: `scripts/check-repository-copy.mjs` and `tests/repository-copy.test.mjs` only if a verified false positive or missing policy case is found

**Step 1: Run the repository policy test**

```bash
npm run test:repo
```

Expected: PASS with zero Hangul in tracked Markdown, correct Sandevistan identifiers, and a private npm package.

**Step 2: Run the full project test suite**

```bash
npm test
```

Expected: PASS.

**Step 3: Run static and production verification**

```bash
npm run typecheck
npm run build
npm run test:sites
```

Expected: PASS.

**Step 4: Run API tests serially**

```bash
node --test --test-concurrency=1 tests/api-router.test.mjs tests/map-api.test.mjs tests/news-api.test.mjs tests/route-api.test.mjs
```

Expected: PASS.

**Step 5: Run final consistency checks**

```bash
git diff --check
rg -n '[\uAC00-\uD7A3]' --glob '*.md'
git status --short
```

Expected: no whitespace errors, no Hangul in Markdown, and only intended changes before the final verification commit.

**Step 6: Commit any verification fixes**

```bash
git add .
git commit -m "chore: complete Sandevistan repository verification"
```

### Task 9: Push, rename the GitHub repository, and restart the local test server

**Files:**

- No source changes expected
- Update: local Git remote metadata

**Step 1: Prove the reproduction branch is unchanged**

Compare the remote `0.0.12-reproduce` commit to its recorded commit:

```bash
git ls-remote origin refs/heads/0.0.12-reproduce
```

Expected: `1c118cff8c60b21f9049c28580f67eb10913c528`.

**Step 2: Push main**

```bash
git push origin main
```

Expected: the verified main branch is published without modifying other branches.

**Step 3: Rename the GitHub repository**

Rename `hmmhmmhm/even-relic` to `hmmhmmhm/sandevistan` with GitHub CLI and change `origin` to:

```text
https://github.com/hmmhmmhm/sandevistan.git
```

**Step 4: Verify remote integrity**

Confirm:

- Repository name and default branch.
- `main`, `0.0.12-reproduce`, and feature branch refs.
- The old repository URL redirects.
- The reproduction branch commit remains unchanged.

**Step 5: Restart the local server from renamed main**

Stop only the known existing port 4176 server process. Start the production preview from the verified main checkout on port 4176, bound for local/Tailscale access.

**Step 6: Verify the test URL**

Confirm an HTTP 200 response from the local and Tailscale URLs and report both complete URLs.

**Step 7: Send completion notification**

Send the required Moshi webhook with a concise completion summary.
