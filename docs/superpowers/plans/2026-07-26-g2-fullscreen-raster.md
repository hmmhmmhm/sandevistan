# G2 Fullscreen Raster Implementation Plan

> Historical plan. Its instructions and checkboxes do not establish current completion.
> See the [documentation index](../../index.md) for scope and evidence.
> The current main-only workflow supersedes historical branch and worktree instructions.
> Historical commit and publication steps require current owner authorization.

> **Legacy evidence:** Historical RELIC names, paths, storage keys, and
> transport identifiers in this record are preserved exactly as they appeared at
> the time. Current main-branch identifiers use Sandevistan.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan.

**Goal:** Display the Sandevistan HUD as 2×2 static tiles across the entire 576×288 G2 display. Use the proven 8-bit RGB PNG transmission path.

**Architecture:** Maintain diagnostic replicas of existing official image examples as dedicated hardware verification apps. Before the build, create four 288×144 PNGs from the original 576×288 HUD. The app creates one empty event capture layer and four image containers. After one user tap, the app sends the tiles serially in the order TL → TR → BL → BR. The app shows progress and errors only in the iPhone WebView.

**Tech Stack:** TypeScript, Vite 5, Vitest, `@evenrealities/even_hub_sdk` 0.0.10, EvenHub CLI, ffmpeg

---

## Work scope and path

Implementation working directory:

`C:\Users\haminlee\Documents\personal-agent\evenhub-templates-diagnostic\image`

HUD Original:

`C:\Users\haminlee\Documents\personal-agent\even-relic\docs\design\selected-peripheral-focus.png`

Design document:

`C:\Users\haminlee\Documents\personal-agent\even-relic\docs\superpowers\specs\2026-07-26-g2-fullscreen-raster-design.md`

There is no Git repository in the Sandevistan folder, and the diagnostic project is an experimental clone of the official repository. There is no commit or push during this hardware verification stage, so it does not affect the official remote repository.

### Task 1: Create four static 8-bit RGB tiles

**Files:**

- Create: `public/relic-tiles/relic-tl.png`
- Create: `public/relic-tiles/relic-tr.png`
- Create: `public/relic-tiles/relic-bl.png`
- Create: `public/relic-tiles/relic-br.png`
- Create: `scripts/verify-fullscreen-tiles.mjs`
- Modify: `package.json`

**Step 1: Write a tile inspection script first**

`scripts/verify-fullscreen-tiles.mjs`:

```js
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const files = [
  'public/relic-tiles/relic-tl.png',
  'public/relic-tiles/relic-tr.png',
  'public/relic-tiles/relic-bl.png',
  'public/relic-tiles/relic-br.png',
]

for (const file of files) {
  const png = readFileSync(file)
  assert.deepEqual(
    [...png.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
    `${file}: PNG signature`,
  )
  assert.equal(png.readUInt32BE(16), 288, `${file}: width`)
  assert.equal(png.readUInt32BE(20), 144, `${file}: height`)
  assert.equal(png[24], 8, `${file}: bit depth`)
  assert.equal(png[25], 2, `${file}: RGB color type`)
}

console.log('Verified 4 fullscreen tiles: 288x144, 8-bit RGB')
```

Add the following item to `scripts` in `package.json`.

```json
"verify:tiles": "node scripts/verify-fullscreen-tiles.mjs"
```

**Step 2: Check for test failure**

Run:

```powershell
npm run verify:tiles
```

Expected: Fails with `ENOENT` because there is no tile file yet.

**Step 3: Create the original HUD with four tiles**

Run:

```powershell
New-Item -ItemType Directory -Force public\relic-tiles
ffmpeg -y -i ..\..\even-relic\docs\design\selected-peripheral-focus.png -vf "scale=576:288,crop=288:144:0:0,format=rgb24" -frames:v 1 public\relic-tiles\relic-tl.png
ffmpeg -y -i ..\..\even-relic\docs\design\selected-peripheral-focus.png -vf "scale=576:288,crop=288:144:288:0,format=rgb24" -frames:v 1 public\relic-tiles\relic-tr.png
ffmpeg -y -i ..\..\even-relic\docs\design\selected-peripheral-focus.png -vf "scale=576:288,crop=288:144:0:144,format=rgb24" -frames:v 1 public\relic-tiles\relic-bl.png
ffmpeg -y -i ..\..\even-relic\docs\design\selected-peripheral-focus.png -vf "scale=576:288,crop=288:144:288:144,format=rgb24" -frames:v 1 public\relic-tiles\relic-br.png
```

