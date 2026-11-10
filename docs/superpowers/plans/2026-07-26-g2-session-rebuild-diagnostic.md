# G2 Session Rebuild Diagnostic Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the app and diagnostic build version in the webview, expose every G2 page lifecycle boundary, and retry `invalid` startup creation exactly once through `rebuildPageContainer()`.

**Architecture:** Keep the existing `/diagnostic-v*` route and official `200×100` sample path. `App.tsx` owns the persistent webview status log and version label; `transmitOfficialSample()` owns the native bridge lifecycle and reports each boundary through its existing callback. Only an `invalid` create result may enter the rebuild branch. The separate port-5178 size-profile harness remains unchanged for the later width/height matrix.

**Tech Stack:** React 19, TypeScript 5.9, Vite 6, Vitest 4, `@evenrealities/even_hub_sdk` 0.0.12

---

## File Map

- Modify `src/App.tsx`: render `v0.1.0 · session-rebuild-1` and preserve progress history.
- Modify `src/App.test.tsx`: verify the version/build label and status-log rendering contract.
- Modify `src/glasses.ts`: report create/rebuild boundaries and wait three seconds after a valid page.
- Modify `src/glasses.test.ts`: cover create success, conditional rebuild, rebuild failure, and non-session errors.
- Modify `src/styles.css`: stack version and status-log lines without changing the HUD raster.
- Modify `package.json`: point the local diagnostic command at `/diagnostic-v11`.

### Task 1: Webview version and persistent status log

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write the failing version-label test**

Add this test to `src/App.test.tsx`:

```tsx
it("shows the app version and diagnostic build name in the webview", () => {
  window.history.replaceState({}, "", "/diagnostic-v11");
  render(<App autoStart={false} />);

  expect(screen.getByText("v0.1.0 · session-rebuild-1")).toBeTruthy();
  expect(screen.getByTestId("status-log").children).toHaveLength(1);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm test -- src/App.test.tsx
```

Expected: FAIL because the version string and `status-log` element do not exist.

- [ ] **Step 3: Implement the version label and status history**

In `src/App.tsx`, import the manifest and define the diagnostic build:

```tsx
import appManifest from "../app.json";

const DIAGNOSTIC_BUILD = "session-rebuild-1";
```

Replace the scalar status state:

```tsx
const initialStatus = autoStart ? "Preparing HUD image" : "Disable automatic transfer";
const [statusLog, setStatusLog] = useState([initialStatus]);
```

Replace the progress reporter:

```tsx
const report = (message: string) => {
  if (!cancelled) {
    setStatusLog((current) => [...current, message]);
  }
};
```

Render the version directly under the mode description:

```tsx
<small className="build-version">
  {`v${appManifest.version} · ${DIAGNOSTIC_BUILD}`}
</small>
```

Replace the scalar output with a persistent log:

```tsx
<output aria-live="polite" data-testid="status-log">
  {statusLog.map((message, index) => (
    <span key={`${index}-${message}`}>{message}</span>
  ))}
</output>
```

Add these declarations to `src/styles.css`:

```css
.build-version {
  display: block;
  margin-top: 2px;
  color: #74ad80;
  font: 11px/1.3 ui-monospace, SFMono-Regular, Consolas, monospace;
}

.preview-header output {
  display: grid;
  max-height: 9rem;
  overflow: auto;
  text-align: right;
}

.preview-header output span {
  display: block;
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
npm test -- src/App.test.tsx
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit the webview diagnostics**

```powershell
git add src/App.tsx src/App.test.tsx src/styles.css
git commit -m "feat: show diagnostic build in webview"
```

### Task 2: Conditional session rebuild instrumentation

**Files:**
- Modify: `src/glasses.test.ts`
- Modify: `src/glasses.ts`

- [ ] **Step 1: Expand the create-success test**

Replace the current official-sample success assertion with progress and delay assertions:

```tsx
const reports: string[] = [];
let waited = 0;

await module.transmitOfficialSample(
  (message) => reports.push(message),
  {
    waitForBridge: async () => bridge,
    loadBytes: async () => sample,
    waitForPageReady: async (milliseconds) => {
      waited = milliseconds;
      calls.push("ready");
    },
  } as Parameters<typeof module.transmitOfficialSample>[1],
);

