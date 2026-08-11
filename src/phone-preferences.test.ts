import { describe, expect, it } from "vitest";
import type { EvenStorage } from "./live-cache";
import {
  DEFAULT_PHONE_PREFERENCES,
  normalizePhonePreferences,
  resolvePhonePreferences,
  writePhonePreferences,
} from "./phone-preferences";

class TestStorage implements EvenStorage {
  readonly values = new Map<string, string>();
  readonly writes: Array<[string, string]> = [];

  async getLocalStorage(key: string): Promise<string> {
    return this.values.get(key) ?? "";
  }

  async setLocalStorage(key: string, value: string): Promise<boolean> {
    this.writes.push([key, value]);
    this.values.set(key, value);
    return true;
  }
}

describe("phone preferences", () => {
  it("uses the approved keyless layout by default", () => {
    expect(DEFAULT_PHONE_PREFERENCES).toEqual({
      locale: "system",
      order: ["overview", "news", "x", "todo", "weather", "ai", "conversate"],
      enabled: ["overview", "news", "x", "todo", "weather", "ai", "conversate"],
      aiTextIntervalMs: 200,
      dashboardMapEnabled: true,
    });
  });

  it("keeps Overview first and removes unavailable Navigation", () => {
    expect(normalizePhonePreferences({
      locale: "ko",
      order: ["news", "overview", "navigation", "news", "todo"],
      enabled: ["news", "navigation", "todo"],
    }, false)).toEqual({
      locale: "ko",
      order: ["overview", "news", "x", "todo", "weather", "ai", "conversate"],
      enabled: ["overview", "news", "x", "todo", "weather", "ai", "conversate"],
      aiTextIntervalMs: 200,
      dashboardMapEnabled: true,
    });
  });

  it("adds validated Navigation as an available but disabled page", () => {
    expect(normalizePhonePreferences(DEFAULT_PHONE_PREFERENCES, true)).toEqual({
      locale: "system",
      order: ["overview", "news", "x", "todo", "weather", "ai", "conversate", "navigation"],
      enabled: ["overview", "news", "x", "todo", "weather", "ai", "conversate"],
      aiTextIntervalMs: 200,
      dashboardMapEnabled: true,
    });
  });

  it("adds Navigation when storage is empty and a local key is available", async () => {
    const storage = new TestStorage();

    await expect(resolvePhonePreferences(storage, true)).resolves.toEqual({
      locale: "system",
      order: ["overview", "news", "x", "todo", "weather", "ai", "conversate", "navigation"],
      enabled: ["overview", "news", "x", "todo", "weather", "ai", "conversate"],
      aiTextIntervalMs: 200,
      dashboardMapEnabled: true,
    });
  });

  it("restores and persists a valid layout using the versioned cache key", async () => {
    const storage = new TestStorage();
    const saved = {
      locale: "en",
      order: ["overview", "weather", "news", "todo"],
      enabled: ["overview", "weather", "todo"],
    } as const;
    storage.values.set(
      "sandevistan:phone-preferences:v1",
      JSON.stringify(saved),
    );

    await expect(resolvePhonePreferences(storage, false)).resolves.toEqual({
      ...saved,
      order: [...saved.order, "ai", "conversate", "x"],
      enabled: [...saved.enabled, "ai", "conversate", "x"],
      aiTextIntervalMs: 200,
      dashboardMapEnabled: true,
    });
    await expect(writePhonePreferences(storage, {
      ...saved,
      aiTextIntervalMs: 200,
      dashboardMapEnabled: true,
    })).resolves.toBe(true);
    expect(storage.writes.at(-1)?.[0])
      .toBe("sandevistan:phone-preferences:v1");
  });

  it("normalizes the Ask AI text interval to safe 50ms steps", () => {
    expect(normalizePhonePreferences({
      ...DEFAULT_PHONE_PREFERENCES,
      aiTextIntervalMs: 376,
    }, false).aiTextIntervalMs).toBe(400);
    expect(normalizePhonePreferences({
      ...DEFAULT_PHONE_PREFERENCES,
      aiTextIntervalMs: 5000,
    }, false).aiTextIntervalMs).toBe(1000);
  });
});
