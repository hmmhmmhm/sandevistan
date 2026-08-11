// @vitest-environment jsdom
import {
  AudioInputSource,
  DeviceInfo,
  DeviceModel,
  DeviceStatus,
  OsEventTypeList,
  type EvenHubEvent,
} from "@evenrealities/even_hub_sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { diagnosticLogger } from "./diagnostic-log";
import { TRANSPORT_STATUS } from "./transport-status";

async function loadGlasses() {
  const module = await import("./glasses").catch(() => null);
  expect(module).not.toBeNull();
  return module;
}

type TestRefreshTarget = "left" | "right" | "right-top" | "all";
type TestInput =
  | "tap"
  | "double-tap"
  | "scroll-next"
  | "scroll-previous";
type TestInputResult = "unhandled" | "consume" | "redraw";
type TestNativeTextController = {
  active(): boolean;
  enter(content: string): Promise<boolean>;
  update(content: string): Promise<boolean>;
  enterConversate?(content: { inform: string; body: string }): Promise<boolean>;
  updateConversate?(
    content: { inform: string; body: string },
    priority?: "analysis" | "transcript" | "input",
  ): Promise<boolean>;
  restore(): Promise<boolean>;
};
type TestRawEvent = {
  readonly count: number;
  readonly hidden: boolean;
  readonly sysEventType?: OsEventTypeList;
  readonly textEventType?: OsEventTypeList;
  readonly eventSource?: number;
};
type FastRefreshHarnessConfig = {
  readonly beforeExternalRefresh?: () => void | Promise<void>;
  readonly beforeRestore?: () => void | Promise<void>;
  readonly displayHideStrategy?: "black-tiles" | "blank-rebuild";
  readonly imageSendConcurrency?: 1 | 2 | 3 | 4;
  readonly getFullRefreshTiles?: () => readonly {
    readonly id: number;
    readonly name: string;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }[];
  readonly tileImageFormat?: "png" | "bmp-1";
  readonly tilePaletteMode?: "original" | "hud-4";
  readonly encode?: (
    ids: number[],
    attempt: number,
    source: "hud" | "black",
  ) => Promise<Uint8Array[]>;
  readonly update?: (
    id: number,
    call: number,
    encodeAttempt: number,
  ) => Promise<unknown>;
  readonly inputResult?: TestInputResult;
  readonly navigate?: (
    direction: "next" | "previous",
  ) => void | Promise<void>;
  readonly rebuild?: (
    page: Record<string, unknown>,
    call: number,
  ) => boolean | Promise<boolean>;
  readonly waitForPageReady?: (
    milliseconds: number,
  ) => void | Promise<void>;
};

function deferred() {
  let resolve!: () => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<void>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, reject, resolve };
}

async function createFastRefreshHarness(
  config: FastRefreshHarnessConfig = {},
) {
  const module = await loadGlasses();
  if (!module) throw new Error("glasses module unavailable");

  const hudSource = { name: "hud" } as unknown as HTMLCanvasElement;
  const blackSource = { name: "black" } as unknown as HTMLCanvasElement;
  const encodedTileIds: number[][] = [];
  const encodedImageFormats: Array<"png" | "bmp-1" | undefined> = [];
  const encodedPaletteModes: Array<"original" | "hud-4" | undefined> = [];
  const encodedSources: Array<"hud" | "black"> = [];
  const imageIds: number[] = [];
  const inputs: TestInput[] = [];
  const progress: string[] = [];
  const rawEvents: TestRawEvent[] = [];
  const rebuiltPages: Record<string, unknown>[] = [];
  const textContents: string[] = [];
  const transitionEvents: string[] = [];
  let activeImageSends = 0;
  let maximumActiveImageSends = 0;
  let currentEncodeAttempt = 0;
  let refreshRequest: ((target: TestRefreshTarget) => void) | undefined;
  let listener: ((event: EvenHubEvent) => void) | undefined;
  let nativeTextController: TestNativeTextController | undefined;
  let sdkUnsubscribeCalls = 0;
  let inputResult = config.inputResult ?? "unhandled";

  const bridge = {
    createStartUpPageContainer: async () => 0,
    rebuildPageContainer: async (page: {
      toJson?: () => Record<string, unknown>;
    }) => {
      const serialized: Record<string, unknown> = page.toJson?.()
        ?? page as Record<string, unknown>;
      rebuiltPages.push(serialized);
      if (serialized.containerTotalNum === 5) {
        transitionEvents.push("rebuild:image");
      } else if (
        serialized.containerTotalNum === 1
        && Array.isArray(serialized.textObject)
        && serialized.textObject[0]?.containerName === "eventLayer"
      ) {
        transitionEvents.push("rebuild:neutral");
      }
      return await (config.rebuild?.(serialized, rebuiltPages.length) ?? true);
    },
    updateImageRawData: async (update: { containerID?: number }) => {
      const id = update.containerID!;
      imageIds.push(id);
      transitionEvents.push(`image:${id}`);
      activeImageSends += 1;
      maximumActiveImageSends = Math.max(
        maximumActiveImageSends,
        activeImageSends,
      );
      try {
        return await (config.update?.(
          id,
          imageIds.length,
          currentEncodeAttempt,
        ) ?? "success");
      } finally {
        activeImageSends -= 1;
      }
    },
    textContainerUpgrade: async (update: {
      content?: string;
    }) => {
      textContents.push(update.content ?? "");
      return true;
    },
    onEvenHubEvent: (next: (event: EvenHubEvent) => void) => {
      listener = next;
      return () => {
        sdkUnsubscribeCalls += 1;
      };
    },
    shutDownPageContainer: async () => true,
  };
  const transmitFastCanvas = module.transmitFastCanvas as unknown as (
    source: HTMLCanvasElement,
    onProgress: (message: string) => void,
    onNavigate: (direction: "next" | "previous") => void | Promise<void>,
    options: {
      beforeExternalRefresh?: () => void | Promise<void>;
      beforeRestore?: () => void | Promise<void>;
      createHiddenSource: () => HTMLCanvasElement;
      dependencies: {
        waitForBridge: () => Promise<typeof bridge>;
        waitForPageReady?: (milliseconds: number) => Promise<void>;
        encode: (
          source: HTMLCanvasElement,
          factory?: unknown,
          tiles?: readonly { id: number }[],
          options?: {
            readonly format?: "png" | "bmp-1";
            readonly paletteMode?: "original" | "hud-4";
          },
        ) => Promise<Uint8Array[]>;
      };
      displayHideStrategy?: "black-tiles" | "blank-rebuild";
      imageSendConcurrency?: 1 | 2 | 3 | 4;
      getFullRefreshTiles?: () => readonly { id: number }[];
      tileImageFormat?: "png" | "bmp-1";
      tilePaletteMode?: "original" | "hud-4";
      onRefreshReady: (
        request: (target: TestRefreshTarget) => void,
      ) => void;
      onInput?: (input: TestInput) => TestInputResult;
      now?: () => number;
      onDisplayCommitted?: (minute: number) => void;
      onRawEvent?: (event: TestRawEvent) => void;
      onNativeTextReady?: (controller: TestNativeTextController) => void;
    },
  ) => Promise<() => void>;
  const committedMinutes: number[] = [];

  const cleanup = await transmitFastCanvas(
    hudSource,
    (message) => progress.push(message),
    async (direction) => config.navigate?.(direction),
    {
      beforeExternalRefresh: config.beforeExternalRefresh,
      beforeRestore: config.beforeRestore,
      getFullRefreshTiles: config.getFullRefreshTiles,
      createHiddenSource: () => blackSource,
      dependencies: {
        waitForBridge: async () => bridge,
        waitForPageReady: async (milliseconds) => {
          transitionEvents.push(`wait:${milliseconds}`);
          await config.waitForPageReady?.(milliseconds);
        },
        encode: async (
          source,
          _factory,
          tiles = module.G2_TILES,
          options,
        ) => {
          const ids = tiles.map(({ id }) => id);
          transitionEvents.push(`encode:${ids.join(",")}`);
          const sourceName = source === blackSource ? "black" : "hud";
          encodedTileIds.push(ids);
          encodedImageFormats.push(options?.format);
          encodedPaletteModes.push(options?.paletteMode);
          encodedSources.push(sourceName);
          currentEncodeAttempt = encodedTileIds.length;
          return config.encode?.(
            ids,
            currentEncodeAttempt,
            sourceName,
          ) ?? ids.map((id) => new Uint8Array([id, currentEncodeAttempt]));
        },
      },
      displayHideStrategy: config.displayHideStrategy,
      imageSendConcurrency: config.imageSendConcurrency,
      tileImageFormat: config.tileImageFormat,
      tilePaletteMode: config.tilePaletteMode,
      onInput: (input) => {
        inputs.push(input);
        return inputResult;
      },
      now: () => 1_234 * 60_000,
      onDisplayCommitted: (minute) => committedMinutes.push(minute),
      onRawEvent: (event) => rawEvents.push(event),
      onNativeTextReady: (controller) => {
        nativeTextController = controller;
      },
      onRefreshReady: (request) => {
        refreshRequest = request;
      },
    },
  );

  expect(refreshRequest).toBeTypeOf("function");
  expect(listener).toBeTypeOf("function");
  if (!refreshRequest || !listener) {
    throw new Error("fast refresh harness did not become ready");
  }
  expect(nativeTextController).toBeTypeOf("object");
  if (!nativeTextController) {
    throw new Error("native text controller did not become ready");
  }
  return {
    cleanup,
    committedMinutes,
    encodedImageFormats,
    encodedPaletteModes,
    encodedTileIds,
    encodedSources,
    emit: (eventType: OsEventTypeList) => listener!({
      sysEvent: { eventType },
    } as EvenHubEvent),
    emitEvent: (event: EvenHubEvent) => listener!(event),
    get maximumActiveImageSends() {
      return maximumActiveImageSends;
    },
    imageIds,
    inputs,
    nativeText: nativeTextController,
    progress,
    rawEvents,
    rebuiltPages,
    request: refreshRequest,
    setInputResult: (result: TestInputResult) => {
      inputResult = result;
    },
    textContents,
    transitionEvents,
    get sdkUnsubscribeCalls() {
      return sdkUnsubscribeCalls;
    },
  };
}

afterEach(() => vi.useRealTimers());

