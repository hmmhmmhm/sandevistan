// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { AppLocation, AppLocationOptions } from "@evenrealities/even_hub_sdk";
import {
  createLiveDashboardSession,
  type LiveDashboardUpdate,
} from "./live-dashboard";
import type { LocationBridge } from "./location";

const SAVED_TODOS = [
  { id: "coffee", title: "커피 사기", completed: false },
  { id: "train", title: "열차 타기", completed: true },
] as const;

class TodoBridge implements LocationBridge {
  readonly values = new Map<string, string>();
  readonly writes: Array<[string, string]> = [];

  constructor(private readonly failWrites = false) {}

  async getAppLocation(_options?: AppLocationOptions): Promise<AppLocation | null> {
    return null;
  }

  async getLocalStorage(key: string): Promise<string> {
    return this.values.get(key) ?? "";
  }

  async setLocalStorage(key: string, value: string): Promise<boolean> {
    this.writes.push([key, value]);
    if (this.failWrites) throw new Error("write failed");
    this.values.set(key, value);
    return true;
  }
}

function liveFetch(): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/news?feed=")) {
      return {
        ok: true,
        text: async () => `<?xml version="1.0"?>
          <rss><channel><item><title>테스트 뉴스</title></item></channel></rss>`,
      } as Response;
    }
    if (url.startsWith("/api/map")) {
      return {
        ok: true,
        json: async () => ({
          cell: "37.5563,126.9220",
          attribution: "© OSM CONTRIBUTORS",
          roads: [],
          labels: [],
        }),
      } as Response;
    }
    return {
      ok: true,
      json: async () => ({
        current: {
          time: "2026-07-27T18:00",
          temperature_2m: 28,
          apparent_temperature: 29,
          relative_humidity_2m: 60,
          weather_code: 1,
          wind_speed_10m: 2,
        },
        hourly: {
          time: ["2026-07-27T18:00"],
          precipitation_probability: [10],
        },
      }),
    } as Response;
  }) as typeof fetch;
}

function createSession(
  bridge: TodoBridge,
  updates: LiveDashboardUpdate[],
) {
  return createLiveDashboardSession({
    bridge,
    fetchImpl: liveFetch(),
    now: () => Date.parse("2026-07-27T18:00:00+09:00"),
    onUpdate: (update) => updates.push(update),
  });
}

describe("live dashboard todos", () => {
  it("replaces phone-managed tasks immediately without replaying storage writes", async () => {
    const bridge = new TodoBridge();
    const updates: LiveDashboardUpdate[] = [];
    const session = createSession(bridge, updates);
    await session.start();
    const writesBefore = bridge.writes.length;
    const next = [
      { id: "phone-one", title: "폰에서 추가", completed: false },
      { id: "phone-two", title: "동기화 확인", completed: true },
    ] as const;

    session.replaceTodos(next);

    expect(session.getState().todos).toEqual({
      status: "fresh",
      value: next,
    });
    expect(updates.at(-1)?.target).toBe("right");
    expect(bridge.writes).toHaveLength(writesBefore);
  });

  it("restores saved tasks and persists a toggle after emitting it", async () => {
    const bridge = new TodoBridge();
    bridge.values.set("sandevistan:todos:v1", JSON.stringify(SAVED_TODOS));
    const updates: LiveDashboardUpdate[] = [];
    const session = createSession(bridge, updates);

    await session.start();
    expect(session.getState().todos.value).toEqual(SAVED_TODOS);

    await expect(session.toggleTodo(0)).resolves.toBe(true);

    expect(session.getState().todos.value?.[0].completed).toBe(true);
    expect(updates.at(-1)?.target).toBe("right");
    expect(JSON.parse(bridge.values.get("sandevistan:todos:v1")!)[0].completed)
      .toBe(true);

    await expect(session.toggleTodo(1)).resolves.toBe(true);

    expect(session.getState().todos.value?.[1].completed).toBe(false);
    expect(JSON.parse(bridge.values.get("sandevistan:todos:v1")!)[1].completed)
      .toBe(false);
  });

  it("rejects invalid or disposed toggles without a write", async () => {
    const bridge = new TodoBridge();
    const session = createSession(bridge, []);
    await session.start();
    const writesBefore = bridge.writes.length;

    await expect(session.toggleTodo(-1)).resolves.toBe(false);
    await expect(session.toggleTodo(99)).resolves.toBe(false);
    session.dispose();
    await expect(session.toggleTodo(0)).resolves.toBe(false);

    expect(bridge.writes).toHaveLength(writesBefore);
  });

  it("keeps the in-memory toggle when persistence fails", async () => {
    const bridge = new TodoBridge(true);
    const session = createSession(bridge, []);
    await session.start();

    await expect(session.toggleTodo(1)).resolves.toBe(true);

    expect(session.getState().todos.value?.[1].completed).toBe(true);
  });
});
