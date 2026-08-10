import {
  ImageRawDataUpdate,
  ImageRawDataUpdateResult,
  OsEventTypeList,
  RebuildPageContainer,
  StartUpPageCreateResult,
  waitForEvenAppBridge,
} from "@evenrealities/even_hub_sdk";
import {
  G2_TILES,
  createContainerObjects,
  createGlassesPage,
  encodeCanvasTiles,
  type Tile,
} from "./g2-canvas";
import { runBounded } from "./bounded-task-pool";
import { bytesEqual } from "./bytes-equal";
import { diagnosticDuration, diagnosticError, diagnosticNow } from "./diagnostic-timing";
import { logDiagnostic } from "./diagnostic-log";
import { formatG2TileEncodingDiagnostic, type G2TilePaletteMode } from "./g2-tile-palette";
import type { G2TileImageFormat } from "./g2-tile-format";
import {
  createBlankDisplayPage,
  createImageDisplayPage,
  type G2DisplayHideStrategy,
} from "./g2-display-hide";
import type { ImageSendConcurrency } from "./image-send-concurrency";
import { waitForTileSend } from "./image-send-timeout";
import { createFastNativeAiTextController } from "./fast-native-ai-text-transport";
import { fastRefreshDropReason } from "./fast-refresh-guard";
import { TRANSPORT_STATUS } from "./transport-status";
import { createFastCanvasScheduler } from "./fast-canvas-scheduler";
import { createFastRefreshHealth } from "./fast-refresh-health";
import type {
  Bridge,
  DisplayToggle,
  ExternalRefresh,
  FastCanvasInput,
  FastCanvasInputResult,
  FastCanvasRawEvent,
  FastCanvasRefreshRequest,
  FastCanvasRefreshTarget,
  PageDirection,
  TransportDependencies,
} from "./fast-canvas-types";
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
} from "./fast-canvas-types";
export async function transmitCanvas(
  source: HTMLCanvasElement,
  onProgress: (message: string) => void,
  dependencies: TransportDependencies = {
    waitForBridge: waitForEvenAppBridge,
    encode: encodeCanvasTiles,
  },
  tiles: readonly Tile[] = G2_TILES,
  onNavigate?: (direction: PageDirection) => void | Promise<void>,
  navigationTiles: readonly Tile[] = tiles,
  displayToggle?: DisplayToggle,
  externalRefresh?: ExternalRefresh,
  onInput?: (
    input: FastCanvasInput,
  ) => FastCanvasInputResult | Promise<FastCanvasInputResult>,
  onRawEvent?: (event: FastCanvasRawEvent) => void,
  onDisplayCommitted?: () => void,
  imageSendConcurrency: ImageSendConcurrency = 1,
  tilePaletteMode: G2TilePaletteMode = "original",
  tileImageFormat: G2TileImageFormat = "png",
  displayHideStrategy: G2DisplayHideStrategy = "blank-rebuild",
) {
  onProgress(TRANSPORT_STATUS.preparing);
  const bridge = await dependencies.waitForBridge();
  onProgress(TRANSPORT_STATUS.preparing);
  const created = StartUpPageCreateResult.normalize(
    await bridge.createStartUpPageContainer(createGlassesPage(tiles)),
  );
  if (created === StartUpPageCreateResult.invalid) {
    onProgress(TRANSPORT_STATUS.preparing);
    const { eventLayer, imageObject } = createContainerObjects(tiles);
    const rebuilt = await bridge.rebuildPageContainer(new RebuildPageContainer({
      containerTotalNum: tiles.length + 1,
      textObject: [eventLayer],
      imageObject,
    }));
    if (!rebuilt) throw new Error("Existing glasses page rebuild failed");
  } else if (created !== StartUpPageCreateResult.success) {
    throw new Error(`Glasses page creation failed: ${created}`);
  }

  const lastSuccessfulTilePayload = new Map<number, Uint8Array>();
  const refreshHealth = createFastRefreshHealth();
  const sendImages = async (
    imageSource: HTMLCanvasElement,
    targetTiles: readonly Tile[],
    completionMessage: string,
    shouldContinue: () => boolean = () => true,
    paletteMode: G2TilePaletteMode = tilePaletteMode,
    imageFormat: G2TileImageFormat = tileImageFormat,
  ) => {
    if (!shouldContinue()) {
      logDiagnostic("REFRESH", "image refresh skipped before encode");
      return;
    }
    const refreshStartedAt = diagnosticNow();
    const encodeStartedAt = diagnosticNow();
    logDiagnostic("ENCODE", `start · ${targetTiles.length} tiles`);
    let encodedTiles: Uint8Array[];
    try {
      encodedTiles = await dependencies.encode(
        imageSource,
        undefined,
        targetTiles,
        { format: imageFormat, paletteMode },
      );
      logDiagnostic(
        "ENCODE",
        formatG2TileEncodingDiagnostic(encodedTiles, paletteMode, imageFormat),
        diagnosticDuration(encodeStartedAt),
      );
    } catch (error) {
      logDiagnostic(
        "ERROR",
        `encode failed · ${diagnosticError(error)}`,
        diagnosticDuration(encodeStartedAt),
      );
      throw error;
    }
    if (!shouldContinue()) return;
    let sentCount = 0;
    let skippedCount = 0;
    let activeImageSends = 0;
    await runBounded(
      encodedTiles,
      imageSendConcurrency,
      async (bytes, index) => {
        if (!shouldContinue()) return;
        const tile = targetTiles[index];
        if (bytesEqual(lastSuccessfulTilePayload.get(tile.id), bytes)) {
          skippedCount += 1;
          logDiagnostic("TILE", `${tile.name} skipped · unchanged`);
          return;
        }
        const tileStartedAt = diagnosticNow();
        activeImageSends += 1;
        logDiagnostic(
          "TILE",
          `${tile.name} start · ${index + 1}/${targetTiles.length}`
            + ` · inflight ${activeImageSends}/${imageSendConcurrency}`,
        );
        try {
          let result: ImageRawDataUpdateResult;
          try {
            result = ImageRawDataUpdateResult.normalize(
              await waitForTileSend(
                bridge.updateImageRawData(new ImageRawDataUpdate({
                  containerID: tile.id,
                  containerName: tile.name,
                  imageData: bytes,
                })),
                tile.name,
              ),
            );
          } catch (error) {
            logDiagnostic(
              "ERROR",
              `${tile.name} send threw · ${diagnosticError(error)}`,
              diagnosticDuration(tileStartedAt),
            );
            throw error;
          }
          if (!ImageRawDataUpdateResult.isSuccess(result)) {
            logDiagnostic(
              "ERROR",
              `${tile.name} failed · ${String(result)}`,
              diagnosticDuration(tileStartedAt),
            );
            throw new Error(`${tile.name} send failed: ${result}`);
          }
          logDiagnostic(
            "TILE",
            `${tile.name} success`,
            diagnosticDuration(tileStartedAt),
          );
          lastSuccessfulTilePayload.set(tile.id, bytes.slice());
          sentCount += 1;
          onProgress(TRANSPORT_STATUS.active);
        } finally {
          activeImageSends -= 1;
        }
      },
    );
    if (!shouldContinue()) return;
    logDiagnostic(
      "REFRESH",
      `image refresh complete · sent ${sentCount} · skipped ${skippedCount}`,
      diagnosticDuration(refreshStartedAt),
    );
    onProgress(completionMessage);
    try {
      onDisplayCommitted?.();
    } catch (error) {
      logDiagnostic(
        "ERROR",
        `display commit callback failed · ${diagnosticError(error)}`,
      );
    }
  };
  const refreshImages = (...args: Parameters<typeof sendImages>) =>
    refreshHealth.run(() => sendImages(...args));
  await refreshImages(source, tiles, TRANSPORT_STATUS.active);
  let disposed = false, hidden = false;
  let hiddenSource: HTMLCanvasElement | undefined;
  const nativeText = createFastNativeAiTextController({
    bridge, tiles,
    waitForImagePageReady: dependencies.waitForPageReady,
    invalidateImages: () => lastSuccessfulTilePayload.clear(),
    restoreImages: () => refreshImages(source, tiles, TRANSPORT_STATUS.active),
    onFailure: (operation) => {
      logDiagnostic("ERROR", `native AI text ${operation} failed`);
    },
  });
  const performNavigation = async (direction: PageDirection) => {
    if (!onNavigate || hidden || disposed) return;
    onProgress(TRANSPORT_STATUS.active);
    logDiagnostic("REFRESH", `page ${direction} prepare`);
    await onNavigate(direction);
    if (disposed) return;
    try {
      await refreshImages(source, navigationTiles, TRANSPORT_STATUS.active);
      logDiagnostic("REFRESH", `page ${direction} commit`);
    } catch (error) {
      const rollbackDirection = direction === "next" ? "previous" : "next";
      try {
        await onNavigate(rollbackDirection);
        logDiagnostic(
          "REFRESH",
          `page ${direction} rollback · ${rollbackDirection}`,
        );
      } catch (rollbackError) {
        logDiagnostic(
          "ERROR",
          `page ${direction} rollback failed · ${
            diagnosticError(rollbackError)
          }`,
        );
      }
      throw error;
    }
  };
  const performDisplayToggle = async () => {
    if (disposed) return;
    if (!displayToggle) {
      await bridge.shutDownPageContainer(1);
      logDiagnostic("REFRESH", "shutdown complete");
      return;
    }
    if (hidden) {
      logDiagnostic("REFRESH", "restore start");
      onProgress(TRANSPORT_STATUS.active);
      await displayToggle.beforeRestore?.();
      if (disposed) return;
      if (displayHideStrategy === "blank-rebuild") {
        const rebuildStartedAt = diagnosticNow();
        const rebuilt = await bridge.rebuildPageContainer(
          createImageDisplayPage(tiles),
        );
        if (!rebuilt) throw new Error("Glasses page restore rebuild failed");
        logDiagnostic(
          "REFRESH",
          "restore page rebuild success",
          diagnosticDuration(rebuildStartedAt),
        );
        lastSuccessfulTilePayload.clear();
      }
      await refreshImages(source, tiles, TRANSPORT_STATUS.active);
      hidden = false;
      logDiagnostic("REFRESH", "restore complete");
    } else {
      if (displayHideStrategy === "blank-rebuild") {
        logDiagnostic("REFRESH", "hide start · strategy blank-rebuild");
        onProgress(TRANSPORT_STATUS.active);
        const rebuildStartedAt = diagnosticNow();
        const rebuilt = await bridge.rebuildPageContainer(
          createBlankDisplayPage(),
        );
        if (!rebuilt) throw new Error("Blank glasses page rebuild failed");
        logDiagnostic(
          "REFRESH",
          "blank rebuild success",
          diagnosticDuration(rebuildStartedAt),
        );
        lastSuccessfulTilePayload.clear();
        hidden = true;
        onProgress(TRANSPORT_STATUS.active);
        logDiagnostic("REFRESH", "hide complete");
        return;
      }
      logDiagnostic("REFRESH", "hide start");
      onProgress(TRANSPORT_STATUS.active);
      await refreshImages(
        hiddenSource ??= displayToggle.createHiddenSource(),
        tiles,
        TRANSPORT_STATUS.active,
        undefined, "original", "png",
      );
      hidden = true;
      logDiagnostic("REFRESH", "hide complete");
    }
  };
  const performInput = async (
    input: FastCanvasInput,
    fallback?: () => void | Promise<void>,
  ) => {
    if (disposed) return;
    if (hidden) {
      if (input === "double-tap") await performDisplayToggle();
      return;
    }
    const result = await onInput?.(input) ?? "unhandled";
    logDiagnostic("INPUT", `${input} result · ${result}`);
    if (disposed) return;
    if (result === "redraw") {
      await refreshImages(source, tiles, TRANSPORT_STATUS.active);
    } else if (result === "unhandled") {
      await fallback?.();
    }
  };
  const scheduler = createFastCanvasScheduler({
    externalDropReason: () => fastRefreshDropReason({
      available: Boolean(externalRefresh), disposed, hidden,
      nativeText: nativeText?.active() ?? false,
      degraded: refreshHealth.degraded(),
    }),
    onError: onProgress,
    performExternal: async (target) => {
      onProgress(TRANSPORT_STATUS.active);
      await externalRefresh!.beforeExternalRefresh?.();
      if (hidden || disposed) return;
      await refreshImages(
        source,
        externalRefresh!.targetTiles[target],
        TRANSPORT_STATUS.active,
        () => !disposed && !hidden,
      );
    },
  });
  const handleInput = (
    input: FastCanvasInput,
    fallback?: () => void | Promise<void>,
  ) => {
    if (disposed || (hidden && input !== "double-tap")) {
      logDiagnostic(
        "INPUT",
        `${input} ignored · ${disposed ? "disposed" : "hidden"}`,
      );
      return;
    }
    scheduler.enqueueInput({
      label: `input ${input}`,
      run: () => performInput(input, fallback),
    });
  };
  const requestExternalRefresh: FastCanvasRefreshRequest =
    scheduler.enqueueExternal;
  let eventCount = 0;
  const sdkUnsubscribe = bridge.onEvenHubEvent((event) => {
    if (disposed) return;
    if (!event.sysEvent && !event.textEvent) return;
    eventCount += 1;
    logDiagnostic(
      "INPUT",
      `raw #${eventCount} · hidden=${hidden}`
        + ` · sys=${event.sysEvent?.eventType ?? "omitted"}`
        + ` · text=${event.textEvent?.eventType ?? "omitted"}`
        + ` · source=${event.sysEvent?.eventSource ?? "omitted"}`,
    );
    try {
      onRawEvent?.(Object.freeze({
        count: eventCount,
        hidden,
        sysEventType: event.sysEvent?.eventType,
        textEventType: event.textEvent?.eventType,
        eventSource: event.sysEvent?.eventSource,
      }));
    } catch {
      // Phone-only diagnostics must not break glasses input.
    }
    const eventType = event.sysEvent
      ? event.sysEvent.eventType ?? OsEventTypeList.CLICK_EVENT
      : event.textEvent
        ? event.textEvent.eventType ?? OsEventTypeList.CLICK_EVENT
        : null;
    if (eventType === OsEventTypeList.CLICK_EVENT) {
      handleInput("tap");
    } else if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      handleInput("double-tap", performDisplayToggle);
    } else if (eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
      handleInput("scroll-next", () => performNavigation("previous"));
    } else if (eventType === OsEventTypeList.SCROLL_TOP_EVENT) {
      handleInput("scroll-previous", () => performNavigation("next"));
    }
  });
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    scheduler.dispose();
    nativeText?.dispose();
    sdkUnsubscribe();
  };
  try {
    if (nativeText) externalRefresh?.onNativeTextReady?.(nativeText);
    externalRefresh?.onRefreshReady?.(requestExternalRefresh);
  } catch (error) {
    dispose();
    throw error;
  }
  return dispose;
}