Expected: Four PNGs are created in `public/relic-tiles`.

**Step 4: Pass the tile metadata check**

Run:

```powershell
npm run verify:tiles
```

Expected:

```text
Verified 4 fullscreen tiles: 288x144, 8-bit RGB
```

### Task 2: Test-driven writing of layout and serial transmission logic

**Files:**

- Create: `src/fullscreen.test.ts`
- Create: `src/fullscreen.ts`

**Step 1: Write a failing unit test**

`src/fullscreen.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  FULLSCREEN_TILES,
  createFullscreenPage,
  sendFullscreenTiles,
  type LoadedFullscreenTile,
} from './fullscreen'

function loadedTiles(): LoadedFullscreenTile[] {
  return FULLSCREEN_TILES.map(tile => ({
    ...tile,
    bytes: new Uint8Array([tile.containerID]),
  }))
}

describe('G2 fullscreen raster', () => {
  it('covers 576x288 with exactly four 288x144 images', () => {
    expect(FULLSCREEN_TILES).toEqual([
      {
        containerID: 2,
        containerName: 'relicTL',
        xPosition: 0,
        yPosition: 0,
        width: 288,
        height: 144,
        file: 'relic-tiles/relic-tl.png',
      },
      {
        containerID: 3,
        containerName: 'relicTR',
        xPosition: 288,
        yPosition: 0,
        width: 288,
        height: 144,
        file: 'relic-tiles/relic-tr.png',
      },
      {
        containerID: 4,
        containerName: 'relicBL',
        xPosition: 0,
        yPosition: 144,
        width: 288,
        height: 144,
        file: 'relic-tiles/relic-bl.png',
      },
      {
        containerID: 5,
        containerName: 'relicBR',
        xPosition: 288,
        yPosition: 144,
        width: 288,
        height: 144,
        file: 'relic-tiles/relic-br.png',
      },
    ])

    const page = createFullscreenPage()
    expect(page.containerTotalNum).toBe(5)
    expect(page.textObject).toHaveLength(1)
    expect(page.imageObject).toHaveLength(4)
  })

  it('sends TL, TR, BL, BR sequentially', async () => {
    const calls: string[] = []
    await sendFullscreenTiles(
      {
        updateImageRawData: async update => {
          calls.push(`SEND:${update.containerName}`)
          return 0
        },
      },
      loadedTiles(),
      status => calls.push(status),
    )

    expect(calls).toEqual([
      'relicTL SEND (1/4)',
      'SEND:relicTL',
      'relicTL RESULT: success (1/4)',
      'relicTR SEND (2/4)',
      'SEND:relicTR',
      'relicTR RESULT: success (2/4)',
      'relicBL SEND (3/4)',
      'SEND:relicBL',
      'relicBL RESULT: success (3/4)',
      'relicBR SEND (4/4)',
      'SEND:relicBR',
      'relicBR RESULT: success (4/4)',
    ])
  })

  it('stops immediately after the first failed tile', async () => {
    const sent: string[] = []
    await expect(sendFullscreenTiles(
      {
        updateImageRawData: async update => {
          sent.push(update.containerName ?? '')
          return sent.length === 2 ? 3 : 0
        },
      },
      loadedTiles(),
      () => undefined,
    )).rejects.toThrow('relicTR failed: sendFailed')

    expect(sent).toEqual(['relicTL', 'relicTR'])
  })
})
```

**Step 2: Check if the new test fails**

Run:

```powershell
npm test -- src/fullscreen.test.ts
```

Expected: Failed because the `./fullscreen` module could not be found.

**Step 3: Write a minimal implementation**

`src/fullscreen.ts`:

