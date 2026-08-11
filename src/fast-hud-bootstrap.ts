import { waitForEvenAppBridge } from "@evenrealities/even_hub_sdk";
import type { EvenStorage } from "./live-cache";
import { resolvePhonePreferences } from "./phone-preferences";
import type { PhonePreferences, SensorStatus } from "./phone-types";

export type FastHudBridge = Awaited<
  ReturnType<typeof waitForEvenAppBridge>
>;

type PowerBridge = {
  audioControl?(isOpen: boolean): Promise<boolean>;
  imuControl?(isOpen: boolean): Promise<boolean>;
  stopAppLocationUpdates?(): Promise<boolean>;
};

function asStorage(bridge: FastHudBridge): EvenStorage | undefined {
  return typeof bridge.getLocalStorage === "function"
    && typeof bridge.setLocalStorage === "function"
    ? bridge
    : undefined;
}

export async function stopIdleSdkSensors(bridge: PowerBridge): Promise<{
  readonly microphone: boolean;
  readonly imu: boolean;
  readonly location: boolean;
}> {
  const [microphone, imu, location] = await Promise.all([
    bridge.audioControl?.(false).catch(() => false) ?? Promise.resolve(false),
    bridge.imuControl?.(false).catch(() => false) ?? Promise.resolve(false),
    bridge.stopAppLocationUpdates?.().catch(() => false) ?? Promise.resolve(false),
  ]);
  return { microphone, imu, location };
}

export async function prepareFastHudBridge(options: {
  readonly onPreferences: (value: PhonePreferences) => void;
  readonly onStorage: (value: EvenStorage) => void;
  readonly onSensors?: (value: SensorStatus) => void;
}): Promise<FastHudBridge> {
  const bridge = await waitForEvenAppBridge();
  const storage = asStorage(bridge);
  const preferences = storage
    ? resolvePhonePreferences(storage, false)
    : undefined;

  const [stopped] = await Promise.all([
    stopIdleSdkSensors(bridge),
    preferences?.then(options.onPreferences),
  ]);
  options.onSensors?.({
    microphone: stopped.microphone ? "off" : "unknown",
    imu: stopped.imu ? "off" : "unknown",
    location: stopped.location ? "off" : "unknown",
  });
  if (storage) options.onStorage(storage);
  return bridge;
}
