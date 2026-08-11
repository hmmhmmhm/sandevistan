import {
  ImageRawDataUpdate,
  ImageRawDataUpdateResult,
  OsEventTypeList,
  RebuildPageContainer,
  StartUpPageCreateResult,
  TextContainerUpgrade,
  waitForEvenAppBridge,
  type CreateStartUpPageContainer,
  type EvenHubEvent,
} from "@evenrealities/even_hub_sdk";
import type { PageDirection } from "./fast-canvas-transport";
import {
  G2_TILES,
  createContainerObjects,
  createGlassesPage,
  createLayeredContainerObjects,
  createLayeredGlassesPage,
  createOfficialDiagnosticPage,
  encode1BitBmp,
  encodeCanvasTiles,
  sendTilesSequentially,
  type Tile,
} from "./g2-canvas";
import { waitForImageClick } from "./image-trigger";

export {
  DIAGNOSTIC_TILES,
  G2_FAST_TILES,
  G2_TEXT_FIRST_TILES,
  G2_LEFT_TILES,
  G2_RIGHT_TILES,
  G2_RIGHT_TOP_TILES,
  G2_TILES,
  createBlackCanvas,
  createGlassesPage,
  createLayeredGlassesPage,
  createOfficialDiagnosticPage,
  drawHudReference,
  encode1BitBmp,
  encodeCanvasTiles,
  quantizeForG2Pixels,
  sendTilesSequentially,
} from "./g2-canvas";
export {
  transmitCanvas,
} from "./fast-canvas-transport";
export {
  toFastCanvasBattery,
  transmitFastCanvas,
} from "./fast-canvas-session";
export type {
  FastCanvasBattery,
  FastCanvasInput,
  FastCanvasInputResult,
  FastCanvasNativeTextController,
  FastCanvasOptions,
  FastCanvasRawEvent,
  FastCanvasRefreshRequest,
  FastCanvasRefreshTarget,
  PageDirection,
} from "./fast-canvas-transport";

type Bridge = {
  createStartUpPageContainer: (
    page: CreateStartUpPageContainer,
  ) => Promise<unknown>;
  rebuildPageContainer: (page: RebuildPageContainer) => Promise<boolean>;
  updateImageRawData: (update: ImageRawDataUpdate) => Promise<unknown>;
  onEvenHubEvent: (listener: (event: EvenHubEvent) => void) => () => void;
  shutDownPageContainer: (exitMode: number) => Promise<unknown>;
};
type OfficialBridge = Bridge & {
  textContainerUpgrade: (update: TextContainerUpgrade) => Promise<boolean>;
};
type OfficialDependencies = {
  waitForBridge: () => Promise<OfficialBridge>;
  loadBytes: (url: string) => Promise<Uint8Array>;
  waitForPageReady: (milliseconds: number) => Promise<void>;
};
type HardwareBmpDependencies = {
  waitForBridge: () => Promise<OfficialBridge>;
  waitForTrigger: typeof waitForImageClick;
};
type HybridDependencies = {
  waitForBridge: () => Promise<OfficialBridge>;
  encode: typeof encodeCanvasTiles;
};

