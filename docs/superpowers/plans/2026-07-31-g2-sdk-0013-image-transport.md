# G2 SDK 0.0.13 Image Transport Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` to implement this plan task-by-task. This task
> is intentionally executed inline without subagents.

**Goal:** Upgrade an isolated Sandevistan candidate from Even Hub SDK `0.0.11`
to `0.0.13`, preserve every proven rendering and scheduling behavior, and open
a verified G2 hardware-test server without changing `main`.

**Architecture:** Change only dependency and compatibility metadata while the
existing fast Canvas renderer and four-call no-queue transport remain intact.
Use manifest-derived UI metadata and a dedicated QR/build marker. Use a separate port 4179 server. Record physical results against the SDK and updated host firmware.

**Tech Stack:** Even Hub SDK `0.0.13`, TypeScript 5.9, React 19, Vitest 4,
Vite 6, Even Hub CLI `0.1.13`, physical Even Realities G2.

---

### Task 1: Pin the SDK 0.0.13 compatibility contract

**Files:**
- Modify: `src/sdk-version.test.ts`
- Modify: `src/phone/DevicesScreen.test.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `app.json`

- [ ] **Step 1: Write the failing version and compression expectations**

Change the primary compatibility test to require:

```ts
expect(installed).toBe("0.0.13");
expect(appManifest.min_sdk_version).toBe(installed);
expect(appManifest.min_app_version).toBe("2.2.6");
expect(packageManifest.scripts.qr).toBe(
  'evenhub qr --url "http://100.127.255.11:4179/hud-canvas-fast?sdk=0.0.13&build=sdk-0013-repair-042"',
);
```

Change the image serialization expectation to:

```ts
expect(payload).toEqual({
  compressMode: 2,
  containerID: 3,
  containerName: "frame",
  imageData: [1, 2, 3],
});
```

Keep the pipeline and rollback script test, but add an assertion that
`qr:rollback` still points to port 4177 and SDK `0.0.11`. Change the phone
device screen expectation from `0.0.11` to `0.0.13`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npx vitest run src/sdk-version.test.ts src/phone/DevicesScreen.test.tsx \
  --no-file-parallelism --maxWorkers=1
```

Expected: failures report the installed SDK, app minimum version, QR URL,
missing `compressMode: 2`, and phone metadata still using the `0.0.11`
baseline.

- [ ] **Step 3: Install the exact candidate and update metadata**

Run:

```bash
npm install --save-exact @evenrealities/even_hub_sdk@0.0.13
```

Set these manifest values:

```json
{
  "min_app_version": "2.2.6",
  "min_sdk_version": "0.0.13"
}
```

Set only the primary candidate QR script to:

```json
"qr": "evenhub qr --url \"http://100.127.255.11:4179/hud-canvas-fast?sdk=0.0.13&build=sdk-0013-repair-042\""
```

Keep `qr:rollback` on the known-good port 4177 SDK `0.0.11` URL. Do not modify
the renderer, transport, or SDK caller payload.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run the Step 2 command again. Expected: both files pass and the runtime
serialization includes `compressMode: 2`.

- [ ] **Step 5: Commit the version gate**

```bash
git add src/sdk-version.test.ts src/phone/DevicesScreen.test.tsx \
  package.json package-lock.json app.json
git commit -m "chore: test Even Hub SDK 0.0.13 transport"
```

### Task 2: Document the isolated physical gate

**Files:**
- Create: `docs/hardware/2026-07-31-sdk-0013-image-transport.md`

- [ ] **Step 1: Add the candidate test record**

Document the exact branch, base commit, app/SDK requirements, fixed transport
settings, candidate URL, rollback URL, automated checks, and a pending physical
checklist. Include four-tile bilateral startup, page changes, detail interactions, hide/restore, busy drops, and idle minute boundaries in the checklist. Check for `sendFailed`, retries, queue growth, or WebView stalls. None may occur.

- [ ] **Step 2: Validate repository copy**

Run:

```bash
npm run test:repo
git diff --check
```

Expected: five repository tests pass, the copy check passes, and the diff has
no whitespace errors.

- [ ] **Step 3: Commit the hardware gate**

```bash
git add docs/hardware/2026-07-31-sdk-0013-image-transport.md
git commit -m "docs: prepare SDK 0.0.13 G2 gate"
```

### Task 3: Verify the complete candidate serially

**Files:**
- Verify only
- Output: `sandevistan.ehpk`

- [ ] **Step 1: Run application verification**

Run serially:

```bash
npm test
npm run typecheck
npm run build
npm run test:sites
node --test --test-concurrency=1 tests/*.test.mjs
npm run test:repo
```

Expected: every command exits zero with no failed or cancelled test.

- [ ] **Step 2: Build the Even Hub package**

Run:

```bash
npm run pack
shasum -a 256 sandevistan.ehpk
npm ls @evenrealities/even_hub_sdk @evenrealities/evenhub-cli --depth=0
```

Expected: the package exists, a SHA-256 is recorded, SDK `0.0.13` is installed,
and the CLI remains `0.1.13`.

- [ ] **Step 3: Scan the production output**

Run:

```bash
rg -n "eyJvcmci|ORS_API_KEY" src dist/client || true
find src -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.css' \) \
  -print0 | xargs -0 wc -l | sort -nr | head -20
git diff --check
git status --short
```

Expected: no ORS JWT is embedded, no modified custom implementation file
exceeds the repository boundary, and only intentional experiment output or
documentation remains.

### Task 4: Start and verify the Tailscale hardware server

**Files:**
- Runtime process only

- [ ] **Step 1: Confirm port isolation**

Run:

```bash
lsof -nP -iTCP:4177 -sTCP:LISTEN
lsof -nP -iTCP:4179 -sTCP:LISTEN || true
```

Expected: the existing main process still owns 4177 and 4179 is free.

- [ ] **Step 2: Start the experiment server**

Run the Vite development server from this worktree on port 4179 and retain its
process ID. Do not stop or replace port 4177.

- [ ] **Step 3: Verify both network paths**

Run:

```bash
curl -fsS -o /dev/null -w '%{http_code}\n' \
  'http://127.0.0.1:4179/hud-canvas-fast?sdk=0.0.13&build=sdk-0013-repair-042'
curl -fsS -o /dev/null -w '%{http_code}\n' \
  'http://100.127.255.11:4179/hud-canvas-fast?sdk=0.0.13&build=sdk-0013-repair-042'
```

Expected: both return HTTP 200.

### Task 5: Preserve the candidate and hand off the physical test

**Files:**
- Verify and push existing commits

- [ ] **Step 1: Audit the branch**

Run:

```bash
git status --short --branch
git log --oneline --decorate -5
git diff main...HEAD --check
git diff --stat main...HEAD
```

Expected: the branch contains only the approved SDK experiment and its records.

- [ ] **Step 2: Push the experiment branch**

```bash
git push -u origin experiment/g2-sdk-0013
```

Expected: local and remote branch hashes match. Do not merge to `main`.

- [ ] **Step 3: Hand off one serial physical run**

Provide the candidate and rollback URLs. Ask the owner to open only the
candidate first and report whether the first four tiles appear in both eyes,
then copy the WebView trace. The physical result remains pending until that
evidence is supplied.
