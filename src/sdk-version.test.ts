import { describe, expect, it } from "vitest";
import { ImageRawDataUpdate } from "@evenrealities/even_hub_sdk";
import appManifest from "../app.json";
import packageManifest from "../package.json";

describe("Even Hub SDK compatibility", () => {
  it("pins the stable 0.0.11 fallback and its minimum Even App version", () => {
    const installed = packageManifest.dependencies["@evenrealities/even_hub_sdk"];

    expect(installed).toBe("0.0.11");
    expect(appManifest.min_sdk_version).toBe(installed);
    expect(appManifest.min_app_version).toBe("2.2.6");
    expect(packageManifest.scripts.qr).toBe(
      'evenhub qr --url "http://100.127.255.11:4179/"',
    );
  });

  it("omits the unstable compressed-image transport flag", () => {
    const payload = new ImageRawDataUpdate({
      containerID: 3,
      containerName: "frame",
      imageData: new Uint8Array([1, 2, 3]),
    }).toJson();

    expect(payload).toEqual({
      containerID: 3,
      containerName: "frame",
      imageData: [1, 2, 3],
    });
  });

  it("declares the scoped G2 microphone and OpenAI network permissions", () => {
    const permissions = appManifest.permissions as Array<{
      name: string;
      whitelist?: string[];
    }>;
    expect(permissions.some(({ name }) => name === "g2-microphone")).toBe(true);
    expect(permissions.find(({ name }) => name === "network")?.whitelist)
      .toEqual(expect.arrayContaining([
        "https://api.openai.com",
        "wss://api.openai.com",
      ]));
  });

  it("uses only language codes accepted by the Even Hub manifest", () => {
    expect(appManifest.supported_languages).toEqual([
      "en", "de", "fr", "es", "it", "zh", "ja", "ko",
    ]);
  });

  it("uses one canonical hardware QR URL on the promoted SDK", () => {
    const scripts = packageManifest.scripts as Record<string, string>;
    const qrScripts = Object.values(scripts).filter((script) => (
      script.includes("evenhub qr")
    ));

    expect(qrScripts).toEqual([
      'evenhub qr --url "http://100.127.255.11:4179/"',
    ]);
  });
});