expect(waited).toBe(3000);
expect(calls).toEqual(["create", "ready", "image:3:137", "status"]);
expect(reports).toEqual([
  "BRIDGE WAIT",
  "BRIDGE READY",
  "PAGE CREATING",
  "PAGE RESULT: success",
  "PAGE READY 200x100 - SEND IN 3S",
  “Official sample.png transfer complete”,
]);
```

- [ ] **Step 2: Add the conditional-rebuild tests**

Add these tests to `src/glasses.test.ts`:

```tsx
it("rebuilds once after invalid and reports every boundary", async () => {
  const module = await loadGlasses();
  if (!module) return;

  const calls: string[] = [];
  const reports: string[] = [];
  const bridge = {
    createStartUpPageContainer: async () => {
      calls.push("create");
      return 1;
    },
    rebuildPageContainer: async () => {
      calls.push("rebuild");
      return true;
    },
    updateImageRawData: async () => {
      calls.push("image");
      return "success";
    },
    textContainerUpgrade: async () => true,
    onEvenHubEvent: () => () => undefined,
    shutDownPageContainer: async () => true,
  };

  await module.transmitOfficialSample(
    (message) => reports.push(message),
    {
      waitForBridge: async () => bridge,
      loadBytes: async () => new Uint8Array([137]),
      waitForPageReady: async () => {
        calls.push("ready");
      },
    },
  );

  expect(calls).toEqual(["create", "rebuild", "ready", "image"]);
  expect(reports.slice(0, 7)).toEqual([
    "BRIDGE WAIT",
    "BRIDGE READY",
    "PAGE CREATING",
    "PAGE RESULT: invalid",
    "PAGE REBUILDING",
    "PAGE REBUILD RESULT: true",
    "PAGE READY 200x100 - SEND IN 3S",
  ]);
});

it("stops after an invalid page also fails to rebuild", async () => {
  const module = await loadGlasses();
  if (!module) return;

  const calls: string[] = [];
  const reports: string[] = [];
  const bridge = {
    createStartUpPageContainer: async () => 1,
    rebuildPageContainer: async () => {
      calls.push("rebuild");
      return false;
    },
    updateImageRawData: async () => {
      calls.push("image");
      return "success";
    },
    textContainerUpgrade: async () => true,
    onEvenHubEvent: () => () => undefined,
    shutDownPageContainer: async () => true,
  };

  await expect(module.transmitOfficialSample(
    (message) => reports.push(message),
    {
      waitForBridge: async () => bridge,
      loadBytes: async () => new Uint8Array([137]),
      waitForPageReady: async () => {
        calls.push("ready");
      },
    },
  )).rejects.toThrow("PAGE REBUILD FAILED");

  expect(calls).toEqual(["rebuild"]);
  expect(reports.at(-1)).toBe("PAGE REBUILD RESULT: false");
});

it.each([
  [2, "oversize"],
  [3, "outOfMemory"],
])("does not rebuild native page error %i (%s)", async (result, name) => {
  const module = await loadGlasses();
  if (!module) return;

  let rebuilds = 0;
  const bridge = {
    createStartUpPageContainer: async () => result,
    rebuildPageContainer: async () => {
      rebuilds += 1;
      return true;
    },
    updateImageRawData: async () => "success",
    textContainerUpgrade: async () => true,
    onEvenHubEvent: () => () => undefined,
    shutDownPageContainer: async () => true,
  };

  await expect(module.transmitOfficialSample(
    () => undefined,
    {
      waitForBridge: async () => bridge,
      loadBytes: async () => new Uint8Array([137]),
      waitForPageReady: async () => undefined,
    },
  )).rejects.toThrow(`PAGE CREATE FAILED: ${name}`);
  expect(rebuilds).toBe(0);
});
```

- [ ] **Step 3: Run the lifecycle tests and verify RED**

Run:

```powershell
npm test -- src/glasses.test.ts
```

Expected: FAIL because current progress messages are Korean summaries, the delay is 1000 ms, and error strings do not expose normalized result names.

- [ ] **Step 4: Instrument `transmitOfficialSample()`**

Replace the startup section of `transmitOfficialSample()` with:

```tsx
onProgress("BRIDGE WAIT");
const bridge = await dependencies.waitForBridge();
onProgress("BRIDGE READY");
const page = createOfficialDiagnosticPage();
onProgress("PAGE CREATING");
const created = StartUpPageCreateResult.normalize(
  await bridge.createStartUpPageContainer(page),
);
const resultName = StartUpPageCreateResult[created];
onProgress(`PAGE RESULT: ${resultName}`);

