import { describe, expect, it } from "vitest";
import type { EvenStorage } from "./live-cache";
import {
  clearSonioxKey,
  maskSonioxKey,
  resolveSonioxKey,
  validateSonioxKey,
  writeSonioxKey,
} from "./soniox-key";

class TestStorage implements EvenStorage {
  readonly values = new Map<string, string>();
  async getLocalStorage(key: string) { return this.values.get(key) ?? ""; }
  async setLocalStorage(key: string, value: string) { this.values.set(key, value); return true; }
}

const KEY = "soniox_test_1234567890abcdefghijklmnop";

describe("Soniox BYOK helpers", () => {
  it("validates, masks, and keeps the key in its own local storage entry", async () => {
    expect(validateSonioxKey("")).toEqual({ ok: false, code: "empty" });
    expect(validateSonioxKey("short")).toEqual({ ok: false, code: "length" });
    expect(validateSonioxKey(`${KEY}\n`).ok).toBe(true);
    expect(maskSonioxKey(KEY)).toBe("soni••••mnop");
    const storage = new TestStorage();
    await expect(writeSonioxKey(storage, KEY)).resolves.toBe(true);
    await expect(resolveSonioxKey(storage)).resolves.toBe(KEY);
    await expect(clearSonioxKey(storage)).resolves.toBe(true);
    await expect(resolveSonioxKey(storage)).resolves.toBeUndefined();
    expect([...storage.values.keys()]).toEqual(["sandevistan:soniox-key:v1"]);
  });
});
