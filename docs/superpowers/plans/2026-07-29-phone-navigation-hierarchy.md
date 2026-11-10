# Phone Navigation Hierarchy Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Remove duplicated WebView navigation chrome while preserving a clear, functional path from each phone detail screen back to the dashboard.

**Architecture:** Keep the existing `PhoneHome`, `PhoneHeader`, and `PhoneCompanion` boundaries. Change the HTML document title. Remove the Home eyebrow. Turn the detail header into one localized breadcrumb button. Preserve the screen state and persistent Canvas lifecycle.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, Testing Library, Vite.

---

### Task 1: Lock the hierarchy in failing tests

**Files:**
- Modify: `src/phone/PhoneCompanion.test.tsx`
- Modify: `src/phone/phone-home-styles.test.mjs`
- Create: `src/document-title.test.mjs`

- [x] **Step 1: Replace the Home heading expectation**

Assert that the redundant project eyebrow is absent while the Dashboard section
heading remains:

```tsx
expect(screen.queryByText("SANDEVISTAN / DASHBOARD")).toBeNull();
expect(screen.getByRole("heading", {
  level: 2,
  name: "Dashboard",
})).toBeTruthy();
```

- [x] **Step 2: Specify the detail breadcrumb behavior**

After opening Devices, assert that there is no arrow-style Back button and that
the localized breadcrumb returns Home without remounting the Canvas:

```tsx
expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
fireEvent.click(screen.getByRole("button", {
  name: "Dashboard / Devices",
}));
expect(screen.getByRole("heading", {
  level: 2,
  name: "Dashboard",
})).toBeTruthy();
expect(screen.getByTestId("persistent-canvas")).toBe(canvas);
```

- [x] **Step 3: Specify the new CSS contract**

Assert that `phone-home__subheader` is absent and the breadcrumb button is
full-width, left-aligned, transparent, and at least 44 pixels high:

```js
expect(css).not.toContain(".phone-home__subheader");
expect(shellCss).toMatch(
  /\.phone-detail-header__breadcrumb\s*\{[^}]*width:\s*100%[^}]*min-height:\s*44px[^}]*text-align:\s*left[^}]*background:\s*transparent/s,
);
```

- [x] **Step 4: Specify the document title**

Read `index.html` and assert:

```js
expect(html).toContain("<title>SANDEVISTAN</title>");
expect(html).not.toContain("SANDEVISTAN HUD Prototype");
```

- [x] **Step 5: Run focused tests and verify RED**

Run:

```bash
npx vitest run src/phone/PhoneCompanion.test.tsx src/phone/phone-home-styles.test.mjs src/document-title.test.mjs --no-file-parallelism --maxWorkers=1
```

Expected: failures for the existing Home eyebrow, existing Back icon button,
missing breadcrumb styles, and old document title.

### Task 2: Implement the subordinate WebView hierarchy

**Files:**
- Modify: `index.html`
- Modify: `src/phone/PhoneHome.tsx`
- Modify: `src/phone/PhoneHeader.tsx`
- Modify: `src/phone/PhoneCompanion.tsx`
- Modify: `src/phone/phone-home.css`
- Modify: `src/phone/phone-shell.css`
- Modify: `AGENTS.md`

- [x] **Step 1: Set the native wrapper title**

Change the document title to:

```html
<title>SANDEVISTAN</title>
```

- [x] **Step 2: Remove the Home eyebrow**

Delete the `phone-home__subheader` element from `PhoneHome` so the preview is
the first WebView-owned element.

- [x] **Step 3: Render a text breadcrumb**

Replace the icon Back button in `PhoneHeader` with:

```tsx
<button
  type="button"
  className="phone-detail-header__breadcrumb"
  aria-label={`${parentLabel} / ${title}`}
  onClick={onBack}
>
  <span>{parentLabel}</span>
  <span aria-hidden="true">/</span>
  <h1>{title}</h1>
</button>
```

Keep the optional action slot separate and do not add a new icon.

- [x] **Step 4: Supply the dashboard parent label**

Change the `PhoneHeader` call to:

```tsx
<PhoneHeader
  title={t(SCREEN_TITLE[screen])}
  parentLabel={t("dashboard")}
  onBack={() => setScreen("home")}
/>
```

- [x] **Step 5: Update scoped CSS**

Remove `.phone-home__subheader` rules and define a compact header with a
full-width breadcrumb. Use `#888888` for the parent label, the existing
`--phone-text` for the screen title, no border, no shadow, no blur, and no
background fill.

- [x] **Step 6: Record the durable design rule**

In the phone companion section of `AGENTS.md`, document that the Even native bar owns the project title and arrow. Home starts at the preview. Internal detail navigation uses a text breadcrumb without an arrow.

- [x] **Step 7: Run focused tests and verify GREEN**

Run the focused command from Task 1.

Expected: all focused tests pass.

### Task 3: Verify, document, and publish the change

**Files:**
- Modify: `design-qa.md`
- Modify: `docs/superpowers/plans/2026-07-29-phone-navigation-hierarchy.md`

- [x] **Step 1: Run the complete serial verification**

Run each command separately:

```bash
npm test
npm run typecheck
npm run build
npm run test:repo
npm run test:sites
git diff --check
```

Expected: every command exits with status 0.

- [x] **Step 2: Update design evidence**

Document the owner-supplied screenshots as the source evidence. Record the removed duplicate Home label and detail arrow. If no matching post-change screenshot exists, leave the visual comparison unverified.

- [x] **Step 3: Mark this plan complete**

Change every checkbox in this file from `[ ]` to `[x]`.

- [x] **Step 4: Commit and push**

Run:

```bash
git add index.html src/phone src/document-title.test.mjs AGENTS.md design-qa.md docs/superpowers/plans/2026-07-29-phone-navigation-hierarchy.md
git commit -m "fix: simplify phone navigation hierarchy"
git push origin main
```

- [x] **Step 5: Confirm the running Tailscale preview**

Run:

```bash
curl -fsS -o /dev/null -w '%{http_code}\n' 'http://100.96.68.73:4176/hud-canvas-fast?sdk=0.0.11'
```

Expected: `200`.
