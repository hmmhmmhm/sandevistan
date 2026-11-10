# SDK 0.0.10 Image Transport A/B Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hold the Sandevistan G2 image diagnostic constant while switching only the Even Hub SDK image-request serialization from `0.0.12` to `0.0.10`.

**Architecture:** Keep the existing `/diagnostic-v10` page, click trigger, 200×100 1-bit BMP, and serial transport untouched. Pin SDK `0.0.10`, align manifest and QR metadata, prove the legacy request omits `compressMode: 2`, then run one physical G2 checkpoint and record the result.

**Tech Stack:** React 19, TypeScript 5.9, Vite 6, Vitest 4, `@evenrealities/even_hub_sdk`

---

## File Map

- Modify `src/sdk-version.test.ts`: assert the A/B SDK version metadata and the exact legacy image-request JSON.
- Modify `package.json`: pin SDK `0.0.10` and publish the `sdk-0010-ab` Tailscale diagnostic URL.
- Modify `package-lock.json`: lock the resolved SDK tarball and integrity for `0.0.10`.
- Modify `app.json`: align `min_sdk_version` with the SDK used by the diagnostic build.
- Modify `docs/superpowers/specs/2026-07-26-sdk-0010-image-transport-ab-design.md` after the physical checkpoint: record the observed result without changing the prior design.

### Task 1: Lock the SDK A/B contract

**Files:**
- Modify: `src/sdk-version.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `app.json`

- [ ] **Step 1: Write the failing version and serialization tests**

Replace `src/sdk-version.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { ImageRawDataUpdate } from "@evenrealities/even_hub_sdk";
import appManifest from "../app.json";
import packageManifest from "../package.json";

