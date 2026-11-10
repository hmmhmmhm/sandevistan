# Phone Subheader Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the phone WebView's app-like top bars with compact section headers that sit clearly below the native Even app bar.

**Architecture:** Keep the existing `PhoneHome` and `PhoneHeader` component boundaries and change only their semantic labels and scoped phone CSS. Add DOM and CSS contract tests so the compact hierarchy cannot regress without affecting the persistent Canvas or G2 transport.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, Testing Library

---

### Task 1: Lock the section-header contract with failing tests

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/phone/PhoneCompanion.test.tsx`
- Modify: `src/phone/phone-home-styles.test.mjs`

- [x] **Step 1: Add the failing Home and detail header assertions**

Add assertions that Home exposes a `SANDEVISTAN / DASHBOARD` section label and
that an opened detail screen uses a `phone-detail-header` element containing
Back and the selected title.

```tsx
expect(screen.getByText("SANDEVISTAN / DASHBOARD")).toBeTruthy();

fireEvent.click(screen.getByRole("button", { name: /Devices/ }));
expect(screen.getByRole("banner").classList.contains("phone-detail-header"))
  .toBe(true);
```

- [x] **Step 2: Add the failing compact style contract**

Read `phone-home.css` and `phone-shell.css` and assert the exact selected
dimensions and surface treatment:

```js
expect(homeCss).toMatch(
  /\.phone-home__subheader\s*\{[^}]*min-height:\s*40px/s,
);
expect(shellCss).toMatch(
  /\.phone-detail-header\s*\{[^}]*min-height:\s*52px/s,
);
expect(shellCss).toMatch(
  /\.phone-detail-header\s*\{[^}]*background:\s*transparent/s,
);
expect(shellCss).not.toMatch(
  /\.phone-detail-header\s*\{[^}]*backdrop-filter:/s,
);
```

- [x] **Step 3: Run the focused tests and verify RED**

Run:

```bash
npx vitest run src/phone/PhoneCompanion.test.tsx src/phone/phone-home-styles.test.mjs --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because the Home label, 40-pixel subheader, 52-pixel detail
header, and transparent detail surface do not exist yet.

### Task 2: Implement the compact subheader hierarchy

**Files:**
- Modify: `src/phone/PhoneHome.tsx`
- Modify: `src/phone/phone-home.css`
- Modify: `src/phone/phone-shell.css`

- [x] **Step 1: Replace the Home application title with a section label**

Use a non-heading header label so it does not compete with the native app bar:

```tsx
<header className="phone-home__subheader">
  <span>SANDEVISTAN</span>
  <span aria-hidden="true">/</span>
  <strong>{t("dashboard")}</strong>
</header>
```

- [x] **Step 2: Apply the compact Home style**

```css
.phone-home__subheader {
  display: flex;
  min-height: 40px;
  align-items: center;
  gap: 7px;
  padding: 0 12px;
  color: var(--phone-muted);
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0.08em;
}
```

Keep the screen-level `Dashboard` heading above the card grid because it labels
the content region rather than duplicating native navigation.

- [x] **Step 3: Restyle the detail header as an inset section row**

```css
.phone-detail-header {
  min-height: 52px;
  grid-template-columns: 44px minmax(0, 1fr) 44px;
  padding: 0 12px;
  background: transparent;
}

.phone-detail-header h1 {
  font-size: 1rem;
  font-weight: 600;
  text-align: left;
}
```

Remove `backdrop-filter`, reduce Back to the existing 44-pixel target, and keep
the header sticky with no shadow or border.

- [x] **Step 4: Run the focused tests and verify GREEN**

Run:

```bash
npx vitest run src/phone/PhoneCompanion.test.tsx src/phone/phone-home-styles.test.mjs --no-file-parallelism --maxWorkers=1
```

Expected: all focused tests pass.

### Task 3: Verify and publish

**Files:**
- Modify: `docs/superpowers/plans/2026-07-29-phone-subheader.md`

- [x] **Step 1: Run the full serial test suite**

```bash
npm test
```

Expected: all Vitest files and tests pass.

- [x] **Step 2: Run TypeScript and production build checks**

```bash
npm run typecheck
npm run build
```

Expected: both commands exit successfully.

- [x] **Step 3: Run repository checks**

```bash
npm run test:repo
git diff --check
```

Expected: repository checks pass and no whitespace errors are reported.

- [x] **Step 4: Confirm the Tailscale preview is reachable**

```bash
curl -sS -o /dev/null -w '%{http_code}\n' \
  'http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11'
```

Expected: `200`.

- [x] **Step 5: Commit and push**

```bash
git add src/phone/PhoneCompanion.test.tsx \
  src/phone/PhoneHome.tsx \
  src/phone/phone-home.css \
  src/phone/phone-home-styles.test.mjs \
  src/phone/phone-shell.css \
  docs/superpowers/plans/2026-07-29-phone-subheader.md
git commit -m "feat: demote phone headers to section chrome"
git push origin main
```

Expected: local `HEAD` and `origin/main` resolve to the same commit.
