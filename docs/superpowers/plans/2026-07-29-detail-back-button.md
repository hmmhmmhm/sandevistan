# Detail Back Button Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a large localized “Back to Dashboard” button beneath the existing clickable breadcrumb on every phone companion detail screen.

**Architecture:** Keep `PhoneHeader` unchanged as the breadcrumb owner. Render a separate navigation button in `PhoneCompanion` between the header and detail content. Route both controls through the existing `setScreen("home")` action. The persistent HUD Canvas must not remount.

**Tech Stack:** React 19, TypeScript, Pixelarticons through `PhoneIcon`, CSS, Testing Library, Vitest

---

### Task 1: Localized detail return button

**Files:**
- Modify: `AGENTS.md`
- Modify: `src/phone-i18n.ts`
- Modify: `src/phone/PhoneCompanion.tsx`
- Modify: `src/phone/phone-shell.css`
- Test: `src/phone/PhoneCompanion.test.tsx`

- [ ] **Step 1: Write the failing component test**

Update the detail navigation test. Assert that Home has no large return button and every detail screen has one. Clicking the button must return Home without replacing the Canvas:

```tsx
expect(screen.queryByRole("button", { name: "Back to Dashboard" }))
  .toBeNull();
fireEvent.click(screen.getByRole("button", { name: /Devices/ }));
const detailBack = screen.getByRole("button", {
  name: "Back to Dashboard",
});
expect(detailBack.querySelector('[data-phone-icon="back"]'))
  .toBeTruthy();
expect(getComputedStyle(detailBack).minHeight).toBe("58px");
expect(getComputedStyle(detailBack).backgroundColor)
  .toBe("rgb(255, 255, 255)");
fireEvent.click(detailBack);
expect(screen.getByTestId("persistent-canvas")).toBe(canvas);
```

Add a Korean assertion:

```tsx
renderCompanion({
  ...DEFAULT_PHONE_PREFERENCES,
  locale: "ko",
});
fireEvent.click(screen.getByRole("button", { name: /^\uAE30\uAE30/ }));
expect(screen.getByRole("button", {
  name: "\uB300\uC2DC\uBCF4\uB4DC\uB85C \uB3CC\uC544\uAC00\uAE30",
}))
  .toBeTruthy();
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npx vitest run src/phone/PhoneCompanion.test.tsx \
  --no-file-parallelism --maxWorkers=1
```

Expected: FAIL because no `Back to Dashboard` button exists.

- [ ] **Step 3: Add localized copy and the detail-only control**

Add `backToDashboard` to both locale tables:

```ts
const en = {
  backToDashboard: "Back to Dashboard",
};

const ko = {
  backToDashboard:
    "\uB300\uC2DC\uBCF4\uB4DC\uB85C \uB3CC\uC544\uAC00\uAE30",
};
```

Inside the detail-screen branch in `PhoneCompanion`, render:

```tsx
<button
  type="button"
  className="phone-detail-back"
  onClick={() => setScreen("home")}
>
  <PhoneIcon name="back" size={24} />
  <span>{t("backToDashboard")}</span>
</button>
```

Place it after `PhoneHeader` and before `.phone-detail-content`. Do not change
the breadcrumb’s existing `onBack={() => setScreen("home")}` behavior.

- [ ] **Step 4: Add the Even-style button treatment**

Add to `src/phone/phone-shell.css`:

```css
.phone-detail-back {
  display: flex;
  width: calc(100% - 32px);
  min-height: 58px;
  margin: 6px 16px 10px;
  align-items: center;
  gap: 12px;
  padding: 0 18px;
  color: var(--phone-text);
  text-align: left;
  border: 1px solid var(--phone-line);
  border-radius: 10px;
  background: var(--phone-card);
  font-weight: 600;
}
```

The existing `.phone-companion button:focus-visible` rule provides the
required focus treatment.

- [ ] **Step 5: Record the durable detail-navigation rule**

Update `AGENTS.md` to retain the approved interaction:

```md
- On every internal detail screen, retain the clickable breadcrumb and place
  one large localized white Back to Dashboard card immediately below it.
  Never render that card on Home.
```

- [ ] **Step 6: Run focused and full verification**

Run:

```bash
npx vitest run src/phone/PhoneCompanion.test.tsx \
  --no-file-parallelism --maxWorkers=1
npm test
npm run typecheck
npm run build
node --test --test-concurrency=1 tests/*.test.mjs
```

Expected: all commands pass serially.

- [ ] **Step 7: Commit and push**

```bash
git add AGENTS.md src/phone-i18n.ts src/phone/PhoneCompanion.tsx \
  src/phone/PhoneCompanion.test.tsx src/phone/phone-shell.css
git commit -m "feat: add detail back button"
git push origin main
```