export async function transmitHybridCanvas(
  source: HTMLCanvasElement,
  initialContent: string,
  onProgress: (message: string) => void,
  onNavigate: (direction: PageDirection) => string | Promise<string>,
  dependencies: HybridDependencies = {
    waitForBridge: waitForEvenAppBridge,
    encode: encodeCanvasTiles,
  },
  tiles: readonly Tile[] = G2_TILES,
  explicitZOrder = false,
) {
  onProgress("하이브리드 안경 페이지 연결 중");
  const bridge = await dependencies.waitForBridge();
  const startupPage = explicitZOrder
    ? createLayeredGlassesPage(tiles)
    : createGlassesPage(tiles, 8);
  const created = StartUpPageCreateResult.normalize(
    await bridge.createStartUpPageContainer(startupPage),
  );
  if (created === StartUpPageCreateResult.invalid) {
    onProgress("기존 하이브리드 페이지 재구성 중");
    const { eventLayer, imageObject } = explicitZOrder
      ? createLayeredContainerObjects(tiles)
      : createContainerObjects(tiles, 8);
    const rebuildFailure = explicitZOrder
      ? "레이어 하이브리드 안경 페이지 재구성 실패"
      : "하이브리드 안경 페이지 재구성 실패";
    const rebuilt = await bridge.rebuildPageContainer(new RebuildPageContainer({
      containerTotalNum: tiles.length + 1,
      textObject: [eventLayer],
      imageObject,
    }));
    if (!rebuilt) throw new Error(rebuildFailure);
  } else if (created !== StartUpPageCreateResult.success) {
    throw new Error(`하이브리드 안경 페이지 생성 실패: ${created}`);
  }

  const encodedTiles = await dependencies.encode(source, undefined, tiles);
  await sendTilesSequentially(encodedTiles, async (bytes, index) => {
    const tile = tiles[index];
    const result = ImageRawDataUpdateResult.normalize(
      await bridge.updateImageRawData(new ImageRawDataUpdate({
        containerID: tile.id,
        containerName: tile.name,
        imageData: bytes,
      })),
    );
    if (!ImageRawDataUpdateResult.isSuccess(result)) {
      throw new Error(`${tile.name} 배경 전송 실패: ${result}`);
    }
    onProgress(`정적 배경 전송 중 ${index + 1}/${tiles.length}`);
  });

  const updateText = async (content: string) => {
    const updated = await bridge.textContainerUpgrade(new TextContainerUpgrade({
      containerID: 1,
      containerName: "eventLayer",
      content,
    }));
    if (!updated) throw new Error("네이티브 HUD 텍스트 전송 실패");
  };
  await updateText(initialContent);
  onProgress("하이브리드 HUD 전송 완료");

  let textQueue = Promise.resolve();
  const queueNavigation = (direction: PageDirection) => {
    textQueue = textQueue
      .then(async () => {
        onProgress("네이티브 페이지 전환 중");
        await updateText(await onNavigate(direction));
        onProgress("네이티브 페이지 전환 완료");
      })
      .catch((error: unknown) => {
        onProgress(error instanceof Error ? error.message : String(error));
      });
  };

  return bridge.onEvenHubEvent((event) => {
    const eventType = event.sysEvent?.eventType
      ?? event.textEvent?.eventType
      ?? null;
    if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      void bridge.shutDownPageContainer(1);
    } else if (eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
      queueNavigation("next");
    } else if (eventType === OsEventTypeList.SCROLL_TOP_EVENT) {
      queueNavigation("previous");
    }
  });
}

export function transmitLayeredHybridCanvas(
  source: HTMLCanvasElement,
  initialContent: string,
  onProgress: (message: string) => void,
  onNavigate: (direction: PageDirection) => string | Promise<string>,
  dependencies: HybridDependencies = {
    waitForBridge: waitForEvenAppBridge,
    encode: encodeCanvasTiles,
  },
  tiles: readonly Tile[] = G2_TILES,
) {
  return transmitHybridCanvas(
    source,
    initialContent,
    onProgress,
    onNavigate,
    dependencies,
    tiles,
    true,
  );
}

