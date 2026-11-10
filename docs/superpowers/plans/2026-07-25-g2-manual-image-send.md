# G2 Manual Image Send Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a v10 hardware diagnostic that sends the existing checkerboard BMP only after one glasses click.

**Architecture:** Put glasses-event normalization in a small `image-trigger.ts`
module. Inject the module into the existing BMP transport. Keep the v9 container,
BMP encoder, payload type, and bridge method unchanged so the trigger is the
only hardware variable.

**Tech Stack:** TypeScript, React, Vite, Vitest, Even Hub SDK 0.0.10

---

The workspace has no `.git` directory. Do not initialize a repository or invent
a remote while executing this plan; commit checkpoints are unavailable until
the repository setup is handled separately.

### Task 1: Isolate the glasses click trigger

**Files:**
- Create: `src/image-trigger.ts`
- Create: `src/image-trigger.test.ts`

- [ ] **Step 1: Write failing event-normalization tests**

```ts
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { OsEventTypeList, type EvenHubEvent } from "@evenrealities/even_hub_sdk";
import { waitForImageClick } from "./image-trigger";

describe("manual image trigger", () => {
  it("ignores unrelated events and resolves one omitted-zero click", async () => {
    let listener: ((event: EvenHubEvent) => void) | undefined;
    let unsubscribed = 0;
    let resolved = false;
    const pending = waitForImageClick({
      onEvenHubEvent: (next) => {
        listener = next;
        return () => { unsubscribed += 1; };
      },
      shutDownPageContainer: async () => true,
    }).then(() => { resolved = true; });

    listener!({ imuData: {} } as EvenHubEvent);
    await Promise.resolve();
    expect(resolved).toBe(false);

    listener!({ sysEvent: {} } as EvenHubEvent);
    await pending;
    listener!({ sysEvent: {} } as EvenHubEvent);
    expect(resolved).toBe(true);
    expect(unsubscribed).toBe(1);
  });

  it("exits on double click without resolving the image trigger", async () => {
    let listener: ((event: EvenHubEvent) => void) | undefined;
    let exits = 0;
    let resolved = false;
    void waitForImageClick({
      onEvenHubEvent: (next) => {
        listener = next;
        return () => undefined;
      },
      shutDownPageContainer: async () => {
        exits += 1;
        return true;
      },
    }).then(() => { resolved = true; });

    listener!({
      sysEvent: { eventType: OsEventTypeList.DOUBLE_CLICK_EVENT },
    } as EvenHubEvent);
    await Promise.resolve();
    expect(exits).toBe(1);
    expect(resolved).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npx vitest run src/image-trigger.test.ts
```

Expected: FAIL because `src/image-trigger.ts` does not exist.

- [ ] **Step 3: Implement the one-shot trigger**

```ts
import {
  OsEventTypeList,
  type EvenHubEvent,
} from "@evenrealities/even_hub_sdk";

type TriggerBridge = {
  onEvenHubEvent: (listener: (event: EvenHubEvent) => void) => () => void;
  shutDownPageContainer: (exitMode: number) => Promise<unknown>;
};

export function waitForImageClick(bridge: TriggerBridge) {
  return new Promise<void>((resolve) => {
    let settled = false;
    let unsubscribe = () => undefined;
    unsubscribe = bridge.onEvenHubEvent((event) => {
      if (settled) return;
      const sysType = event.sysEvent
        ? event.sysEvent.eventType ?? OsEventTypeList.CLICK_EVENT
        : null;
      const textType = event.textEvent
        ? event.textEvent.eventType ?? OsEventTypeList.CLICK_EVENT
        : null;
      if (
        sysType === OsEventTypeList.DOUBLE_CLICK_EVENT
        || textType === OsEventTypeList.DOUBLE_CLICK_EVENT
      ) {
        settled = true;
        unsubscribe();
        void bridge.shutDownPageContainer(1);
      } else if (
        sysType === OsEventTypeList.CLICK_EVENT
        || textType === OsEventTypeList.CLICK_EVENT
      ) {
        settled = true;
        unsubscribe();
        resolve();
      }
    });
  });
}
```

- [ ] **Step 4: Run the targeted test and verify GREEN**

Run:

```powershell
npx vitest run src/image-trigger.test.ts
```

Expected: 2 tests passed.

### Task 2: Replace the BMP timer with the manual trigger

**Files:**
- Modify: `src/glasses.ts`
- Modify: `src/glasses.test.ts`

- [ ] **Step 1: Change the transport test before production code**

In the `transmitHardwareBmp` test, inject:

```ts
waitForTrigger: async () => {
  calls.push("click");
},
```