```ts
import {
  CreateStartUpPageContainer,
  ImageContainerProperty,
  ImageRawDataUpdate,
  ImageRawDataUpdateResult,
  TextContainerProperty,
} from '@evenrealities/even_hub_sdk'

export const FULLSCREEN_TILES = [
  {
    containerID: 2,
    containerName: 'relicTL',
    xPosition: 0,
    yPosition: 0,
    width: 288,
    height: 144,
    file: 'relic-tiles/relic-tl.png',
  },
  {
    containerID: 3,
    containerName: 'relicTR',
    xPosition: 288,
    yPosition: 0,
    width: 288,
    height: 144,
    file: 'relic-tiles/relic-tr.png',
  },
  {
    containerID: 4,
    containerName: 'relicBL',
    xPosition: 0,
    yPosition: 144,
    width: 288,
    height: 144,
    file: 'relic-tiles/relic-bl.png',
  },
  {
    containerID: 5,
    containerName: 'relicBR',
    xPosition: 288,
    yPosition: 144,
    width: 288,
    height: 144,
    file: 'relic-tiles/relic-br.png',
  },
] as const

export type LoadedFullscreenTile = typeof FULLSCREEN_TILES[number] & {
  bytes: Uint8Array
}

type ImageBridge = {
  updateImageRawData: (update: ImageRawDataUpdate) => Promise<unknown>
}

export function createFullscreenPage() {
  const eventLayer = new TextContainerProperty({
    xPosition: 0,
    yPosition: 0,
    width: 576,
    height: 288,
    borderWidth: 0,
    borderColor: 0,
    paddingLength: 0,
    containerID: 1,
    containerName: 'eventLayer',
    content: ' ',
    isEventCapture: 1,
  })
  const images = FULLSCREEN_TILES.map(tile => (
    new ImageContainerProperty(tile)
  ))
  return new CreateStartUpPageContainer({
    containerTotalNum: 5,
    textObject: [eventLayer],
    imageObject: images,
  })
}

export async function loadFullscreenTiles(
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<LoadedFullscreenTile[]> {
  return Promise.all(FULLSCREEN_TILES.map(async tile => {
    const response = await fetcher(`${baseUrl}${tile.file}`)
    if (!response.ok) {
      throw new Error(`${tile.containerName} HTTP ${response.status}`)
    }
    return {
      ...tile,
      bytes: new Uint8Array(await response.arrayBuffer()),
    }
  }))
}

export async function sendFullscreenTiles(
  bridge: ImageBridge,
  tiles: LoadedFullscreenTile[],
  report: (status: string) => void,
) {
  for (const [index, tile] of tiles.entries()) {
    const progress = `(${index + 1}/${tiles.length})`
    report(`${tile.containerName} SEND ${progress}`)
    const rawResult = await bridge.updateImageRawData(
      new ImageRawDataUpdate({
        containerID: tile.containerID,
        containerName: tile.containerName,
        imageData: tile.bytes,
      }),
    )
    const result = ImageRawDataUpdateResult.normalize(rawResult)
    report(`${tile.containerName} RESULT: ${result} ${progress}`)
    if (!ImageRawDataUpdateResult.isSuccess(result)) {
      throw new Error(`${tile.containerName} failed: ${result}`)
    }
  }
}
```

**Step 4: Pass the new unit test**

Run:

```powershell
npm test -- src/fullscreen.test.ts
```

Expected: 3 tests passed.

### Task 3: Link to the actual page that transfers four tiles with a single tap

**Files:**

- Modify: `src/main.ts`

**Step 1: Replace the existing diagnostic page with a full-screen transfer page**

`src/main.ts`:

```ts
import {
  OsEventTypeList,
  RebuildPageContainer,
  StartUpPageCreateResult,
  waitForEvenAppBridge,
} from '@evenrealities/even_hub_sdk'
import { getEventKind } from './diagnostic'
import {
  createFullscreenPage,
  loadFullscreenTiles,
  sendFullscreenTiles,
} from './fullscreen'

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <main style="margin:auto;padding:24px;max-width:640px;text-align:center;">
    <h1 style="font-size:18px;font-weight:600;margin:0 0 8px;">
      RELIC G2 FULLSCREEN
    </h1>
    <output id="status" style="display:block;color:#7cffb2;font:14px monospace;">
      CONNECTING
    </output>
    <p style="color:#919191;font-size:13px;margin:12px 0 0;">
      When you see READY, tap Glasses or R1 once. Double tap to quit.
    </p>
  </main>
`

const output = document.querySelector<HTMLOutputElement>('#status')!
function report(status: string) {
  output.textContent = status
  console.log(status)
}

const bridge = await waitForEvenAppBridge()
const page = createFullscreenPage()
const created = StartUpPageCreateResult.normalize(
  await bridge.createStartUpPageContainer(page),
)

if (created === StartUpPageCreateResult.invalid) {
  const rebuilt = await bridge.rebuildPageContainer(new RebuildPageContainer({
    containerTotalNum: page.containerTotalNum,
    textObject: page.textObject,
    imageObject: page.imageObject,
  }))
  if (!rebuilt) throw new Error('PAGE REBUILD FAILED')
} else if (created !== StartUpPageCreateResult.success) {
  throw new Error(`PAGE CREATE FAILED: ${created}`)
}

