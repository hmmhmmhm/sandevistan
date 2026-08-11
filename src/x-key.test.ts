import { describe, expect, it } from "vitest";
import type { EvenStorage } from "./live-cache";
import {
  clearXRelayUrl,
  DEFAULT_X_RELAY_URL,
  resolveXRelayUrl,
  writeXRelayUrl,
} from "./x-key";

class TestStorage implements EvenStorage {
  readonly values = new Map<string, string>();

  async getLocalStorage(key: string) { return this.values.get(key) ?? ""; }
  async setLocalStorage(key: string, value: string) { this.values.set(key, value); return true; }
}

describe("X relay settings", () => {
  it("uses the bundled X-only relay until a custom relay is explicitly saved", async () => {
    const storage = new TestStorage();
    await expect(resolveXRelayUrl(storage)).resolves.toBe(DEFAULT_X_RELAY_URL);
    await expect(writeXRelayUrl(storage, "https://my-x-relay.workers.dev/")).resolves.toBe(true);
    await expect(resolveXRelayUrl(storage)).resolves.toBe("https://my-x-relay.workers.dev");
    await expect(clearXRelayUrl(storage)).resolves.toBe(true);
    await expect(resolveXRelayUrl(storage)).resolves.toBe(DEFAULT_X_RELAY_URL);
  });
});