describe("Even Hub SDK compatibility", () => {
  it("pins the 0.0.10 A/B SDK across dependency, manifest, and QR metadata", () => {
    const installed = packageManifest.dependencies["@evenrealities/even_hub_sdk"];

    expect(installed).toBe("0.0.10");
    expect(appManifest.min_sdk_version).toBe(installed);
    expect(packageManifest.scripts.qr).toContain(
      "http://100.96.68.73:4173/diagnostic-v10",
    );
    expect(packageManifest.scripts.qr).toContain("sdk=0.0.10");
    expect(packageManifest.scripts.qr).toContain("build=sdk-0010-ab");
  });

  it("serializes image bytes without the 0.0.12 LZ4 transport flag", () => {
    const payload = new ImageRawDataUpdate({
      containerID: 3,
      containerName: "frame",
      imageData: new Uint8Array([1, 2, 3]),
    }).toJson();

    expect(payload).toEqual({
      containerID: 3,
      containerName: "frame",
      imageData: [1, 2, 3],
    });
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx vitest run src/sdk-version.test.ts
```

Expected: both tests fail under SDK `0.0.12`. The metadata test reports
`expected "0.0.12" to be "0.0.10"`, and the serialization test reports the
unexpected `compressMode: 2` property.

- [ ] **Step 3: Pin SDK `0.0.10` and update the lockfile**

Run:

```bash
npm install --save-exact @evenrealities/even_hub_sdk@0.0.10
```

Expected: `package.json` and `package-lock.json` resolve
`@evenrealities/even_hub_sdk` to exactly `0.0.10`.

- [ ] **Step 4: Align the diagnostic URL and app manifest**

In `package.json`, replace the `qr` script and keep the dependency exact:

```json
"qr": "evenhub qr --url \"http://100.96.68.73:4173/diagnostic-v10?sdk=0.0.10&build=sdk-0010-ab\""
```

```json
"@evenrealities/even_hub_sdk": "0.0.10"
```

In `app.json`, replace:

```json
"min_sdk_version": "0.0.12",
```

with:

```json
"min_sdk_version": "0.0.10",
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```bash
npx vitest run src/sdk-version.test.ts
```

Expected: 1 test file and 2 tests pass. The serialization assertion proves
that the SDK request contains `imageData` but no `compressMode`.

- [ ] **Step 6: Verify the resolved package**

Run:

```bash
npm ls @evenrealities/even_hub_sdk
```

Expected:

```text
└── @evenrealities/even_hub_sdk@0.0.10
```

- [ ] **Step 7: Commit the isolated A/B change**

Run:

```bash
git add package.json package-lock.json app.json src/sdk-version.test.ts
git commit -m "test: isolate legacy sdk image transport"
```

### Task 2: Run complete automated verification

**Files:**
- Verify: all project files

- [ ] **Step 1: Run the complete Vitest suite**

Run:

```bash
npm test
```

Expected: 4 test files and 21 tests pass with zero failures.

- [ ] **Step 2: Run TypeScript validation**

Run:

```bash
npm run typecheck
```

Expected: `tsc --noEmit` exits with status `0`.

- [ ] **Step 3: Build the production and Sites artifacts**

Run:

```bash
npm run build
```

Expected: Vite builds `dist/client/index.html`, and the preparation script
creates `dist/server/index.js` plus `dist/.openai/hosting.json`.

- [ ] **Step 4: Verify Sites packaging**

Run:

```bash
npm run test:sites
```

Expected: 4 tests pass and 0 tests fail.

- [ ] **Step 5: Verify the diff is limited to the A/B contract**

Run:

```bash
git show --stat --oneline HEAD
git status --short --branch
```

Expected: the commit changes only `package.json`, `package-lock.json`,
`app.json`, and `src/sdk-version.test.ts`. The worktree is clean.

### Task 3: Serve and perform the physical G2 checkpoint

**Files:**
- Runtime only: no source files

- [ ] **Step 1: Stop the existing port-4173 Vite process**

Run:

```bash
lsof -nP -iTCP:4173 -sTCP:LISTEN
```

Expected: exactly one existing Vite listener is shown. Stop that active dev
server with `Ctrl-C`, then rerun the command and confirm it prints no listener.

- [ ] **Step 2: Start the SDK `0.0.10` worktree server**

From the isolated worktree, run:

```bash
npm run dev -- --host 0.0.0.0 --port 4173 --strictPort
```

Expected: Vite reports both localhost and
`http://100.96.68.73:4173/`.

- [ ] **Step 3: Verify the exact diagnostic endpoint and listener**

Run:

```bash
curl --fail --silent --show-error --output /dev/null \
  "http://100.96.68.73:4173/diagnostic-v10?sdk=0.0.10&build=sdk-0010-ab"
lsof -nP -iTCP:4173 -sTCP:LISTEN
```

Expected: `curl` exits with status `0` and `lsof` shows exactly one listener
bound to `*:4173`.

- [ ] **Step 4: Open the diagnostic QR**

Run:

```bash
npm run qr -- --external
```

Expected: the external QR contains exactly:

```text
http://100.96.68.73:4173/diagnostic-v10?sdk=0.0.10&build=sdk-0010-ab
```

- [ ] **Step 5: Execute one hardware attempt**

In the Even Realities app:

1. Exit the previous Sandevistan plugin completely.
2. Open `Even Hub` and scan the new QR.
3. Wait for `TEXT READY - CLICK TO SEND`.
4. Press the G2 touchbar or R1 exactly once.
5. Record the final WebView status exactly. Do not retry in the same session.

Expected terminal status: either `1-bit BMP transmission completed` or
`1-bit BMP transmission failed: SENDFAILED`.

### Task 4: Classify and record the hardware result

**Files:**
- Modify: `docs/superpowers/specs/2026-07-26-sdk-0010-image-transport-ab-design.md`

- [ ] **Step 1: Restore SDK `0.0.12` only when the A/B result is `SENDFAILED`**

For `SENDFAILED`, run this before editing the result document:

```bash
git revert --no-edit HEAD
```

Expected: the SDK, manifest, QR metadata and version tests return to `0.0.12`.
The prior design document remains on the branch.

For `success`, do not revert the A/B commit. Preserve the working diagnostic
branch for the subsequent app/firmware compatibility test.

- [ ] **Step 2: Append the exact observed result**

If the status is `1-bit BMP transmission completed`, append:

```markdown
## Hardware result

- SDK: `0.0.10`
- Build: `sdk-0010-ab`
- Trigger: one manual G2 or R1 click
- Result: `success`
- Interpretation: the SDK `0.0.12` image transport change is incompatible with
  the current Even app or G2 firmware environment.
- Next: update the Even app and G2 firmware, then retest SDK `0.0.12`.
```

If the status is `1-bit BMP transmission failed: SENDFAILED`, append:

```markdown
## Hardware result

- SDK: `0.0.10`
- Build: `sdk-0010-ab`
- Trigger: one manual G2 or R1 click
- Result: `SENDFAILED`
- Interpretation: the SDK `0.0.12` LZ4 transport flag is not the primary cause.
- Next: restore SDK `0.0.12` and diagnose the Even app, G2 firmware and dual-BLE
  image channel.
```

- [ ] **Step 3: Verify the post-result state**

Run:

```bash
npm test
npm run typecheck
git diff --check
```

Expected for `success`: 4 test files and 21 tests pass under SDK `0.0.10`.

Expected for `SENDFAILED`: 4 test files and 20 tests pass under restored SDK
`0.0.12`.

- [ ] **Step 4: Commit the hardware evidence**

Run:

```bash
git add docs/superpowers/specs/2026-07-26-sdk-0010-image-transport-ab-design.md
git commit -m "docs: record sdk image transport hardware result"
```

Do not push this diagnostic branch without explicit user approval.