describe("G2 raster transport", () => {
  it("starts the initial raster frame without a general page-settle delay", async () => {
    const harness = await createFastRefreshHarness();

    expect(harness.transitionEvents.slice(0, 5)).toEqual([
      "encode:3,5,2,4",
      "image:3",
      "image:5",
      "image:2",
      "image:4",
    ]);
  });

  it("neutralizes native AI text before restoring the binocular Canvas page", async () => {
    const harness = await createFastRefreshHarness();
    const initialEncodeCount = harness.encodedTileIds.length;
    const initialImageCount = harness.imageIds.length;

    expect(await harness.nativeText.enter("ASK AI // READY")).toBe(true);
    expect(harness.nativeText.active()).toBe(true);
    expect(await harness.nativeText.update("ASK AI // LISTENING")).toBe(true);
    harness.request("right");
    await Promise.resolve();

    expect(harness.encodedTileIds).toHaveLength(initialEncodeCount);
    expect(harness.imageIds).toHaveLength(initialImageCount);
    expect(harness.textContents).toEqual(["ASK AI // LISTENING"]);

    const transitionStart = harness.transitionEvents.length;
    expect(await harness.nativeText.restore()).toBe(true);
    expect(harness.nativeText.active()).toBe(false);
    expect(harness.rebuiltPages).toHaveLength(3);
    expect(harness.rebuiltPages[0]).toMatchObject({ containerTotalNum: 1 });
    expect(harness.rebuiltPages[1]).toMatchObject({
      containerTotalNum: 1,
      textObject: [expect.objectContaining({
        containerName: "eventLayer",
        content: " ",
      })],
    });
    expect(harness.rebuiltPages[2]).toMatchObject({ containerTotalNum: 5 });
    expect(harness.encodedTileIds).toHaveLength(initialEncodeCount + 1);
    expect(harness.imageIds).toHaveLength(initialImageCount + 4);
    expect(harness.transitionEvents.slice(transitionStart)).toEqual([
      "rebuild:neutral",
      "wait:1000",
      "rebuild:image",
      "wait:200",
      "encode:3,5,2,4",
      "image:3",
      "image:5",
      "image:2",
      "image:4",
    ]);
  });

  it("restores Conversate without the Ask AI neutral-page delay", async () => {
    const harness = await createFastRefreshHarness();

    expect(await harness.nativeText.enterConversate?.({
      inform: "",
      body: "Live transcript",
    })).toBe(true);
    const transitionStart = harness.transitionEvents.length;
    expect(await harness.nativeText.restore()).toBe(true);

    expect(harness.transitionEvents.slice(transitionStart)).toEqual([
      "rebuild:image",
      "wait:200",
      "encode:3,5,2,4",
      "image:3",
      "image:5",
      "image:2",
      "image:4",
    ]);
  });

  it("keeps native AI active when its neutral page rebuild fails", async () => {
    const harness = await createFastRefreshHarness({
      rebuild: async (_page, call) => call !== 2,
    });
    const initialEncodeCount = harness.encodedTileIds.length;
    const initialImageCount = harness.imageIds.length;

    expect(await harness.nativeText.enter("ASK AI // READY")).toBe(true);
    expect(await harness.nativeText.restore()).toBe(false);

    expect(harness.nativeText.active()).toBe(true);
    expect(harness.rebuiltPages).toHaveLength(2);
    expect(harness.encodedTileIds).toHaveLength(initialEncodeCount);
    expect(harness.imageIds).toHaveLength(initialImageCount);
  });

  it("does not send tiles when the image page rebuild fails after neutralizing AI", async () => {
    const harness = await createFastRefreshHarness({
      rebuild: async (_page, call) => call !== 3,
    });
    const initialEncodeCount = harness.encodedTileIds.length;
    const initialImageCount = harness.imageIds.length;

    expect(await harness.nativeText.enter("ASK AI // READY")).toBe(true);
    expect(await harness.nativeText.restore()).toBe(false);

    expect(harness.nativeText.active()).toBe(true);
    expect(harness.rebuiltPages).toHaveLength(3);
    expect(harness.encodedTileIds).toHaveLength(initialEncodeCount);
    expect(harness.imageIds).toHaveLength(initialImageCount);
  });

  it("drops late native text updates throughout the binocular restore", async () => {
    const pageReady = deferred();
    const waits: number[] = [];
    const harness = await createFastRefreshHarness({
      waitForPageReady: async (milliseconds) => {
        waits.push(milliseconds);
        await pageReady.promise;
      },
    });

    expect(await harness.nativeText.enter("ASK AI // READY")).toBe(true);
    const restoring = harness.nativeText.restore();
    await vi.waitFor(() => (
      expect(harness.transitionEvents).toContain("wait:1000")
    ));
    const initialTextCount = harness.textContents.length;

    expect(await harness.nativeText.update("LATE AI FRAME")).toBe(false);
    expect(harness.textContents).toHaveLength(initialTextCount);

    pageReady.resolve();
    expect(await restoring).toBe(true);
    expect(waits).toEqual([1_000, 200]);
  });

  it("covers the 576 by 288 display with four ordered tiles", async () => {
    const module = await loadGlasses();
    if (!module) return;

    expect(module.G2_TILES).toEqual([
      { id: 2, name: "sandevistanTL", x: 0, y: 0, width: 288, height: 144 },
      { id: 3, name: "sandevistanTR", x: 288, y: 0, width: 288, height: 144 },
      { id: 4, name: "sandevistanBL", x: 0, y: 144, width: 288, height: 144 },
      { id: 5, name: "sandevistanBR", x: 288, y: 144, width: 288, height: 144 },
    ]);
  });

  it("keeps generic tiles row-major while fast full transfers start on the right", async () => {
    const module = await loadGlasses();
    if (!module) return;

    expect(module.G2_TILES.map(({ id }) => id)).toEqual([2, 3, 4, 5]);
    expect(module.G2_FAST_TILES?.map(({ id }) => id)).toEqual([3, 5, 2, 4]);
    expect(module.G2_TEXT_FIRST_TILES?.map(({ id }) => id)).toEqual([3, 2, 5, 4]);
    expect(module.G2_LEFT_TILES?.map(({ id }) => id)).toEqual([2, 4]);
    expect(module.G2_RIGHT_TILES.map(({ id }) => id)).toEqual([3, 5]);
    expect(module.G2_RIGHT_TOP_TILES?.map(({ id }) => id)).toEqual([3]);
  });

  it("uses top-row-first tiles for text-priority full refreshes", async () => {
    const module = await loadGlasses();
    if (!module?.G2_TEXT_FIRST_TILES) return;

    const harness = await createFastRefreshHarness({
      getFullRefreshTiles: () => module.G2_TEXT_FIRST_TILES!,
    });
    expect(harness.encodedTileIds).toEqual([[3, 2, 5, 4]]);

    harness.request("all");
    await vi.waitFor(() => expect(harness.encodedTileIds).toEqual([
      [3, 2, 5, 4],
      [3, 2, 5, 4],
    ]));
  });

  it("builds four image containers plus one blank event layer", async () => {
    const module = await loadGlasses();
    if (!module) return;

    const page = module.createGlassesPage();
    expect(page.containerTotalNum).toBe(5);
    expect(page.textObject).toHaveLength(1);
    expect(page.textObject?.[0].content).toBe(" ");
    expect(page.textObject?.[0].isEventCapture).toBe(1);
    expect(page.imageObject?.map(({ containerID }) => containerID)).toEqual([2, 3, 4, 5]);
  });

  it("serializes explicit unique z-order with Text above every image", async () => {
    const module = await loadGlasses();
    if (!module) return;
    const createLayeredGlassesPage = (
      module as unknown as {
        createLayeredGlassesPage?: () => {
          toJson: () => {
            textObject?: Array<{
              xPosition?: number;
              yPosition?: number;
              width?: number;
              height?: number;
              paddingLength?: number;
              zOrderIndex?: number;
            }>;
            imageObject?: Array<{ zOrderIndex?: number }>;
          };
        };
      }
    ).createLayeredGlassesPage;
    expect(createLayeredGlassesPage).toBeTypeOf("function");
    if (!createLayeredGlassesPage) return;

    const legacy = module.createGlassesPage().toJson();
    const layered = createLayeredGlassesPage().toJson();
    expect([
      ...legacy.imageObject!.map(
        ({ zOrderIndex }: { zOrderIndex?: number }) => zOrderIndex,
      ),
      legacy.textObject![0].zOrderIndex,
    ]).toEqual([undefined, undefined, undefined, undefined, undefined]);
    expect(layered.imageObject?.map(({ zOrderIndex }) => zOrderIndex)).toEqual([
      1,
      2,
      3,
      4,
    ]);
    expect(layered.textObject?.[0]).toMatchObject({
      xPosition: 196,
      yPosition: 8,
      width: 372,
      height: 272,
      paddingLength: 8,
      zOrderIndex: 5,
    });
  });

  it("builds the official-size single-image diagnostic page", async () => {
    const module = await loadGlasses();
    if (!module) return;

    const page = module.createGlassesPage(module.DIAGNOSTIC_TILES);
    expect(page.containerTotalNum).toBe(2);
    expect(page.textObject).toHaveLength(1);
    expect(page.imageObject).toHaveLength(1);
    expect(page.imageObject?.[0]).toMatchObject({
      containerID: 2,
      containerName: "frame",
      xPosition: 0,
      yPosition: 0,
      width: 200,
      height: 100,
    });
  });

  it("matches the official image template page exactly", async () => {
    const module = await loadGlasses();
    if (!module) return;

    const page = module.createOfficialDiagnosticPage();
    expect(page.containerTotalNum).toBe(3);
    expect(page.textObject?.map(({ containerID }) => containerID)).toEqual([1, 2]);
    expect(page.imageObject?.[0]).toMatchObject({
      containerID: 3,
      containerName: "frame",
      xPosition: 188,
      yPosition: 40,
      width: 200,
      height: 100,
    });
  });

  it("encodes each display quadrant as an individual PNG", async () => {
    const module = await loadGlasses();
    if (!module) return;

    const crops: number[][] = [];
    const canvasFactory = () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: (...args: unknown[]) => crops.push(args.slice(1, 5) as number[]),
      }),
      toBlob: (done: BlobCallback) => done(new Blob(["tile"], { type: "image/png" })),
    }) as unknown as HTMLCanvasElement;

    const tiles = await module.encodeCanvasTiles(
      {} as HTMLCanvasElement,
      canvasFactory,
    );

    expect(tiles).toHaveLength(4);
    expect(crops).toEqual([
      [0, 0, 288, 144],
      [288, 0, 288, 144],
      [0, 144, 288, 144],
      [288, 144, 288, 144],
    ]);
    expect(tiles.every((tile) => tile.byteLength > 0)).toBe(true);
  });

  it("quantizes only the temporary encoded tile when enabled", async () => {
    const module = await loadGlasses();
    if (!module) return;

    const tilePixels = new Uint8ClampedArray([96, 96, 96, 80]);
    const tileSnapshot = tilePixels.slice();
    const written: Uint8ClampedArray[] = [];
    const canvasFactory = () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: () => undefined,
        getImageData: () => ({
          data: tilePixels.slice(),
        }),
        putImageData: (image: { data: Uint8ClampedArray }) => {
          written.push(image.data.slice());
        },
      }),
      toBlob: (done: BlobCallback) => {
        done(new Blob(["tile"], { type: "image/png" }));
      },
    }) as unknown as HTMLCanvasElement;

    const tiles = await module.encodeCanvasTiles(
      {} as HTMLCanvasElement,
      canvasFactory,
      [module.G2_TILES[0]],
      { paletteMode: "hud-4" },
    );

    expect(tiles).toHaveLength(1);
    expect([...written[0]]).toEqual([128, 128, 128, 255]);
    expect(tilePixels).toEqual(tileSnapshot);
  });

  it("encodes one full G2 tile as a 1-bit BMP when selected", async () => {
    const module = await loadGlasses();
    if (!module) return;

    const width = 288;
    const height = 144;
    const pixels = new Uint8ClampedArray(width * height * 4);
    pixels.set([255, 255, 255, 255]);
    const canvasFactory = () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: () => undefined,
        getImageData: () => ({ data: pixels.slice() }),
        putImageData: () => undefined,
      }),
      toBlob: () => {
        throw new Error("BMP mode must not invoke PNG encoding");
      },
    }) as unknown as HTMLCanvasElement;

    const [bmp] = await module.encodeCanvasTiles(
      {} as HTMLCanvasElement,
      canvasFactory,
      [module.G2_TILES[0]],
      { format: "bmp-1", paletteMode: "hud-4" },
    );
    const view = new DataView(bmp.buffer, bmp.byteOffset, bmp.byteLength);

    expect(Array.from(bmp.slice(0, 2))).toEqual([0x42, 0x4d]);
    expect(view.getUint32(10, true)).toBe(62);
    expect(view.getInt32(18, true)).toBe(width);
    expect(view.getInt32(22, true)).toBe(height);
    expect(view.getUint16(28, true)).toBe(1);
    expect(bmp.byteLength).toBe(62 + 36 * height);
  });

  it("creates a full-size black Canvas for hidden display pixels", async () => {
    const module = await loadGlasses();
    if (!module) return;
    const createBlackCanvas = (
      module as unknown as {
        createBlackCanvas?: (
          factory: () => HTMLCanvasElement,
        ) => HTMLCanvasElement;
      }
    ).createBlackCanvas;
    expect(createBlackCanvas).toBeTypeOf("function");
    if (!createBlackCanvas) return;

    let fillStyle = "";
    const fills: number[][] = [];
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        get fillStyle() {
          return fillStyle;
        },
        set fillStyle(value: string | CanvasGradient | CanvasPattern) {
          fillStyle = String(value);
        },
        fillRect: (...args: number[]) => fills.push(args),
      }),
    } as unknown as HTMLCanvasElement;

    expect(createBlackCanvas(() => canvas)).toBe(canvas);
    expect(canvas.width).toBe(576);
    expect(canvas.height).toBe(288);
    expect(fillStyle).toBe("#000000");
    expect(fills).toEqual([[0, 0, 576, 288]]);
  });

  it("draws the selected reference into the exact G2 canvas", async () => {
    const module = await loadGlasses();
    if (!module) return;

    const drawCalls: unknown[][] = [];
    let writtenPixels: Uint8ClampedArray | undefined;
    const pixels = new Uint8ClampedArray([2, 5, 2, 255]);
    const context = {
      fillRect: () => undefined,
      drawImage: (...args: unknown[]) => drawCalls.push(args),
      getImageData: () => ({ data: pixels }),
      putImageData: (imageData: { data: Uint8ClampedArray }) => {
        writtenPixels = imageData.data;
      },
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => context,
    } as unknown as HTMLCanvasElement;
    const image = {} as CanvasImageSource;

    await module.drawHudReference(canvas, "/reference.png", async () => image);

    expect(canvas.width).toBe(576);
    expect(canvas.height).toBe(288);
    expect(drawCalls).toEqual([[image, 0, 0, 576, 288]]);
    expect(writtenPixels).toEqual(new Uint8ClampedArray([0, 0, 0, 255]));
  });

  it("removes near-black noise and emits only 16-level grayscale", async () => {
    const module = await loadGlasses();
    if (!module) return;

    const pixels = new Uint8ClampedArray([
      2, 5, 2, 200,
      20, 20, 20, 255,
      10, 23, 10, 255,
      10, 25, 10, 255,
      50, 100, 40, 255,
    ]);

    expect(module.quantizeForG2Pixels(pixels)).toEqual(new Uint8ClampedArray([
      0, 0, 0, 255,
      0, 0, 0, 255,
      0, 0, 0, 255,
      17, 17, 17, 255,
      102, 102, 102, 255,
    ]));
  });

  it("sends BLE image updates strictly one at a time", async () => {
    const module = await loadGlasses();
    if (!module) return;

    let active = 0;
    let maximumActive = 0;
    const order: number[] = [];
    const tiles = [new Uint8Array([1]), new Uint8Array([2]), new Uint8Array([3])];

    await module.sendTilesSequentially(tiles, async (_bytes, index) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await Promise.resolve();
      order.push(index);
      active -= 1;
    });

    expect(maximumActive).toBe(1);
    expect(order).toEqual([0, 1, 2]);
  });

  it("encodes a container-sized 1-bit BMP for the proven hardware path", async () => {
    const module = await loadGlasses();
    if (!module) return;

    const width = 200;
    const height = 100;
    const pixels = new Uint8Array(width * height);
    pixels[0] = 1;
    const bmp = module.encode1BitBmp(width, height, pixels);
    const view = new DataView(bmp.buffer, bmp.byteOffset, bmp.byteLength);

    expect(Array.from(bmp.slice(0, 2))).toEqual([0x42, 0x4d]);
    expect(view.getUint32(10, true)).toBe(62);
    expect(view.getInt32(18, true)).toBe(width);
    expect(view.getInt32(22, true)).toBe(height);
    expect(view.getUint16(28, true)).toBe(1);
    expect(bmp.byteLength).toBe(2862);
    expect(bmp[62 + 99 * 28]).toBe(0x80);
  });

  it("creates the page before transmitting all four tiles", async () => {
    const module = await loadGlasses();
    if (!module) return;

    const calls: string[] = [];
    const bridge = {
      createStartUpPageContainer: async () => {
        calls.push("create");
        return 0;
      },
      updateImageRawData: async (update: { containerID?: number }) => {
        calls.push(`image:${update.containerID}`);
        return "success";
      },
      rebuildPageContainer: async () => true,
      onEvenHubEvent: () => () => undefined,
      shutDownPageContainer: async () => true,
    };

    await module.transmitCanvas(
      {} as HTMLCanvasElement,
      () => undefined,
      {
        waitForBridge: async () => bridge,
        encode: async () => module.G2_TILES.map(({ id }) => new Uint8Array([id])),
      },
    );

    expect(calls).toEqual(["create", "image:2", "image:3", "image:4", "image:5"]);
  });

  it("starts fast Canvas with four tiles and scrolls with the right two", async () => {
    const module = await loadGlasses();
    if (!module) return;
    const transmitFastCanvas = (
      module as unknown as {
        transmitFastCanvas?: (...args: unknown[]) => Promise<() => void>;
      }
    ).transmitFastCanvas;
    expect(module.G2_RIGHT_TILES?.map(({ id }) => id)).toEqual([3, 5]);
    expect(transmitFastCanvas).toBeTypeOf("function");
    if (!transmitFastCanvas) return;

    let listener: ((event: EvenHubEvent) => void) | undefined;
    const encodedTileIds: number[][] = [];
    const encodedPaletteModes: Array<"original" | "hud-4" | undefined> = [];
    const imageIds: number[] = [];
    const order: string[] = [];
    const batteries: unknown[] = [];
    const bridge = {
      getDeviceInfo: async () => {
        order.push("device");
        return {
          model: DeviceModel.G2,
          status: {
            batteryLevel: 82,
            isCharging: true,
          },
        };
      },
      createStartUpPageContainer: async () => 0,
      rebuildPageContainer: async () => true,
      updateImageRawData: async (update: { containerID?: number }) => {
        imageIds.push(update.containerID!);
        return "success";
      },
      onEvenHubEvent: (next: (event: EvenHubEvent) => void) => {
        listener = next;
        return () => undefined;
      },
      shutDownPageContainer: async () => true,
    };

    await transmitFastCanvas(
      {} as HTMLCanvasElement,
      () => undefined,
      async () => undefined,
      {
        dependencies: {
          waitForBridge: async () => bridge,
          encode: async (
            _source: HTMLCanvasElement,
            _factory: unknown,
            tiles = module.G2_TILES,
            options?: {
              readonly paletteMode?: "original" | "hud-4";
            },
          ) => {
            order.push("encode");
            encodedTileIds.push(tiles.map(({ id }) => id));
            encodedPaletteModes.push(options?.paletteMode);
            return tiles.map(({ id }) => new Uint8Array([
              id,
              encodedTileIds.length,
            ]));
          },
        },
        onBattery: (battery: unknown) => batteries.push(battery),
        tilePaletteMode: "hud-4",
      },
    );
    listener!({
      sysEvent: { eventType: OsEventTypeList.SCROLL_BOTTOM_EVENT },
    } as EvenHubEvent);
    await vi.waitFor(() => expect(imageIds).toHaveLength(6));

    expect(encodedTileIds).toEqual([[3, 5, 2, 4], [3, 5]]);
    expect(encodedPaletteModes).toEqual(["hud-4", "hud-4"]);
    expect(imageIds).toEqual([3, 5, 2, 4, 3, 5]);
    expect(order.indexOf("device")).toBeLessThan(order.indexOf("encode"));
    expect(batteries).toEqual([{
      label: "G2",
      level: 82,
      charging: true,
    }]);
  });

  it("emits only changed matching device status and unsubscribes on cleanup", async () => {
    const module = await loadGlasses();
    if (!module) return;

    let deviceListener: ((status: DeviceStatus) => void) | undefined;
    let deviceUnsubscribeCalls = 0;
    const batteries: unknown[] = [];
    const bridge = {
      getDeviceInfo: async () => new DeviceInfo({
        model: DeviceModel.G2,
        sn: "g2-one",
        status: new DeviceStatus({
          sn: "g2-one",
          batteryLevel: 82,
          isCharging: false,
        }),
      }),
      createStartUpPageContainer: async () => 0,
      rebuildPageContainer: async () => true,
      updateImageRawData: async () => "success",
      onDeviceStatusChanged: (listener: (status: DeviceStatus) => void) => {
        deviceListener = listener;
        return () => {
          deviceUnsubscribeCalls += 1;
        };
      },
      onEvenHubEvent: () => () => undefined,
      shutDownPageContainer: async () => true,
    };

    const cleanup = await module.transmitFastCanvas(
      {} as HTMLCanvasElement,
      () => undefined,
      async () => undefined,
      {
        dependencies: {
          waitForBridge: async () => bridge,
          encode: async (
            _source: HTMLCanvasElement,
            _factory: unknown,
            tiles = module.G2_TILES,
          ) => tiles.map(({ id }) => new Uint8Array([id])),
        },
        onBattery: (battery) => batteries.push(battery),
      },
    );

    deviceListener?.(new DeviceStatus({
      sn: "g2-one",
      batteryLevel: 82,
      isCharging: false,
    }));
    deviceListener?.(new DeviceStatus({
      sn: "other",
      batteryLevel: 81,
      isCharging: false,
    }));
    deviceListener?.(new DeviceStatus({
      sn: "g2-one",
      batteryLevel: 81,
      isCharging: false,
    }));
    deviceListener?.(new DeviceStatus({
      sn: "g2-one",
      batteryLevel: 81,
      isCharging: true,
    }));

    expect(batteries).toEqual([
      { label: "G2", level: 82, charging: false },
      { label: "G2", level: 81, charging: false },
      { label: "G2", level: 81, charging: true },
    ]);
    cleanup();
    cleanup();
    deviceListener?.(new DeviceStatus({
      sn: "g2-one",
      batteryLevel: 79,
      isCharging: true,
    }));
    expect(batteries).toHaveLength(3);
    expect(deviceUnsubscribeCalls).toBe(1);
  });

  it("queues a synchronous refresh behind the active request", async () => {
    const harness = await createFastRefreshHarness();

    harness.request("left");
    harness.request("right");
    await vi.waitFor(() => expect(harness.imageIds).toHaveLength(8));
    await Promise.resolve();

    expect(harness.encodedTileIds).toEqual([
      [3, 5, 2, 4],
      [2, 4],
      [3, 5],
    ]);
    expect(harness.imageIds).toEqual([3, 5, 2, 4, 2, 4, 3, 5]);
    expect(harness.maximumActiveImageSends).toBe(1);
  });

  it("pipelines two image sends while preserving tile start order", async () => {
    const gates = new Map([
      [3, deferred()],
      [5, deferred()],
      [2, deferred()],
      [4, deferred()],
    ]);
    const harness = await createFastRefreshHarness({
      imageSendConcurrency: 2,
      update: async (id, _call, encodeAttempt) => {
        if (encodeAttempt === 2) await gates.get(id)?.promise;
        return "success";
      },
    });
    diagnosticLogger.clear();

    harness.request("all");
    await vi.waitFor(() => expect(harness.imageIds.slice(4)).toEqual([3, 5]));
    expect(harness.maximumActiveImageSends).toBe(2);
    expect(diagnosticLogger.text()).toContain(
      "[TILE] sandevistanTR start · 1/4 · inflight 1/2",
    );
    expect(diagnosticLogger.text()).toContain(
      "[TILE] sandevistanBR start · 2/4 · inflight 2/2",
    );

    gates.get(5)?.resolve();
    await vi.waitFor(() => expect(harness.imageIds.slice(4)).toEqual([
      3,
      5,
      2,
    ]));
    gates.get(3)?.resolve();
    await vi.waitFor(() => expect(harness.imageIds.slice(4)).toEqual([
      3,
      5,
      2,
      4,
    ]));
    gates.get(2)?.resolve();
    gates.get(4)?.resolve();
    await vi.waitFor(() => expect(diagnosticLogger.text()).toContain(
      "[REFRESH] external all complete",
    ));

    expect(harness.maximumActiveImageSends).toBe(2);
  });

  it("pipelines at most three image sends", async () => {
    const gates = new Map([
      [3, deferred()],
      [5, deferred()],
      [2, deferred()],
      [4, deferred()],
    ]);
    const harness = await createFastRefreshHarness({
      imageSendConcurrency: 3,
      update: async (id, _call, encodeAttempt) => {
        if (encodeAttempt === 2) await gates.get(id)?.promise;
        return "success";
      },
    });

    harness.request("all");
    await vi.waitFor(() => expect(harness.imageIds.slice(4)).toEqual([
      3,
      5,
      2,
    ]));
    expect(harness.maximumActiveImageSends).toBe(3);
    gates.get(5)?.resolve();
    await vi.waitFor(() => expect(harness.imageIds.slice(4)).toEqual([
      3,
      5,
      2,
      4,
    ]));
    gates.get(3)?.resolve();
    gates.get(2)?.resolve();
    gates.get(4)?.resolve();
    await vi.waitFor(() => expect(diagnosticLogger.text()).toContain(
      "[REFRESH] external all complete",
    ));

    expect(harness.maximumActiveImageSends).toBe(3);
  });

  it("pipelines all four full-frame image sends at limit four", async () => {
    const gates = new Map([
      [3, deferred()],
      [5, deferred()],
      [2, deferred()],
      [4, deferred()],
    ]);
    const harness = await createFastRefreshHarness({
      imageSendConcurrency: 4,
      update: async (id, _call, encodeAttempt) => {
        if (encodeAttempt === 2) await gates.get(id)?.promise;
        return "success";
      },
    });
    diagnosticLogger.clear();

    harness.request("all");
    await vi.waitFor(() => expect(harness.imageIds.slice(4)).toEqual([
      3,
      5,
      2,
      4,
    ]));

    expect(harness.maximumActiveImageSends).toBe(4);
    expect(diagnosticLogger.text()).toContain(
      "[TILE] sandevistanBL start · 4/4 · inflight 4/4",
    );

    for (const gate of gates.values()) gate.resolve();
    await vi.waitFor(() => expect(diagnosticLogger.text()).toContain(
      "[REFRESH] external all complete",
    ));
  });

  it("keeps serial image concurrency by default", async () => {
    const gates = new Map([
      [3, deferred()],
      [5, deferred()],
      [2, deferred()],
      [4, deferred()],
    ]);
    const harness = await createFastRefreshHarness({
      update: async (id, _call, encodeAttempt) => {
        if (encodeAttempt === 2) await gates.get(id)?.promise;
        return "success";
      },
    });

    harness.request("all");
    await vi.waitFor(() => expect(harness.imageIds.slice(4)).toEqual([3]));
    gates.get(3)?.resolve();
    await vi.waitFor(() => expect(harness.imageIds.slice(4)).toEqual([3, 5]));
    gates.get(5)?.resolve();
    await vi.waitFor(() => expect(harness.imageIds.slice(4)).toEqual([
      3,
      5,
      2,
    ]));
    gates.get(2)?.resolve();
    await vi.waitFor(() => expect(harness.imageIds.slice(4)).toEqual([
      3,
      5,
      2,
      4,
    ]));
    gates.get(4)?.resolve();
    await vi.waitFor(() => expect(diagnosticLogger.text()).toContain(
      "[REFRESH] external all complete",
    ));

    expect(harness.maximumActiveImageSends).toBe(1);
  });

  it("stops a failed pipeline without queueing later tiles and retains peer cache", async () => {
    const peer = deferred();
    const harness = await createFastRefreshHarness({
      imageSendConcurrency: 2,
      encode: async (ids, attempt) => ids.map((id) => new Uint8Array([
        id,
        attempt === 1 ? 0 : 1,
      ])),
      update: async (id, _call, encodeAttempt) => {
        if (encodeAttempt === 2 && id === 3) return "sendFailed";
        if (encodeAttempt === 2 && id === 5) await peer.promise;
        return "success";
      },
    });
    diagnosticLogger.clear();

    harness.request("all");
    await vi.waitFor(() => expect(diagnosticLogger.text()).toContain(
      "[ERROR] sandevistanTR failed · sendFailed",
    ));
    expect(harness.imageIds.slice(4)).toEqual([3, 5]);
    harness.request("left");
    await Promise.resolve();
    expect(harness.encodedTileIds).toHaveLength(2);

    peer.resolve();
    await vi.waitFor(() => expect(harness.progress.some(
      (message) => message.includes("sendFailed"),
    )).toBe(true));
    diagnosticLogger.clear();
    harness.request("all");
    await vi.waitFor(() => expect(diagnosticLogger.text()).toContain(
      "[REFRESH] external all complete",
    ));

    expect(harness.imageIds).toEqual([3, 5, 2, 4, 3, 5, 2, 4, 3]);
    expect(diagnosticLogger.text()).toContain(
      "[TILE] sandevistanBR skipped · unchanged",
    );
  });

  it("live refresh maps independent requests to their display halves", async () => {
    const harness = await createFastRefreshHarness();

    harness.request("left");
    await vi.waitFor(() => expect(harness.imageIds).toHaveLength(6));
    harness.request("right");
    await vi.waitFor(() => expect(harness.imageIds).toHaveLength(8));

    expect(harness.encodedTileIds).toEqual([
      [3, 5, 2, 4],
      [2, 4],
      [3, 5],
    ]);
    expect(harness.imageIds).toEqual([3, 5, 2, 4, 2, 4, 3, 5]);
  });

  it("live refresh maps a right-top request to image ID 3 only", async () => {
    const harness = await createFastRefreshHarness();

    harness.request("right-top");
    await vi.waitFor(() => expect(harness.imageIds).toHaveLength(5));

    expect(harness.encodedTileIds).toEqual([
      [3, 5, 2, 4],
      [3],
    ]);
    expect(harness.imageIds).toEqual([3, 5, 2, 4, 3]);
  });

  it("skips every unchanged tile without calling the image bridge", async () => {
    const harness = await createFastRefreshHarness({
      encode: async (ids) => ids.map((id) => new Uint8Array([id])),
    });
    diagnosticLogger.clear();

    harness.request("right");
    await vi.waitFor(() => expect(diagnosticLogger.text()).toContain(
      "[REFRESH] external right complete",
    ));

    expect(harness.imageIds).toEqual([3, 5, 2, 4]);
    expect(diagnosticLogger.text()).toContain(
      "[TILE] sandevistanTR skipped · unchanged",
    );
    expect(diagnosticLogger.text()).toContain(
      "[TILE] sandevistanBR skipped · unchanged",
    );
    expect(diagnosticLogger.text()).toContain(
      "[REFRESH] image refresh complete · sent 0 · skipped 2",
    );
  });

  it("sends only the tile whose encoded payload changed", async () => {
    const harness = await createFastRefreshHarness({
      encode: async (ids, attempt) => ids.map((id) => new Uint8Array([
        id,
        attempt > 1 && id === 5 ? 1 : 0,
      ])),
    });

    harness.request("right");
    await vi.waitFor(() => expect(harness.imageIds).toHaveLength(5));

    expect(harness.imageIds).toEqual([3, 5, 2, 4, 5]);
    expect(diagnosticLogger.text()).toContain(
      "[REFRESH] image refresh complete · sent 1 · skipped 1",
    );
  });

  it("keeps successful tile cache entries when a later tile send fails", async () => {
    const harness = await createFastRefreshHarness({
      encode: async (ids, attempt) => ids.map((id) => new Uint8Array([
        id,
        attempt > 1 ? 1 : 0,
      ])),
      update: async (id, _call, encodeAttempt) => (
        encodeAttempt === 2 && id === 5 ? "sendFailed" : "success"
      ),
    });

    harness.request("right");
    await vi.waitFor(() => expect(
      harness.progress.some((message) => message.includes("sendFailed")),
    ).toBe(true));
    diagnosticLogger.clear();

    harness.request("right");
    await vi.waitFor(() => expect(diagnosticLogger.text()).toContain(
      "[REFRESH] external right complete",
    ));

    expect(harness.imageIds).toEqual([3, 5, 2, 4, 3, 5, 5]);
    expect(diagnosticLogger.text()).toContain(
      "[TILE] sandevistanTR skipped · unchanged",
    );
    expect(diagnosticLogger.text()).toContain(
      "[TILE] sandevistanBR success",
    );
  });

  it("coalesces multiple pending targets into one full refresh", async () => {
    const harness = await createFastRefreshHarness();

    harness.request("left");
    harness.request("right");
    harness.request("all");
    harness.request("left");
    await vi.waitFor(() => expect(harness.imageIds).toHaveLength(10));

    expect(harness.encodedTileIds).toEqual([
      [3, 5, 2, 4],
      [2, 4],
      [3, 5, 2, 4],
    ]);
  });

  it("live refresh redraws immediately before encoding", async () => {
    const order: string[] = [];
    let initialized = false;
    const harness = await createFastRefreshHarness({
      beforeExternalRefresh: async () => {
        order.push("redraw");
      },
      encode: async (ids, attempt) => {
        if (initialized) order.push(`encode:${ids.join(",")}`);
        return ids.map((id) => new Uint8Array([id, attempt]));
      },
    });
    initialized = true;

    harness.request("right");
    await vi.waitFor(() => expect(harness.imageIds).toHaveLength(6));

    expect(order).toEqual(["redraw", "encode:3,5"]);
  });

  it("coalesces external refreshes received during an active send", async () => {
    const firstExternalSend = deferred();
    let blocked = false;
    const harness = await createFastRefreshHarness({
      update: async (_id, _call, encodeAttempt) => {
        if (encodeAttempt === 2 && !blocked) {
          blocked = true;
          await firstExternalSend.promise;
        }
        return "success";
      },
    });

    harness.request("right");
    await vi.waitFor(() => expect(blocked).toBe(true));
    harness.request("left");
    harness.request("right");
    harness.request("left");
    firstExternalSend.resolve();
    await vi.waitFor(() => expect(harness.imageIds).toHaveLength(10));
    await Promise.resolve();

    expect(harness.encodedTileIds).toEqual([
      [3, 5, 2, 4],
      [3, 5],
      [3, 5, 2, 4],
    ]);
    expect(harness.maximumActiveImageSends).toBe(1);
  });

  it("reports a successful display commit without reporting failed work", async () => {
    const harness = await createFastRefreshHarness();

    expect(harness.committedMinutes).toEqual([1_234]);
    harness.request("right-top");
    await vi.waitFor(() => expect(harness.imageIds).toHaveLength(5));
    expect(harness.committedMinutes).toEqual([1_234, 1_234]);
  });

  it("live refresh releases its scheduler after encode failure", async () => {
    let failNextExternalEncode = true;
    const harness = await createFastRefreshHarness({
      encode: async (ids, attempt) => {
        if (attempt > 1 && failNextExternalEncode) {
          failNextExternalEncode = false;
          throw new Error("encode exploded");
        }
        return ids.map((id) => new Uint8Array([id, attempt]));
      },
    });

    harness.request("right");
    await vi.waitFor(() => expect(harness.progress).toContain("encode exploded"));
    harness.request("left");
    await vi.waitFor(() => expect(harness.imageIds).toHaveLength(6));

    expect(harness.encodedTileIds).toEqual([
      [3, 5, 2, 4],
      [3, 5],
      [2, 4],
    ]);
    expect(harness.imageIds).toEqual([3, 5, 2, 4, 2, 4]);
  });

  it("live refresh releases its scheduler after SENDFAILED", async () => {
    let failNextExternalSend = true;
    const harness = await createFastRefreshHarness({
      update: async (_id, _call, encodeAttempt) => {
        if (encodeAttempt > 1 && failNextExternalSend) {
          failNextExternalSend = false;
          return "sendFailed";
        }
        return "success";
      },
    });

    harness.request("right");
    await vi.waitFor(() => expect(
      harness.progress.some((message) => message.includes("sendFailed")),
    ).toBe(true));
    harness.request("left");
    await vi.waitFor(() => expect(harness.imageIds).toHaveLength(7));

    expect(harness.encodedTileIds).toEqual([
      [3, 5, 2, 4],
      [3, 5],
      [2, 4],
    ]);
    expect(harness.imageIds).toEqual([3, 5, 2, 4, 3, 2, 4]);
  });

  it("pauses background refresh after three failures and recovers on input", async () => {
    const harness = await createFastRefreshHarness({
      inputResult: "redraw",
      update: async (_id, _call, encodeAttempt) => (
        encodeAttempt >= 2 && encodeAttempt <= 4 ? "sendFailed" : "success"
      ),
    });

    for (let failure = 1; failure <= 3; failure += 1) {
      harness.request("right");
      await vi.waitFor(() => expect(
        harness.progress.filter((message) => message.includes("sendFailed")),
      ).toHaveLength(failure));
    }
    expect(diagnosticLogger.text()).toContain(
      "transport degraded · 3 consecutive failures",
    );

    harness.request("left");
    await Promise.resolve();
    expect(harness.encodedTileIds).toHaveLength(4);
    expect(diagnosticLogger.text()).toContain(
      "external left dropped · degraded",
    );

    harness.emit(OsEventTypeList.CLICK_EVENT);
    await vi.waitFor(() => expect(diagnosticLogger.text()).toContain(
      "transport recovered",
    ));
    harness.request("left");
    await vi.waitFor(() => expect(harness.encodedTileIds).toHaveLength(6));
  });

  it("times out a stalled tile, releases busy, and ignores late settlement", async () => {
    const stalled = deferred();
    const harness = await createFastRefreshHarness({
      update: async (_id, _call, encodeAttempt) => {
        if (encodeAttempt === 2) {
          await stalled.promise;
        }
        return "success";
      },
    });
    vi.useFakeTimers();

    harness.request("right");
    await Promise.resolve();
    await Promise.resolve();
    expect(harness.imageIds).toHaveLength(5);

    await vi.advanceTimersByTimeAsync(12_000);
    expect(harness.progress.some((message) => message.includes("12000ms")))
      .toBe(true);

    harness.request("left");
    await vi.advanceTimersByTimeAsync(0);
    expect(harness.imageIds).toEqual([3, 5, 2, 4, 3, 2, 4]);
    expect(harness.committedMinutes).toEqual([1_234, 1_234]);

    stalled.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(harness.imageIds).toEqual([3, 5, 2, 4, 3, 2, 4]);
    expect(harness.committedMinutes).toEqual([1_234, 1_234]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rolls local navigation back after a failed page transfer", async () => {
    const directions: string[] = [];
    let pageIndex = 0;
    let failNextSend = true;
    const harness = await createFastRefreshHarness({
      navigate: (direction) => {
        directions.push(direction);
        pageIndex = (pageIndex + (direction === "next" ? 1 : -1) + 4) % 4;
      },
      update: async (_id, _call, encodeAttempt) => {
        if (encodeAttempt === 2 && failNextSend) {
          failNextSend = false;
          return "sendFailed";
        }
        return "success";
      },
    });

    harness.emit(OsEventTypeList.SCROLL_BOTTOM_EVENT);
    await vi.waitFor(() => expect(
      harness.progress.some((message) => message.includes("sendFailed")),
    ).toBe(true));
    expect(directions).toEqual(["next", "previous"]);
    expect(pageIndex).toBe(0);

    harness.emit(OsEventTypeList.SCROLL_BOTTOM_EVENT);
    await vi.waitFor(() => expect(harness.imageIds).toHaveLength(7));
    expect(directions).toEqual(["next", "previous", "next"]);
    expect(pageIndex).toBe(1);
  });

  it("live refresh skips hidden work and restores the newest full HUD", async () => {
    const order: string[] = [];
    const harness = await createFastRefreshHarness({
      displayHideStrategy: "black-tiles",
      beforeExternalRefresh: async () => {
        order.push("external-redraw");
      },
      beforeRestore: async () => {
        order.push("restore-redraw");
      },
      encode: async (ids, attempt, source) => {
        if (attempt > 1) order.push(`encode:${source}:${ids.join(",")}`);
        return ids.map((id) => new Uint8Array([
          id,
          source === "black" ? 1 : 0,
        ]));
      },
    });

    harness.emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
    await vi.waitFor(() => expect(harness.imageIds).toHaveLength(8));
    diagnosticLogger.clear();
    harness.request("right");
    await Promise.resolve();
    expect(diagnosticLogger.text()).toContain(
      "[REFRESH] external right dropped · hidden",
    );
    harness.emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
    await vi.waitFor(() => expect(harness.imageIds).toHaveLength(12));

    expect(harness.encodedTileIds).toEqual([
      [3, 5, 2, 4],
      [3, 5, 2, 4],
      [3, 5, 2, 4],
    ]);
    expect(order).toEqual([
      "encode:black:3,5,2,4",
      "restore-redraw",
      "encode:hud:3,5,2,4",
    ]);
  });

  it("bypasses HUD palette conversion for the black hidden frame", async () => {
    const harness = await createFastRefreshHarness({
      displayHideStrategy: "black-tiles",
      tilePaletteMode: "hud-4",
    });

    expect(harness.encodedPaletteModes).toEqual(["hud-4"]);
    harness.emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
    await vi.waitFor(() => expect(harness.encodedSources).toEqual([
      "hud",
      "black",
    ]));
    expect(harness.encodedPaletteModes).toEqual(["hud-4", "original"]);

    harness.emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
    await vi.waitFor(() => expect(harness.encodedSources).toEqual([
      "hud",
      "black",
      "hud",
    ]));
    expect(harness.encodedPaletteModes).toEqual([
      "hud-4",
      "original",
      "hud-4",
    ]);
  });

  it("keeps BMP for content but uses PNG for the black hidden frame", async () => {
    const harness = await createFastRefreshHarness({
      displayHideStrategy: "black-tiles",
      tileImageFormat: "bmp-1",
      tilePaletteMode: "hud-4",
    });

    expect(harness.encodedImageFormats).toEqual(["bmp-1"]);
    harness.emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
    await vi.waitFor(() => expect(harness.encodedSources).toEqual([
      "hud",
      "black",
    ]));
    expect(harness.encodedImageFormats).toEqual(["bmp-1", "png"]);

    harness.emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
    await vi.waitFor(() => expect(harness.encodedSources).toEqual([
      "hud",
      "black",
      "hud",
    ]));
    expect(harness.encodedImageFormats).toEqual([
      "bmp-1",
      "png",
      "bmp-1",
    ]);
  });

  it("default blank rebuild hides without images and restores all four tiles", async () => {
    const harness = await createFastRefreshHarness();

    harness.emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
    await vi.waitFor(() => expect(harness.rebuiltPages).toHaveLength(1));
    expect(harness.encodedSources).toEqual(["hud"]);
    expect(harness.imageIds).toEqual([3, 5, 2, 4]);
    expect(harness.rebuiltPages[0].containerTotalNum).toBe(1);

    const transitionStart = harness.transitionEvents.length;
    harness.emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
    await vi.waitFor(() => expect(harness.rebuiltPages).toHaveLength(2));
    await vi.waitFor(() => expect(harness.imageIds).toEqual([
      3, 5, 2, 4,
      3, 5, 2, 4,
    ]));
    expect(harness.encodedSources).toEqual(["hud", "hud"]);
    expect(harness.rebuiltPages[1].containerTotalNum).toBe(5);
    expect(harness.transitionEvents.slice(transitionStart)).toEqual([
      "rebuild:image",
      "encode:3,5,2,4",
      "image:3",
      "image:5",
      "image:2",
      "image:4",
    ]);
  });

  it("keeps visible input active after a failed blank hide rebuild", async () => {
    const harness = await createFastRefreshHarness({
      displayHideStrategy: "blank-rebuild",
      rebuild: () => false,
    });
    diagnosticLogger.clear();

    harness.emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
    await vi.waitFor(() => expect(diagnosticLogger.text()).toContain(
      "[ERROR] input double-tap failed · Blank glasses page rebuild failed",
    ));
    expect(harness.rebuiltPages).toHaveLength(1);
    expect(harness.encodedSources).toEqual(["hud"]);
    expect(harness.imageIds).toEqual([3, 5, 2, 4]);

    harness.emit(OsEventTypeList.SCROLL_BOTTOM_EVENT);
    await vi.waitFor(() => expect(harness.imageIds).toHaveLength(6));
    expect(harness.inputs).toEqual(["double-tap", "scroll-next"]);
    expect(harness.rebuiltPages).toHaveLength(1);
  });

  it("keeps a failed blank restore hidden until a fresh double tap", async () => {
    const harness = await createFastRefreshHarness({
      displayHideStrategy: "blank-rebuild",
      rebuild: (_page, call) => call !== 2,
    });

    harness.emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
    await vi.waitFor(() => expect(harness.rebuiltPages).toHaveLength(1));
    harness.emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
    await vi.waitFor(() => expect(harness.rebuiltPages).toHaveLength(2));
    await vi.waitFor(() => expect(diagnosticLogger.text()).toContain(
      "[ERROR] input double-tap failed · Glasses page restore rebuild failed",
    ));

    harness.emit(OsEventTypeList.SCROLL_BOTTOM_EVENT);
    await Promise.resolve();
    expect(harness.inputs).toEqual(["double-tap"]);
    expect(harness.encodedSources).toEqual(["hud"]);
    expect(harness.imageIds).toEqual([3, 5, 2, 4]);

    harness.emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
    await vi.waitFor(() => expect(harness.rebuiltPages).toHaveLength(3));
    await vi.waitFor(() => expect(harness.imageIds).toEqual([
      3, 5, 2, 4,
      3, 5, 2, 4,
    ]));
    expect(harness.encodedSources).toEqual(["hud", "hud"]);
  });

  it("live refresh ignores captured requests after cleanup", async () => {
    const harness = await createFastRefreshHarness();

    harness.cleanup();
    harness.request("all");
    await Promise.resolve();
    await Promise.resolve();

    expect(harness.encodedTileIds).toEqual([[3, 5, 2, 4]]);
    expect(harness.imageIds).toEqual([3, 5, 2, 4]);
    expect(harness.sdkUnsubscribeCalls).toBe(1);
  });

  it("live refresh cancels queued work on synchronous cleanup", async () => {
    const harness = await createFastRefreshHarness();

    harness.request("right");
    harness.cleanup();
    await Promise.resolve();
    await Promise.resolve();

    expect(harness.encodedTileIds).toEqual([[3, 5, 2, 4]]);
    expect(harness.imageIds).toEqual([3, 5, 2, 4]);
  });

  it("live refresh does not encode when cleaned up during redraw", async () => {
    const redrawGate = deferred();
    let redrawStarted = false;
    let redrawFinished = false;
    const harness = await createFastRefreshHarness({
      beforeExternalRefresh: async () => {
        redrawStarted = true;
        await redrawGate.promise;
        redrawFinished = true;
      },
    });

    harness.request("left");
    await vi.waitFor(() => expect(redrawStarted).toBe(true));
    harness.cleanup();
    redrawGate.resolve();
    await vi.waitFor(() => expect(redrawFinished).toBe(true));
    await Promise.resolve();
    await Promise.resolve();

    expect(harness.encodedTileIds).toEqual([[3, 5, 2, 4]]);
    expect(harness.imageIds).toEqual([3, 5, 2, 4]);
  });

  it("live refresh unsubscribes and neutralizes work when ready throws", async () => {
    const module = await loadGlasses();
    if (!module) return;
    const encodedTileIds: number[][] = [];
    const imageIds: number[] = [];
    let sdkUnsubscribeCalls = 0;
    const bridge = {
      createStartUpPageContainer: async () => 0,
      rebuildPageContainer: async () => true,
      updateImageRawData: async (update: { containerID?: number }) => {
        imageIds.push(update.containerID!);
        return "success";
      },
      onEvenHubEvent: () => () => {
        sdkUnsubscribeCalls += 1;
      },
      shutDownPageContainer: async () => true,
    };

    await expect(module.transmitFastCanvas(
      {} as HTMLCanvasElement,
      () => undefined,
      async () => undefined,
      {
        dependencies: {
          waitForBridge: async () => bridge,
          encode: async (
            _source,
            _factory,
            tiles = module.G2_TILES,
          ) => {
            const ids = tiles.map(({ id }) => id);
            encodedTileIds.push(ids);
            return ids.map((id) => new Uint8Array([id]));
          },
        },
        onRefreshReady: (request) => {
          request("all");
          throw new Error("ready exploded");
        },
      },
    )).rejects.toThrow("ready exploded");
    await Promise.resolve();
    await Promise.resolve();

    expect(sdkUnsubscribeCalls).toBe(1);
    expect(encodedTileIds).toEqual([[3, 5, 2, 4]]);
    expect(imageIds).toEqual([3, 5, 2, 4]);
  });

  it("live refresh keeps its disposer idempotent", async () => {
    const harness = await createFastRefreshHarness();

    harness.cleanup();
    harness.cleanup();

    expect(harness.sdkUnsubscribeCalls).toBe(1);
  });

  it("routes handled, consumed, and fallback fast Canvas input", async () => {
    const harness = await createFastRefreshHarness();

    harness.setInputResult("redraw");
    harness.emit(OsEventTypeList.CLICK_EVENT);
    await vi.waitFor(() => expect(harness.imageIds).toHaveLength(8));
    expect(harness.inputs).toEqual(["tap"]);
    expect(harness.encodedTileIds.at(-1)).toEqual([3, 5, 2, 4]);

    harness.setInputResult("consume");
    diagnosticLogger.clear();
    harness.emit(OsEventTypeList.SCROLL_BOTTOM_EVENT);
    await vi.waitFor(() => expect(diagnosticLogger.text()).toContain(
      "[REFRESH] input scroll-next complete",
    ));
    expect(harness.imageIds).toHaveLength(8);

    harness.setInputResult("unhandled");
    harness.emit(OsEventTypeList.SCROLL_BOTTOM_EVENT);
    await vi.waitFor(() => expect(harness.imageIds).toHaveLength(10));
    expect(harness.encodedTileIds.at(-1)).toEqual([3, 5]);
    expect(harness.inputs).toEqual([
      "tap",
      "scroll-next",
      "scroll-next",
    ]);
  });

  it("keeps general page direction independent from consumed detail gestures", async () => {
    const directions: string[] = [];
    const harness = await createFastRefreshHarness({
      navigate: (direction) => {
        directions.push(direction);
      },
    });

    harness.setInputResult("unhandled");
    harness.emit(OsEventTypeList.SCROLL_BOTTOM_EVENT);
    await vi.waitFor(() => expect(directions).toEqual(["next"]));

    harness.emit(OsEventTypeList.SCROLL_TOP_EVENT);
    await vi.waitFor(() => expect(directions).toEqual(["next", "previous"]));

    harness.setInputResult("consume");
    harness.emit(OsEventTypeList.SCROLL_BOTTOM_EVENT);
    await vi.waitFor(() => expect(harness.inputs.at(-1)).toBe("scroll-next"));
    expect(directions).toEqual(["next", "previous"]);
  });

  it("traces one handled tap and one dashboard hide without extra sends", async () => {
    const harness = await createFastRefreshHarness({
      displayHideStrategy: "black-tiles",
      inputResult: "redraw",
    });
    diagnosticLogger.clear();

    harness.emit(OsEventTypeList.CLICK_EVENT);
    await vi.waitFor(() => expect(harness.imageIds).toHaveLength(8));

    harness.setInputResult("unhandled");
    harness.emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
    await vi.waitFor(() => expect(harness.imageIds).toHaveLength(12));

    const trace = diagnosticLogger.text();
    expect(trace).toContain("[INPUT] raw");
    expect(trace).toContain("[REFRESH] input tap accepted");
    expect(trace).toContain("[ENCODE] start · 4 tiles");
    expect(trace).toContain(
      "[ENCODE] complete · 4 tiles · palette original"
        + " · format png · bytes 2/2/2/2 · total 8",
    );
    expect(trace).toContain("[TILE] sandevistanTR success");
    expect(trace).toContain("[REFRESH] hide complete");
    expect(harness.imageIds).toHaveLength(12);
  });

  it("does not trace microphone frames as glasses input", async () => {
    const harness = await createFastRefreshHarness();
    diagnosticLogger.clear();

    harness.emitEvent({
      audioEvent: { source: AudioInputSource.Glasses, audioPcm: new Uint8Array([0, 0]) },
    } as EvenHubEvent);

    expect(harness.inputs).toEqual([]);
    expect(harness.rawEvents).toEqual([]);
    expect(diagnosticLogger.text()).not.toContain("[INPUT] raw");
  });

  it("treats a text event with an omitted zero event type as a tap", async () => {
    const harness = await createFastRefreshHarness({
      inputResult: "redraw",
    });

    harness.emitEvent({
      textEvent: {
        containerID: 1,
        containerName: "eventLayer",
      },
    } as EvenHubEvent);

    await vi.waitFor(() => expect(harness.imageIds).toHaveLength(8));
    expect(harness.inputs).toEqual(["tap"]);
  });

  it("reports an omitted hidden event before discarding it", async () => {
    const harness = await createFastRefreshHarness({
      displayHideStrategy: "black-tiles",
    });

    harness.emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
    await vi.waitFor(() => expect(harness.imageIds).toHaveLength(8));

    harness.emitEvent({
      textEvent: {
        containerID: 1,
        containerName: "eventLayer",
      },
    } as EvenHubEvent);
    await Promise.resolve();
    await Promise.resolve();

    expect(harness.rawEvents.at(-1)).toEqual({
      count: 2,
      hidden: true,
      sysEventType: undefined,
      textEventType: undefined,
      eventSource: undefined,
    });
    expect(harness.imageIds).toHaveLength(8);

    harness.cleanup();
    harness.emitEvent({
      sysEvent: { eventType: OsEventTypeList.DOUBLE_CLICK_EVENT },
    } as EvenHubEvent);
    expect(harness.rawEvents).toHaveLength(2);
  });

  it("sends every detail transition as one ordered four-tile operation", async () => {
    const harness = await createFastRefreshHarness({
      inputResult: "redraw",
    });

    harness.emit(OsEventTypeList.CLICK_EVENT);
    await vi.waitFor(() => expect(harness.imageIds).toHaveLength(8));
    harness.emit(OsEventTypeList.SCROLL_BOTTOM_EVENT);
    await vi.waitFor(() => expect(harness.imageIds).toHaveLength(12));
    harness.emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
    await vi.waitFor(() => expect(harness.imageIds).toHaveLength(16));

    harness.setInputResult("consume");
    harness.emit(OsEventTypeList.SCROLL_TOP_EVENT);
    await Promise.resolve();
    await Promise.resolve();

    expect(harness.encodedTileIds).toEqual([
      [3, 5, 2, 4],
      [3, 5, 2, 4],
      [3, 5, 2, 4],
      [3, 5, 2, 4],
    ]);
    expect(harness.imageIds).toHaveLength(16);
    expect(harness.progress).toContain(TRANSPORT_STATUS.active);
    expect(harness.maximumActiveImageSends).toBe(1);
  });

  it("lets handled double-tap input redraw before dashboard hide fallback", async () => {
    const harness = await createFastRefreshHarness({
      displayHideStrategy: "black-tiles",
    });

    harness.setInputResult("redraw");
    harness.emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
    await vi.waitFor(() => expect(harness.imageIds).toHaveLength(8));
    expect(harness.encodedSources.at(-1)).toBe("hud");

    harness.setInputResult("unhandled");
    harness.emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
    await vi.waitFor(() => expect(harness.imageIds).toHaveLength(12));
    expect(harness.encodedSources.at(-1)).toBe("black");

    harness.setInputResult("redraw");
    harness.emit(OsEventTypeList.CLICK_EVENT);
    harness.emit(OsEventTypeList.SCROLL_BOTTOM_EVENT);
    await Promise.resolve();
    await Promise.resolve();
    expect(harness.imageIds).toHaveLength(12);

    harness.emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
    await vi.waitFor(() => expect(harness.imageIds).toHaveLength(16));
    expect(harness.encodedSources.at(-1)).toBe("hud");
    expect(harness.inputs).toEqual(["double-tap", "double-tap"]);
  });

  it("drops input queued while the black hide transfer is finishing", async () => {
    const hideGate = deferred();
    let hideBlocked = false;
    const harness = await createFastRefreshHarness({
      displayHideStrategy: "black-tiles",
      update: async (_id, _call, encodeAttempt) => {
        if (encodeAttempt === 2 && !hideBlocked) {
          hideBlocked = true;
          await hideGate.promise;
        }
        return "success";
      },
    });

    harness.setInputResult("unhandled");
    harness.emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
    await vi.waitFor(() => expect(hideBlocked).toBe(true));
    harness.setInputResult("redraw");
    harness.emit(OsEventTypeList.CLICK_EVENT);
    hideGate.resolve();
    await vi.waitFor(() => expect(harness.imageIds).toHaveLength(8));
    await Promise.resolve();
    await Promise.resolve();

    expect(harness.imageIds).toHaveLength(8);
    expect(harness.inputs).toEqual(["double-tap"]);
    expect(harness.encodedSources).toEqual(["hud", "black"]);
  });

  it("preserves input received during an active send", async () => {
    const firstInputSend = deferred();
    let blocked = false;
    const harness = await createFastRefreshHarness({
      inputResult: "redraw",
      update: async (_id, _call, encodeAttempt) => {
        if (encodeAttempt === 2 && !blocked) {
          blocked = true;
          await firstInputSend.promise;
        }
        return "success";
      },
    });

    harness.emit(OsEventTypeList.CLICK_EVENT);
    await vi.waitFor(() => expect(blocked).toBe(true));
    harness.emit(OsEventTypeList.CLICK_EVENT);
    firstInputSend.resolve();
    await vi.waitFor(() => expect(harness.imageIds).toHaveLength(12));
    await Promise.resolve();

    expect(harness.encodedTileIds).toEqual([
      [3, 5, 2, 4],
      [3, 5, 2, 4],
      [3, 5, 2, 4],
    ]);
    expect(harness.inputs).toEqual(["tap", "tap"]);
    expect(harness.maximumActiveImageSends).toBe(1);
  });
  it("toggles fast Canvas pixels while keeping the app event layer alive", async () => {
    const module = await loadGlasses();
    if (!module) return;
    const transmitFastCanvas = (
      module as unknown as {
        transmitFastCanvas?: (...args: unknown[]) => Promise<() => void>;
      }
    ).transmitFastCanvas;
    expect(transmitFastCanvas).toBeTypeOf("function");
    if (!transmitFastCanvas) return;

    const hudSource = { name: "hud" } as unknown as HTMLCanvasElement;
    const blackSource = { name: "black" } as unknown as HTMLCanvasElement;
    let listener: ((event: EvenHubEvent) => void) | undefined;
    let shutdownCalls = 0;
    let beforeRestoreCalls = 0;
    const navigationCalls: string[] = [];
    const encodes: Array<{ source: string; ids: number[] }> = [];
    const imageIds: number[] = [];
    const bridge = {
      createStartUpPageContainer: async () => 0,
      rebuildPageContainer: async () => true,
      updateImageRawData: async (update: { containerID?: number }) => {
        imageIds.push(update.containerID!);
        return "success";
      },
      onEvenHubEvent: (next: (event: EvenHubEvent) => void) => {
        listener = next;
        return () => undefined;
      },
      shutDownPageContainer: async () => {
        shutdownCalls += 1;
        return true;
      },
    };
    const emit = (eventType: OsEventTypeList) => listener!({
      sysEvent: { eventType },
    } as EvenHubEvent);

    await transmitFastCanvas(
      hudSource,
      () => undefined,
      async (direction: string) => {
        navigationCalls.push(direction);
      },
      {
        dependencies: {
          waitForBridge: async () => bridge,
          encode: async (
            source: HTMLCanvasElement,
            _factory: unknown,
            tiles = module.G2_TILES,
          ) => {
            encodes.push({
              source: source === blackSource ? "black" : "hud",
              ids: tiles.map(({ id }) => id),
            });
            return tiles.map(({ id }) => new Uint8Array([
              id,
              encodes.length,
            ]));
          },
        },
        createHiddenSource: () => blackSource,
        displayHideStrategy: "black-tiles",
        beforeRestore: async () => {
          beforeRestoreCalls += 1;
        },
      },
    );

    emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
    await vi.waitFor(() => expect(imageIds).toHaveLength(8));
    emit(OsEventTypeList.SCROLL_BOTTOM_EVENT);
    await Promise.resolve();
    expect(imageIds).toHaveLength(8);
    expect(navigationCalls).toEqual([]);

    emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
    await vi.waitFor(() => expect(imageIds).toHaveLength(12));
    emit(OsEventTypeList.SCROLL_BOTTOM_EVENT);
    await vi.waitFor(() => expect(imageIds).toHaveLength(14));

    expect(encodes).toEqual([
      { source: "hud", ids: [3, 5, 2, 4] },
      { source: "black", ids: [3, 5, 2, 4] },
      { source: "hud", ids: [3, 5, 2, 4] },
      { source: "hud", ids: [3, 5] },
    ]);
    expect(imageIds).toEqual([
      3, 5, 2, 4,
      3, 5, 2, 4,
      3, 5, 2, 4,
      3, 5,
    ]);
    expect(shutdownCalls).toBe(0);
    expect(navigationCalls).toEqual(["next"]);
    expect(beforeRestoreCalls).toBe(1);
  });

  it("retries failed hide and restore without corrupting visibility state", async () => {
    const module = await loadGlasses();
    if (!module) return;
    const transmitFastCanvas = (
      module as unknown as {
        transmitFastCanvas?: (...args: unknown[]) => Promise<() => void>;
      }
    ).transmitFastCanvas;
    expect(transmitFastCanvas).toBeTypeOf("function");
    if (!transmitFastCanvas) return;

    const hudSource = { name: "hud" } as unknown as HTMLCanvasElement;
    const blackSource = { name: "black" } as unknown as HTMLCanvasElement;
    let listener: ((event: EvenHubEvent) => void) | undefined;
    let activeTransfer = "";
    let blackAttempts = 0;
    let fullHudAttempts = 0;
    const transfers: string[] = [];
    const progress: string[] = [];
    const navigationCalls: string[] = [];
    const bridge = {
      createStartUpPageContainer: async () => 0,
      rebuildPageContainer: async () => true,
      updateImageRawData: async (update: { containerID?: number }) => {
        if (
          update.containerID === 2
          && (activeTransfer === "black:1" || activeTransfer === "hud:2")
        ) return "sendFailed";
        return "success";
      },
      onEvenHubEvent: (next: (event: EvenHubEvent) => void) => {
        listener = next;
        return () => undefined;
      },
      shutDownPageContainer: async () => true,
    };
    const emit = (eventType: OsEventTypeList) => listener!({
      sysEvent: { eventType },
    } as EvenHubEvent);

    await transmitFastCanvas(
      hudSource,
      (message: string) => progress.push(message),
      async (direction: string) => {
        navigationCalls.push(direction);
      },
      {
        dependencies: {
          waitForBridge: async () => bridge,
          encode: async (
            source: HTMLCanvasElement,
            _factory: unknown,
            tiles = module.G2_TILES,
          ) => {
            if (source === blackSource) {
              blackAttempts += 1;
              activeTransfer = `black:${blackAttempts}`;
            } else if (tiles.length === 4) {
              fullHudAttempts += 1;
              activeTransfer = `hud:${fullHudAttempts}`;
            } else {
              activeTransfer = "scroll";
            }
            transfers.push(activeTransfer);
            return tiles.map(({ id }) => new Uint8Array([
              id,
              transfers.length,
            ]));
          },
        },
        createHiddenSource: () => blackSource,
        displayHideStrategy: "black-tiles",
      },
    );

    emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
    await vi.waitFor(() => expect(
      progress.filter((message) => message.includes("sendFailed")),
    ).toHaveLength(1));
    emit(OsEventTypeList.SCROLL_BOTTOM_EVENT);
    await vi.waitFor(() => expect(transfers).toHaveLength(3));

    emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
    await vi.waitFor(() => expect(transfers).toHaveLength(4));
    emit(OsEventTypeList.SCROLL_BOTTOM_EVENT);
    await Promise.resolve();
    expect(transfers).toHaveLength(4);

    emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
    await vi.waitFor(() => expect(
      progress.filter((message) => message.includes("sendFailed")),
    ).toHaveLength(2));
    emit(OsEventTypeList.SCROLL_BOTTOM_EVENT);
    await Promise.resolve();
    expect(transfers).toHaveLength(5);

    emit(OsEventTypeList.DOUBLE_CLICK_EVENT);
    await vi.waitFor(() => expect(transfers).toHaveLength(6));
    emit(OsEventTypeList.SCROLL_BOTTOM_EVENT);
    await vi.waitFor(() => expect(transfers).toHaveLength(7));

    expect(transfers).toEqual([
      "hud:1",
      "black:1",
      "scroll",
      "black:2",
      "hud:2",
      "hud:3",
      "scroll",
    ]);
    expect(navigationCalls).toEqual(["next", "next"]);
  });

  it("keeps fast Canvas transmission alive when battery lookup fails", async () => {
    const module = await loadGlasses();
    if (!module) return;
    const transmitFastCanvas = (
      module as unknown as {
        transmitFastCanvas?: (...args: unknown[]) => Promise<() => void>;
      }
    ).transmitFastCanvas;
    expect(transmitFastCanvas).toBeTypeOf("function");
    if (!transmitFastCanvas) return;

    const imageIds: number[] = [];
    const batteries: unknown[] = [];
    const bridge = {
      getDeviceInfo: async () => {
        throw new Error("battery unavailable");
      },
      createStartUpPageContainer: async () => 0,
      rebuildPageContainer: async () => true,
      updateImageRawData: async (update: { containerID?: number }) => {
        imageIds.push(update.containerID!);
        return "success";
      },
      onEvenHubEvent: () => () => undefined,
      shutDownPageContainer: async () => true,
    };

    await transmitFastCanvas(
      {} as HTMLCanvasElement,
      () => undefined,
      async () => undefined,
      {
        dependencies: {
          waitForBridge: async () => bridge,
          encode: async (
            _source: HTMLCanvasElement,
            _factory: unknown,
            tiles = module.G2_TILES,
          ) => tiles.map(({ id }) => new Uint8Array([id])),
        },
        onBattery: (battery: unknown) => batteries.push(battery),
      },
    );

    expect(batteries).toEqual([undefined]);
    expect(imageIds).toEqual([3, 5, 2, 4]);
  });

  it("sends the hybrid background once and pages with native Text only", async () => {
    const module = await loadGlasses();
    if (!module) return;
    const transmitHybridCanvas = (
      module as unknown as {
        transmitHybridCanvas?: (...args: unknown[]) => Promise<() => void>;
      }
    ).transmitHybridCanvas;
    expect(transmitHybridCanvas).toBeTypeOf("function");
    if (!transmitHybridCanvas) return;

    let listener: ((event: EvenHubEvent) => void) | undefined;
    let startupPage: {
      textObject?: Array<{
        containerID?: number;
        content?: string;
        isEventCapture?: number;
        paddingLength?: number;
      }>;
    } | undefined;
    let createCount = 0;
    let rebuildCount = 0;
    const imageIds: number[] = [];
    const textContents: string[] = [];
    const bridge = {
      createStartUpPageContainer: async (page: typeof startupPage) => {
        startupPage = page;
        createCount += 1;
        return 0;
      },
      rebuildPageContainer: async () => {
        rebuildCount += 1;
        return true;
      },
      updateImageRawData: async (update: { containerID?: number }) => {
        imageIds.push(update.containerID!);
        return "success";
      },
      textContainerUpgrade: async (update: { content?: string }) => {
        textContents.push(update.content!);
        return true;
      },
      onEvenHubEvent: (next: (event: EvenHubEvent) => void) => {
        listener = next;
        return () => undefined;
      },
      shutDownPageContainer: async () => true,
    };

    const unsubscribe = await transmitHybridCanvas(
      {} as HTMLCanvasElement,
      "OVERVIEW 01 / 04",
      () => undefined,
      async (direction: string) => `${direction} PAGE`,
      {
        waitForBridge: async () => bridge,
        encode: async () => module.G2_TILES.map(({ id }) => new Uint8Array([id])),
      },
    );

    expect(startupPage?.textObject?.[0]).toMatchObject({
      containerID: 1,
      content: " ",
      isEventCapture: 1,
      paddingLength: 8,
    });
    expect(imageIds).toEqual([2, 3, 4, 5]);
    expect(textContents).toEqual(["OVERVIEW 01 / 04"]);

    listener!({
      sysEvent: { eventType: OsEventTypeList.SCROLL_BOTTOM_EVENT },
    } as EvenHubEvent);
    await vi.waitFor(() => expect(textContents).toHaveLength(2));
    listener!({
      textEvent: { eventType: OsEventTypeList.SCROLL_TOP_EVENT },
    } as EvenHubEvent);
    await vi.waitFor(() => expect(textContents).toHaveLength(3));

    expect(imageIds).toEqual([2, 3, 4, 5]);
    expect(textContents).toEqual([
      "OVERVIEW 01 / 04",
      "next PAGE",
      "previous PAGE",
    ]);
    expect(createCount).toBe(1);
    expect(rebuildCount).toBe(0);
    unsubscribe();
  });

  it("keeps layered hybrid images static while scrolling native Text", async () => {
    const module = await loadGlasses();
    if (!module) return;
    const transmitLayeredHybridCanvas = (
      module as unknown as {
        transmitLayeredHybridCanvas?: (
          ...args: unknown[]
        ) => Promise<() => void>;
      }
    ).transmitLayeredHybridCanvas;
    expect(transmitLayeredHybridCanvas).toBeTypeOf("function");
    if (!transmitLayeredHybridCanvas) return;

    let listener: ((event: EvenHubEvent) => void) | undefined;
    let startupPage: {
      toJson: () => {
        textObject?: Array<{ zOrderIndex?: number }>;
        imageObject?: Array<{ zOrderIndex?: number }>;
      };
    } | undefined;
    const imageIds: number[] = [];
    const textContents: string[] = [];
    const bridge = {
      createStartUpPageContainer: async (page: typeof startupPage) => {
        startupPage = page;
        return 0;
      },
      rebuildPageContainer: async () => true,
      updateImageRawData: async (update: { containerID?: number }) => {
        imageIds.push(update.containerID!);
        return "success";
      },
      textContainerUpgrade: async (update: { content?: string }) => {
        textContents.push(update.content!);
        return true;
      },
      onEvenHubEvent: (next: (event: EvenHubEvent) => void) => {
        listener = next;
        return () => undefined;
      },
      shutDownPageContainer: async () => true,
    };

    await transmitLayeredHybridCanvas(
      {} as HTMLCanvasElement,
      "OVERVIEW",
      () => undefined,
      async () => "NAVIGATION",
      {
        waitForBridge: async () => bridge,
        encode: async () => module.G2_TILES.map(({ id }) => new Uint8Array([id])),
      },
    );
    expect(startupPage!.toJson().imageObject?.map(
      ({ zOrderIndex }) => zOrderIndex,
    )).toEqual([1, 2, 3, 4]);
    expect(startupPage!.toJson().textObject?.[0].zOrderIndex).toBe(5);

    listener!({
      sysEvent: { eventType: OsEventTypeList.SCROLL_BOTTOM_EVENT },
    } as EvenHubEvent);
    await vi.waitFor(() => expect(textContents).toHaveLength(2));
    expect(imageIds).toEqual([2, 3, 4, 5]);
    expect(textContents).toEqual(["OVERVIEW", "NAVIGATION"]);
  });

  it("rebuilds layered hybrid Text with the same console geometry", async () => {
    const module = await loadGlasses();
    if (!module) return;
    let rebuiltPage: {
      toJson: () => {
        textObject?: Array<{
          xPosition?: number;
          yPosition?: number;
          width?: number;
          height?: number;
          paddingLength?: number;
          zOrderIndex?: number;
        }>;
      };
    } | undefined;
    const bridge = {
      createStartUpPageContainer: async () => 1,
      rebuildPageContainer: async (page: typeof rebuiltPage) => {
        rebuiltPage = page;
        return true;
      },
      updateImageRawData: async () => "success",
      textContainerUpgrade: async () => true,
      onEvenHubEvent: () => () => undefined,
      shutDownPageContainer: async () => true,
    };

    await module.transmitLayeredHybridCanvas(
      {} as HTMLCanvasElement,
      "OVERVIEW",
      () => undefined,
      async () => "NAVIGATION",
      {
        waitForBridge: async () => bridge,
        encode: async () => module.G2_TILES.map(({ id }) => new Uint8Array([id])),
      },
    );

    expect(rebuiltPage?.toJson().textObject?.[0]).toMatchObject({
      xPosition: 196,
      yPosition: 8,
      width: 372,
      height: 272,
      paddingLength: 8,
      zOrderIndex: 5,
    });
  });

  it("serializes rapid native Text page updates without resending images", async () => {
    const module = await loadGlasses();
    if (!module) return;
    const transmitHybridCanvas = (
      module as unknown as {
        transmitHybridCanvas?: (...args: unknown[]) => Promise<() => void>;
      }
    ).transmitHybridCanvas;
    expect(transmitHybridCanvas).toBeTypeOf("function");
    if (!transmitHybridCanvas) return;

    let listener: ((event: EvenHubEvent) => void) | undefined;
    let blockText = false;
    let activeTextUpdates = 0;
    let maximumActiveTextUpdates = 0;
    let pageNumber = 0;
    const releases: Array<() => void> = [];
    const imageIds: number[] = [];
    const textContents: string[] = [];
    const bridge = {
      createStartUpPageContainer: async () => 0,
      rebuildPageContainer: async () => true,
      updateImageRawData: async (update: { containerID?: number }) => {
        imageIds.push(update.containerID!);
        return "success";
      },
      textContainerUpgrade: async (update: { content?: string }) => {
        textContents.push(update.content!);
        if (!blockText) return true;
        activeTextUpdates += 1;
        maximumActiveTextUpdates = Math.max(
          maximumActiveTextUpdates,
          activeTextUpdates,
        );
        await new Promise<void>((resolve) => {
          releases.push(() => {
            activeTextUpdates -= 1;
            resolve();
          });
        });
        return true;
      },
      onEvenHubEvent: (next: (event: EvenHubEvent) => void) => {
        listener = next;
        return () => undefined;
      },
      shutDownPageContainer: async () => true,
    };

    await transmitHybridCanvas(
      {} as HTMLCanvasElement,
      "INITIAL",
      () => undefined,
      async (direction: string) => `${direction}:${++pageNumber}`,
      {
        waitForBridge: async () => bridge,
        encode: async () => module.G2_TILES.map(({ id }) => new Uint8Array([id])),
      },
    );
    blockText = true;
    listener!({
      sysEvent: { eventType: OsEventTypeList.SCROLL_BOTTOM_EVENT },
    } as EvenHubEvent);
    listener!({
      sysEvent: { eventType: OsEventTypeList.SCROLL_BOTTOM_EVENT },
    } as EvenHubEvent);

    for (let index = 0; index < 2; index += 1) {
      await vi.waitFor(() => expect(releases.length).toBeGreaterThan(0));
      releases.shift()!();
    }
    await vi.waitFor(() => expect(textContents).toHaveLength(3));

    expect(maximumActiveTextUpdates).toBe(1);
    expect(textContents).toEqual(["INITIAL", "next:1", "next:2"]);
    expect(imageIds).toEqual([2, 3, 4, 5]);
  });

  it("updates the same four containers for bottom and top scroll paging", async () => {
    const module = await loadGlasses();
    if (!module) return;

    let listener: ((event: EvenHubEvent) => void) | undefined;
    let createCount = 0;
    let rebuildCount = 0;
    const imageIds: number[] = [];
    const directions: string[] = [];
    const bridge = {
      createStartUpPageContainer: async () => {
        createCount += 1;
        return 0;
      },
      rebuildPageContainer: async () => {
        rebuildCount += 1;
        return true;
      },
      updateImageRawData: async (update: { containerID?: number }) => {
        imageIds.push(update.containerID!);
        return "success";
      },
      onEvenHubEvent: (next: (event: EvenHubEvent) => void) => {
        listener = next;
        return () => undefined;
      },
      shutDownPageContainer: async () => true,
    };

    let encodeAttempt = 0;
    const unsubscribe = await module.transmitCanvas(
      {} as HTMLCanvasElement,
      () => undefined,
      {
        waitForBridge: async () => bridge,
        encode: async () => {
          encodeAttempt += 1;
          return module.G2_TILES.map(({ id }) => new Uint8Array([
            id,
            encodeAttempt,
          ]));
        },
      },
      module.G2_TILES,
      async (direction: string) => {
        directions.push(direction);
      },
    );

    listener!({
      sysEvent: { eventType: OsEventTypeList.SCROLL_BOTTOM_EVENT },
    } as EvenHubEvent);
    await vi.waitFor(() => expect(imageIds).toHaveLength(8));
    listener!({
      textEvent: { eventType: OsEventTypeList.SCROLL_TOP_EVENT },
    } as EvenHubEvent);
    await vi.waitFor(() => expect(imageIds).toHaveLength(12));

    expect(directions).toEqual(["next", "previous"]);
    expect(imageIds).toEqual([
      2, 3, 4, 5,
      2, 3, 4, 5,
      2, 3, 4, 5,
    ]);
    expect(createCount).toBe(1);
    expect(rebuildCount).toBe(0);
    unsubscribe();
  });

  it("drops a rapid scroll while the prior page send is active", async () => {
    const module = await loadGlasses();
    if (!module) return;

    let listener: ((event: EvenHubEvent) => void) | undefined;
    let blockUpdates = false;
    let activeUpdates = 0;
    let maximumActiveUpdates = 0;
    const releases: Array<() => void> = [];
    const imageIds: number[] = [];
    const directions: string[] = [];
    const bridge = {
      createStartUpPageContainer: async () => 0,
      rebuildPageContainer: async () => true,
      updateImageRawData: async (update: { containerID?: number }) => {
        imageIds.push(update.containerID!);
        if (!blockUpdates) return "success";
        activeUpdates += 1;
        maximumActiveUpdates = Math.max(maximumActiveUpdates, activeUpdates);
        await new Promise<void>((resolve) => {
          releases.push(() => {
            activeUpdates -= 1;
            resolve();
          });
        });
        return "success";
      },
      onEvenHubEvent: (next: (event: EvenHubEvent) => void) => {
        listener = next;
        return () => undefined;
      },
      shutDownPageContainer: async () => true,
    };

    let encodeAttempt = 0;
    await module.transmitCanvas(
      {} as HTMLCanvasElement,
      () => undefined,
      {
        waitForBridge: async () => bridge,
        encode: async () => {
          encodeAttempt += 1;
          return module.G2_TILES.map(({ id }) => new Uint8Array([
            id,
            encodeAttempt,
          ]));
        },
      },
      module.G2_TILES,
      async (direction: string) => {
        directions.push(direction);
      },
    );
    blockUpdates = true;

    listener!({
      sysEvent: { eventType: OsEventTypeList.SCROLL_BOTTOM_EVENT },
    } as EvenHubEvent);
    listener!({
      sysEvent: { eventType: OsEventTypeList.SCROLL_BOTTOM_EVENT },
    } as EvenHubEvent);

    for (let index = 0; index < 4; index += 1) {
      await vi.waitFor(() => expect(releases.length).toBeGreaterThan(0));
      releases.shift()!();
    }
    await vi.waitFor(() => expect(imageIds).toHaveLength(8));

    expect(directions).toEqual(["next"]);
    expect(maximumActiveUpdates).toBe(1);
    expect(imageIds).toEqual([
      2, 3, 4, 5,
      2, 3, 4, 5,
    ]);
  });

  it("rebuilds an existing page when startup creation reports invalid", async () => {
    const module = await loadGlasses();
    if (!module) return;

    const calls: string[] = [];
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
      onEvenHubEvent: () => () => undefined,
      shutDownPageContainer: async () => true,
    };

    await module.transmitCanvas(
      {} as HTMLCanvasElement,
      () => undefined,
      {
        waitForBridge: async () => bridge,
        encode: async () => [new Uint8Array([1])],
      },
      module.DIAGNOSTIC_TILES,
    );

    expect(calls).toEqual(["create", "rebuild", "image"]);
  });

  it("sends the unmodified official sample bytes to container 3", async () => {
    const module = await loadGlasses();
    if (!module) return;

    const calls: string[] = [];
    const sample = new Uint8Array([137, 80, 78, 71]);
    const bridge = {
      createStartUpPageContainer: async () => {
        calls.push("create");
        return 0;
      },
      rebuildPageContainer: async () => true,
      updateImageRawData: async (update: {
        containerID?: number;
        imageData?: number[] | string | Uint8Array | ArrayBuffer;
      }) => {
        const firstByte = update.imageData instanceof Uint8Array
          ? update.imageData[0]
          : "unexpected";
        calls.push(`image:${update.containerID}:${firstByte}`);
        return "success";
      },
      textContainerUpgrade: async () => {
        calls.push("status");
        return true;
      },
      onEvenHubEvent: () => () => undefined,
      shutDownPageContainer: async () => true,
    };

    await module.transmitOfficialSample(
      () => undefined,
      {
        waitForBridge: async () => bridge,
        loadBytes: async () => sample,
        waitForPageReady: async () => {
          calls.push("ready");
        },
      } as Parameters<typeof module.transmitOfficialSample>[1],
    );

    expect(calls).toEqual(["create", "ready", "image:3:137", "status"]);
  });

  it("shows text, waits for a click, then sends the hardware-sized BMP", async () => {
    const module = await loadGlasses();
    if (!module) return;

    const calls: string[] = [];
    const bridge = {
      createStartUpPageContainer: async () => {
        calls.push("create");
        return 0;
      },
      rebuildPageContainer: async () => {
        calls.push("rebuild");
        return true;
      },
      updateImageRawData: async (update: {
        containerID?: number;
        imageData?: number[] | string | Uint8Array | ArrayBuffer;
      }) => {
        const bytes = update.imageData as Uint8Array;
        calls.push(`image:${update.containerID}:${bytes[0]}:${bytes[1]}:${bytes.length}`);
        return "success";
      },
      textContainerUpgrade: async (update: { content?: string }) => {
        calls.push(update.content?.includes("CLICK TO SEND") ? "announce" : "status");
        return true;
      },
      onEvenHubEvent: () => () => undefined,
      shutDownPageContainer: async () => true,
    };

    await module.transmitHardwareBmp(
      () => undefined,
      {
        waitForBridge: async () => bridge,
        waitForTrigger: async () => {
          calls.push("click");
        },
      },
    );

    expect(calls).toEqual([
      "create",
      "rebuild",
      "announce",
      "click",
      "image:3:66:77:2862",
      "status",
    ]);
  });
});