Replace the expected sequence with:

```ts
expect(calls).toEqual([
  "create",
  "rebuild",
  "announce",
  "click",
  "image:3:66:77:2862",
  "status",
]);
```

- [ ] **Step 2: Run the transport test and verify RED**

Run:

```powershell
npx vitest run src/glasses.test.ts
```

Expected: FAIL because `transmitHardwareBmp` still calls the three-second
`waitForPageReady` dependency.

- [ ] **Step 3: Inject the production click trigger**

Import the helper:

```ts
import { waitForImageClick } from "./image-trigger";
```

Define the hardware dependencies independently from the official PNG path:

```ts
type HardwareBmpDependencies = {
  waitForBridge: () => Promise<OfficialBridge>;
  waitForTrigger: typeof waitForImageClick;
};
```

Use the click trigger in `transmitHardwareBmp`:

```ts
dependencies: HardwareBmpDependencies = {
  waitForBridge: waitForEvenAppBridge,
  waitForTrigger: waitForImageClick,
},
```

After rebuilding the page, show the ready message. Then wait for the click:

```ts
const announced = await bridge.textContainerUpgrade(new TextContainerUpgrade({
  containerID: 2,
  containerName: "status",
  content: "TEXT READY - CLICK TO SEND",
}));
if (!announced) throw new Error("Failed to display BMP dictionary text");
onProgress("Waiting for glasses to be clicked");
await dependencies.waitForTrigger(bridge);
```

Do not change `encode1BitBmp()`, the 200×100 checkerboard, container 3, or the
`Uint8Array` payload.

- [ ] **Step 4: Run transport tests and verify GREEN**

Run:

```powershell
npx vitest run src/glasses.test.ts src/image-trigger.test.ts
```

Expected: all tests passed.

- [ ] **Step 5: Check the existing line budget**

Run:

```powershell
(Get-Content -LiteralPath src/glasses.ts).Count
```

Expected: no more than 450 lines. If imports or type formatting push it over,
compact only the touched declarations without changing behavior.

### Task 3: Expose only the v10 route through the QR command

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `package.json`

- [ ] **Step 1: Update the route test first**

```ts
it("selects the click-triggered BMP diagnostic from the v10 path", () => {
  window.history.replaceState({}, "", "/diagnostic-v10");
  render(<App autoStart={false} />);
  expect(screen.getByText(/1-BIT BMP · CLICK TO SEND/)).toBeTruthy();
});
```

- [ ] **Step 2: Run the app test and verify RED**

Run:

```powershell
npx vitest run src/App.test.tsx
```

Expected: FAIL because v10 still selects the official PNG diagnostic.

- [ ] **Step 3: Route v10 to the BMP transport**

Set:

```ts
const hardwareBmpMode = window.location.pathname === "/diagnostic-v10";
```

Use the header:

```tsx
"1-BIT BMP · CLICK TO SEND"
```

Use the note:

```tsx
“If you display the ready message on the glasses and click the ring/touch bar, 200×100 1-bit BMP will be transmitted.”
```

Change the QR script:

```json
"qr": "evenhub qr --url http://100.84.176.81:4173/diagnostic-v10"
```

- [ ] **Step 4: Run the app test and verify GREEN**

Run:

```powershell
npx vitest run src/App.test.tsx
```

Expected: all app tests passed.

### Task 4: Verify the complete v10 diagnostic

**Files:**
- Verify: `src/image-trigger.ts`
- Verify: `src/glasses.ts`
- Verify: `src/App.tsx`
- Verify: `package.json`

- [ ] **Step 1: Run all automated checks**

Run these independently:

```powershell
npm test
npm run typecheck
npm run build
```

Expected: zero failed tests, type checking exits 0, and Vite production build
exits 0.

- [ ] **Step 2: Verify the running server**

Request `http://127.0.0.1:4173/diagnostic-v10` and `/src/glasses.ts`.
Confirm one listener owns port 4173, the page is served, the source contains
`TEXT READY - CLICK TO SEND`, and the v10 hardware path does not call
`waitForPageReady(3000)`.

- [ ] **Step 3: Generate and scan the v10 QR**

Run:

```powershell
npm run qr
```

The command prints a QR code and exits by design. Keep the existing Vite
terminal running. On the glasses, wait for `TEXT READY - CLICK TO SEND`.
Single-click the R1 ring or touchbar exactly once.

- [ ] **Step 4: Classify the hardware result**

- Image appears: record startup-time automatic sending as the cause.
- `SENDFAILED`: record startup timing as rejected and design the WebView
  preload experiment.
- No response to click: capture event envelopes before changing image code.
