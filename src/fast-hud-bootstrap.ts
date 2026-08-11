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

export async function stopIdleSdkSensors(bridge: PowerBridge): Promise<void> {
  await Promise.allSettled([
    bridge.audioControl?.(false),
    bridge.imuControl?.(false),
    bridge.stopAppLocationUpdates?.(),
  ]);
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

  await Promise.all([
    stopIdleSdkSensors(bridge),
    preferences?.then(options.onPreferences),
  ]);
  options.onSensors?.({
    // The host returns false when a control is already idle. Since this app
    // never starts a sensor before this point, both true and false mean that
    // its own stream is off; true only confirms that a close command ran.
    microphone: "off",
    imu: "off",
    location: "off",
  });
  if (storage) options.onStorage(storage);
  return bridge;
}