if (created === StartUpPageCreateResult.invalid) {
  onProgress("PAGE REBUILDING");
  const rebuilt = await bridge.rebuildPageContainer(new RebuildPageContainer({
    containerTotalNum: page.containerTotalNum,
    textObject: page.textObject,
    imageObject: page.imageObject,
  }));
  onProgress(`PAGE REBUILD RESULT: ${rebuilt}`);
  if (!rebuilt) throw new Error("PAGE REBUILD FAILED");
} else if (created !== StartUpPageCreateResult.success) {
  throw new Error(`PAGE CREATE FAILED: ${resultName}`);
}

onProgress("PAGE READY 200x100 - SEND IN 3S");
await dependencies.waitForPageReady(3000);
```

Leave the byte loading, serial image update, status text update, and double-click shutdown code unchanged.

- [ ] **Step 5: Run focused and full tests**

Run:

```powershell
npm test -- src/glasses.test.ts
npm test
```

Expected: focused tests pass, then all tests pass with zero failures.

- [ ] **Step 6: Commit the lifecycle diagnostics**

```powershell
git add src/glasses.ts src/glasses.test.ts
git commit -m "fix: diagnose existing G2 page sessions"
```

### Task 3: Diagnostic route and release verification

**Files:**
- Modify: `package.json`
- Verify: `app.json`

- [ ] **Step 1: Write the failing route assertion**

Extend `src/sdk-version.test.ts`:

```tsx
expect(packageManifest.scripts.qr).toContain("/diagnostic-v11");
expect(packageManifest.scripts.qr).toContain("build=session-rebuild-1");
```

- [ ] **Step 2: Run the route test and verify RED**

Run:

```powershell
npm test -- src/sdk-version.test.ts
```

Expected: FAIL because the script still points at `/diagnostic-v10`.

- [ ] **Step 3: Update the diagnostic URL**

Change the `qr` script in `package.json` to:

```json
"qr": "evenhub qr --url http://100.84.176.81:4173/diagnostic-v11?sdk=0.0.12&build=session-rebuild-1"
```

- [ ] **Step 4: Run complete verification**

Run:

```powershell
npm test
npm run typecheck
npm run build
npm run test:sites
```

Expected:

- Vitest reports all test files and tests passing.
- TypeScript exits with code 0.
- Vite produces `dist/client/index.html`.
- Sites tests report 4 passes and 0 failures.

- [ ] **Step 5: Verify the local Tailscale endpoint**

Keep the existing Vite server on port 4173 running, then run:

```powershell
Invoke-WebRequest -UseBasicParsing "http://100.84.176.81:4173/diagnostic-v11?sdk=0.0.12&build=session-rebuild-1"
Get-NetTCPConnection -LocalPort 4173 -State Listen
```

Expected: HTTP status `200` and exactly one listener on port 4173.

- [ ] **Step 6: Commit and push**

```powershell
git add package.json src/sdk-version.test.ts
git commit -m "chore: publish session rebuild diagnostic"
git push origin main
```

- [ ] **Step 7: Perform the hardware checkpoint**

Open:

```text
http://100.84.176.81:4173/diagnostic-v11?sdk=0.0.12&build=session-rebuild-1
```

Record the last webview log line and whether the G2 displays the official `200×100` sample. Do not start the width/height matrix until this baseline either reaches `PAGE REBUILD RESULT: true` or produces a reproducible `PAGE REBUILD RESULT: false`.