export async function transmitOfficialSample(
  onProgress: (message: string) => void,
  dependencies: OfficialDependencies = {
    waitForBridge: waitForEvenAppBridge,
    loadBytes: async (url) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`공식 샘플 로드 실패: ${response.status}`);
      }
      return new Uint8Array(await response.arrayBuffer());
    },
    waitForPageReady: (milliseconds) => new Promise((resolve) => {
      window.setTimeout(resolve, milliseconds);
    }),
  },
) {
  onProgress("공식 Even Hub 이미지 진단 연결 중");
  const bridge = await dependencies.waitForBridge();
  const page = createOfficialDiagnosticPage();
  const created = StartUpPageCreateResult.normalize(
    await bridge.createStartUpPageContainer(page),
  );

  if (created === StartUpPageCreateResult.invalid) {
    const rebuilt = await bridge.rebuildPageContainer(new RebuildPageContainer({
      containerTotalNum: page.containerTotalNum,
      textObject: page.textObject,
      imageObject: page.imageObject,
    }));
    if (!rebuilt) throw new Error("공식 진단 페이지 재구성 실패");
  } else if (created !== StartUpPageCreateResult.success) {
    throw new Error(`공식 진단 페이지 생성 실패: ${created}`);
  }

  await dependencies.waitForPageReady(1000);
  const bytes = await dependencies.loadBytes("/evenhub-official-sample.png");
  const result = ImageRawDataUpdateResult.normalize(
    await bridge.updateImageRawData(new ImageRawDataUpdate({
      containerID: 3,
      containerName: "frame",
      imageData: bytes,
    })),
  );
  if (!ImageRawDataUpdateResult.isSuccess(result)) {
    throw new Error(`공식 sample.png 전송 실패: ${result}`);
  }
  await bridge.textContainerUpgrade(new TextContainerUpgrade({
    containerID: 2,
    containerName: "status",
    content: "Official sample rendered",
  }));
  onProgress("공식 sample.png 전송 완료");

  return bridge.onEvenHubEvent((event) => {
    const systemEvent = event.sysEvent?.eventType ?? null;
    const textEvent = event.textEvent?.eventType ?? null;
    if (
      systemEvent === OsEventTypeList.DOUBLE_CLICK_EVENT
      || textEvent === OsEventTypeList.DOUBLE_CLICK_EVENT
    ) {
      void bridge.shutDownPageContainer(1);
    }
  });
}

export async function transmitHardwareBmp(
  onProgress: (message: string) => void,
  dependencies: HardwareBmpDependencies = {
    waitForBridge: waitForEvenAppBridge,
    waitForTrigger: waitForImageClick,
  },
) {
  onProgress("실기기 검증 BMP 페이지 준비 중");
  const bridge = await dependencies.waitForBridge();
  const page = createOfficialDiagnosticPage();
  const created = StartUpPageCreateResult.normalize(
    await bridge.createStartUpPageContainer(page),
  );
  if (
    created !== StartUpPageCreateResult.success
    && created !== StartUpPageCreateResult.invalid
  ) {
    throw new Error(`BMP 시작 페이지 생성 실패: ${created}`);
  }
  const rebuilt = await bridge.rebuildPageContainer(new RebuildPageContainer({
    containerTotalNum: page.containerTotalNum,
    textObject: page.textObject,
    imageObject: page.imageObject,
  }));
  if (!rebuilt) throw new Error("BMP 이미지 페이지 재구성 실패");

  const announced = await bridge.textContainerUpgrade(new TextContainerUpgrade({
    containerID: 2,
    containerName: "status",
    content: "TEXT READY - CLICK TO SEND",
  }));
  if (!announced) throw new Error("BMP 사전 텍스트 표시 실패");
  onProgress("안경 클릭 대기 중");
  await dependencies.waitForTrigger(bridge);
  const pixels = Uint8Array.from({ length: 200 * 100 }, (_, index) => {
    const x = index % 200;
    const y = Math.floor(index / 200);
    return (Math.floor(x / 12) + Math.floor(y / 12)) % 2 === 0 ? 1 : 0;
  });
  const bytes = encode1BitBmp(200, 100, pixels);
  const result = ImageRawDataUpdateResult.normalize(
    await bridge.updateImageRawData(new ImageRawDataUpdate({
      containerID: 3,
      containerName: "frame",
      imageData: bytes,
    })),
  );
  if (!ImageRawDataUpdateResult.isSuccess(result)) {
    throw new Error(`1-bit BMP 전송 실패: ${result}`);
  }
  await bridge.textContainerUpgrade(new TextContainerUpgrade({
    containerID: 2,
    containerName: "status",
    content: "1-bit BMP rendered",
  }));
  onProgress("1-bit BMP 전송 완료");
  return bridge.onEvenHubEvent(() => undefined);
}
