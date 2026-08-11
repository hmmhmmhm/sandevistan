import {
  DeviceModel,
  waitForEvenAppBridge,
  type DeviceInfo,
} from "@evenrealities/even_hub_sdk";
import {
  G2_FAST_TILES,
  G2_LEFT_TILES,
  G2_RIGHT_TILES,
  G2_RIGHT_TOP_TILES,
  createBlackCanvas,
  encodeCanvasTiles,
} from "./g2-canvas";
import { transmitCanvas } from "./fast-canvas-transport";
import type {
  Bridge,
  FastCanvasBattery,
  FastCanvasOptions,
  PageDirection,
  TransportDependencies,
} from "./fast-canvas-types";

export function toFastCanvasBattery(
  device: DeviceInfo | null | undefined,
): FastCanvasBattery | undefined {
  if (!device) return undefined;
  const label = device.model === DeviceModel.Ring1
    ? "R1"
    : device.model === DeviceModel.G2
      ? "G2"
      : "G1";
  return {
    label,
    level: device.status.batteryLevel,
    charging: device.status.isCharging,
  };
}

function isSameFastCanvasBattery(
  left: FastCanvasBattery | undefined,
  right: FastCanvasBattery | undefined,
): boolean {
  return left?.label === right?.label
    && left?.level === right?.level
    && left?.charging === right?.charging;
}

export async function transmitFastCanvas(
  source: HTMLCanvasElement,
  onProgress: (message: string) => void,
  onNavigate: (direction: PageDirection) => void | Promise<void>,
  options: FastCanvasOptions = {},
) {
  const baseDependencies = options.dependencies ?? {
    waitForBridge: waitForEvenAppBridge,
    encode: encodeCanvasTiles,
  };
  let connectedBridge: Bridge | undefined;
  let deviceInfo: DeviceInfo | null | undefined;
  let lastBattery: FastCanvasBattery | undefined;
  const dependencies: TransportDependencies = {
    ...baseDependencies,
    waitForBridge: async () => {
      const bridge = await baseDependencies.waitForBridge();
      connectedBridge = bridge;
      if (options.onBattery) {
        try {
          deviceInfo = await bridge.getDeviceInfo?.();
          lastBattery = toFastCanvasBattery(deviceInfo);
          options.onBattery(lastBattery);
        } catch {
          deviceInfo = undefined;
          lastBattery = undefined;
          options.onBattery(undefined);
        }
      }
      return bridge;
    },
  };
  const now = options.now ?? Date.now;
  const transportCleanup = await transmitCanvas(
    source,
    onProgress,
    dependencies,
    G2_FAST_TILES,
    onNavigate,
    G2_RIGHT_TILES,
    {
      createHiddenSource: options.createHiddenSource ?? createBlackCanvas,
      beforeRestore: options.beforeRestore,
    },
    {
      beforeExternalRefresh: options.beforeExternalRefresh,
      onRefreshReady: options.onRefreshReady,
      onNativeTextReady: options.onNativeTextReady,
      targetTiles: {
        all: G2_FAST_TILES,
        left: G2_LEFT_TILES,
        right: G2_RIGHT_TILES,
        "right-top": G2_RIGHT_TOP_TILES,
      },
    },
    options.onInput,
    options.onRawEvent,
    () => options.onDisplayCommitted?.(Math.floor(now() / 60_000)),
    options.imageSendConcurrency ?? 1,
    options.tilePaletteMode ?? "original",
    options.tileImageFormat ?? "png",
    options.displayHideStrategy ?? "blank-rebuild",
    options.onDisplayVisibilityChange,
  );
  let cleaned = false;
  let unsubscribeDeviceStatus: (() => void) | undefined;
  if (deviceInfo && connectedBridge?.onDeviceStatusChanged) {
    try {
      unsubscribeDeviceStatus = connectedBridge.onDeviceStatusChanged(
        (status) => {
          if (
            cleaned
            || status.sn !== deviceInfo?.sn
            || !lastBattery
          ) {
            return;
          }
          const nextBattery: FastCanvasBattery = {
            label: lastBattery.label,
            level: status.batteryLevel ?? lastBattery.level,
            charging: status.isCharging ?? lastBattery.charging,
          };
          if (isSameFastCanvasBattery(lastBattery, nextBattery)) return;
          lastBattery = nextBattery;
          options.onBattery?.(nextBattery);
        },
      );
    } catch {
      unsubscribeDeviceStatus = undefined;
    }
  }

  return () => {
    if (cleaned) return;
    cleaned = true;
    unsubscribeDeviceStatus?.();
    transportCleanup();
  };
}