report('READY - TAP TO SEND')

let sending = false
let sent = false
let cleanedUp = false

async function sendOnce() {
  if (sending || sent) return
  sending = true
  try {
    report('LOADING 4 TILES')
    const tiles = await loadFullscreenTiles(import.meta.env.BASE_URL)
    await sendFullscreenTiles(bridge, tiles, report)
    sent = true
    report('FULLSCREEN RESULT: success')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    report(`FULLSCREEN RESULT: ${message}`)
    console.error(error)
  } finally {
    sending = false
  }
}

function cleanup() {
  if (cleanedUp) return
  cleanedUp = true
  unsubscribe()
}

const unsubscribe = bridge.onEvenHubEvent(event => {
  const kind = getEventKind(event)
  if (kind === 'double') {
    void bridge.shutDownPageContainer(1)
    return
  }
  if (kind === 'click') {
    void sendOnce()
    return
  }

  const sysType = event.sysEvent?.eventType ?? null
  if (
    sysType === OsEventTypeList.SYSTEM_EXIT_EVENT
    || sysType === OsEventTypeList.ABNORMAL_EXIT_EVENT
  ) {
    cleanup()
  }
})

window.addEventListener('beforeunload', cleanup)
```

**Step 2: Run full tests and build**

Run:

```powershell
npm test
npm run verify:tiles
npm run build
```

Expected:

- All 3 existing diagnostic tests and 3 full screen tests pass.
- Four PNG format checks pass.
- TypeScript inspection and Vite production build are successful.

### Task 4: Verify the actual G2 with new port and new QR

**Files:**

- Modify: `package.json`

**Step 1: Add a dedicated command to separate the cache**

Add the following item to `scripts` in `package.json`.

```json
"dev:fullscreen": "vite --host 0.0.0.0 --port 5178 --strictPort",
"qr:fullscreen": "evenhub qr --url http://100.84.176.81:5178 --external"
```

If the Tailscale address has changed, replace `100.84.176.81` with the result of `tailscale ip -4`.

**Step 2: Shut down only the existing 5177 development server**

Run:

```powershell
$listener = Get-NetTCPConnection -LocalPort 5177 -State Listen -ErrorAction SilentlyContinue
if ($listener) { Stop-Process -Id $listener.OwningProcess }
```

Expected: Only the 5177 diagnostic server will be terminated, and the 4173 Sandevistan server and 5174 official origin server will remain as is.

**Step 3: Run the 5178 server**

Run:

```powershell
npm run dev:fullscreen
```

Expected: Vite continues to run, displaying `http://localhost:5178` and the Tailscale access address.

**Step 4: Create QR in a separate terminal**

Run:

```powershell
npm run qr:fullscreen
```

Expected: A QR to scan will be displayed in the iPhone Even app.

**Step 5: Verify with actual glasses**

1. Close the existing Sandevistan/Diagnostic EvenHub app on the glasses.
2. Scan the new QR with the iPhone Even app.
3. Wait until ‘READY - TAP TO SEND’ appears on the iPhone screen.
4. Tap once on Glasses or R1.
5. On iPhone, check whether the results of `relicTL`, `relicTR`, `relicBL`, and `relicBR` are all `success`.
6. Check whether the HUD appears continuously throughout the 576×288 area of ​​the glasses.
7. Record seams, cuts, brightness, legibility, and peripheral vision obstruction.

Expected final phone status:

```text
FULLSCREEN RESULT: success
```

If it fails, the initial failure tile displayed on the iPhone and the results (`imageException`, `imageSizeInvalid`, `sendFailed`) are recorded as is. Subsequent tiles should not be transmitted.

## Final Verification Checklist

- [ ] Each PNG is 288×144, 8-bit RGB.
- [ ] The SDK upper limit of image containers is exactly four.
- [ ] The total number of containers is five, including the empty event capture text layer.
- [ ] Tap once to start the transfer.
- [ ] A second single tap does not send the tiles again.
- [ ] The order of TL→TR→BL→BR is maintained in series.
- [ ] Transmission stops after the first failure.
- [ ] Tap twice to end.
- [ ] Test, tile inspection, and production build all pass.
- [ ] Only one server listens on port 5178.
- [ ] In the actual G2, you can see the HUD that fills the entire screen.
