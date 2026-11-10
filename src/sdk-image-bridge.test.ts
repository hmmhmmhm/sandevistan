// @vitest-environment jsdom

import {
  EvenAppBridge,
  ImageRawDataUpdate,
  ImageRawDataUpdateResult,
} from "@evenrealities/even_hub_sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

type FlutterBridgeWindow = Window & {
  flutter_inappwebview?: {
    callHandler: (...args: unknown[]) => Promise<unknown>;
  };
};

afterEach(() => {
  delete (window as FlutterBridgeWindow).flutter_inappwebview;
});

describe("Even Hub SDK image bridge", () => {
  it("forwards the 0.0.16 image contract to the host handler", async () => {
    const callHandler = vi.fn(async (..._args: unknown[]) => 0);
    (window as FlutterBridgeWindow).flutter_inappwebview = { callHandler };

    const result = await EvenAppBridge.getInstance().updateImageRawData(
      new ImageRawDataUpdate({
        containerID: 3,
        containerName: "frame",
        imageData: new Uint8Array([1, 2, 3]),
      }),
    );

    expect(result).toBe(ImageRawDataUpdateResult.success);
    expect(callHandler).toHaveBeenCalledTimes(1);
    expect(callHandler.mock.calls[0]?.[0]).toBe("evenAppMessage");
    expect(JSON.parse(String(callHandler.mock.calls[0]?.[1]))).toEqual({
      type: "call_even_app_method",
      method: "updateImageRawData",
      data: {
        containerID: 3,
        containerName: "frame",
        imageData: [1, 2, 3],
        compressMode: 2,
      },
    });
  });
});
