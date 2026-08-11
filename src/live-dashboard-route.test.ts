// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  AppLocationAccuracy,
  type AppLocation,
  type AppLocationOptions,
} from "@evenrealities/even_hub_sdk";
import {
  createLiveDashboardSession,
  type LiveDashboardUpdate,
} from "./live-dashboard";
import type { LocationBridge } from "./location";
import { RoutingError, type Destination } from "./routing";
import { diagnosticLogger } from "./diagnostic-log";

const NOW = Date.parse("2026-07-27T14:20:00Z");
const LOCATION: AppLocation = {
  latitude: 37.5563,
  longitude: 126.922,
  timestamp: NOW,
};
const DESTINATION: Destination = {
  id: "venue.1",
  name: "서울역",
  label: "서울역, 서울특별시",
  coordinate: { latitude: 37.5547, longitude: 126.9707 },
};

class TestBridge implements LocationBridge {
  readonly values = new Map<string, string>();

  async getAppLocation(
    _options?: AppLocationOptions,
  ): Promise<AppLocation | null> {
    return LOCATION;
  }

  async getLocalStorage(key: string) {
    return this.values.get(key) ?? "";
  }

  async setLocalStorage(key: string, value: string) {
    this.values.set(key, value);
    return true;
  }
}

class NoLocationBridge extends TestBridge {
  override async getAppLocation(_options?: AppLocationOptions) {
    return null;
  }
}

class StreamingBridge extends TestBridge {
  readonly startCalls: Array<AppLocationOptions | undefined> = [];
  stopCalls = 0;
  private listener: ((location: AppLocation) => void) | undefined;

  async startAppLocationUpdates(options?: AppLocationOptions) {
    this.startCalls.push(options);
    return true;
  }

  async stopAppLocationUpdates() {
    this.stopCalls += 1;
    return true;
  }

  onAppLocationChanged(listener: (location: AppLocation) => void) {
    this.listener = listener;
    return () => {
      this.listener = undefined;
    };
  }

  emit(location: AppLocation) {
    this.listener?.(location);
  }
}

class BlockingRouteStorageBridge extends StreamingBridge {
  readonly routeWriteStarted = deferred<void>();
  readonly releaseRouteWrite = deferred<void>();

  override async setLocalStorage(key: string, value: string) {
    if (key === "sandevistan:active-route:v1" && value !== "") {
      this.routeWriteStarted.resolve();
      await this.releaseRouteWrite.promise;
    }
    return super.setLocalStorage(key, value);
  }
}

function weatherResponse(): Response {
  return {
    ok: true,
    json: async () => ({
      current: {
        time: "2026-07-27T14:15",
        temperature_2m: 29,
        apparent_temperature: 31,
        relative_humidity_2m: 60,
        weather_code: 1,
        wind_speed_10m: 5,
      },
      hourly: {
        time: ["2026-07-27T14:00"],
        precipitation_probability: [10],
      },
    }),
  } as Response;
}

function newsResponse(): Response {
  return {
    ok: true,
    text: async () =>
      "<rss><channel><item><title>뉴스</title><guid>one</guid></item></channel></rss>",
  } as Response;
}

function mapResponse(): Response {
  return {
    ok: true,
    json: async () => ({
      cell: "37.5552,126.9216",
      attribution: "© OSM CONTRIBUTORS",
      roads: [],
      labels: [],
    }),
  } as Response;
}

function routeResponse(): Response {
  return new Response(JSON.stringify({
    geometry: [
      [37.5563, 126.922],
      [37.5563, 126.923],
      [37.5547, 126.9707],
    ],
    distance: 4380,
    duration: 3120,
    maneuvers: [
      { instruction: "직진", distance: 120, wayPoints: [0, 1] },
      { instruction: "우회전", distance: 4260, wayPoints: [1, 2] },
    ],
  }), { status: 200 });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function liveFetch(routeImpl = async () => routeResponse()): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/route") return routeImpl();
    if (url.includes("/news?feed=")) return newsResponse();
    if (url.startsWith("/api/map")) return mapResponse();
    return weatherResponse();
  }) as unknown as typeof fetch;
}

describe("live dashboard optional routing", () => {
  it("enables routing with a device-owned key and forwards it only as a header", async () => {
    const deviceKey = "device-owned-key-123456";
    const fetchImpl = vi.fn(async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const url = String(input);
      if (url === "/api/route") {
        expect(new Headers(init?.headers).get("x-sandevistan-ors-key")).toBe(
          deviceKey,
        );
        expect(init?.body).not.toContain(deviceKey);
        return routeResponse();
      }
      if (url.includes("/news?feed=")) return newsResponse();
      if (url.startsWith("/api/map")) return mapResponse();
      return weatherResponse();
    }) as typeof fetch;
    const session = createLiveDashboardSession({
      bridge: new TestBridge(),
      fetchImpl,
      routingStatus: { enabled: false },
      now: () => NOW,
      onUpdate: vi.fn(),
    });
    await session.start();

    session.setRoutingKey(deviceKey);
    expect(session.getState().route).toEqual({ status: "fresh" });
    await session.startRoute(DESTINATION, "foot-walking");
    expect(session.getState().route.status).toBe("fresh");

    await session.endRoute();
    session.setRoutingKey(undefined);
    expect(session.getState().route).toEqual({ status: "disabled" });
    session.dispose();
  });

  it("keeps routing disabled without a key and leaves keyless data live", async () => {
    const session = createLiveDashboardSession({
      bridge: new TestBridge(),
      fetchImpl: liveFetch(),
      routingStatus: { enabled: false },
      now: () => NOW,
      onUpdate: vi.fn(),
    });
    await session.start();

    expect(session.getState()).toMatchObject({
      weather: { status: "fresh" },
      news: { status: "fresh" },
      map: { status: "fresh" },
      route: { status: "disabled" },
    });
    await expect(
      session.startRoute(DESTINATION, "foot-walking"),
    ).rejects.toMatchObject({
      code: "ROUTING_DISABLED",
      disabled: true,
    } satisfies Partial<RoutingError>);
    session.dispose();
  });

  it("does not start a route from the labelled demo coordinate", async () => {
    const fetchImpl = liveFetch();
    const session = createLiveDashboardSession({
      bridge: new NoLocationBridge(),
      fetchImpl,
      routingStatus: { enabled: true },
      now: () => NOW,
      onUpdate: vi.fn(),
    });
    await session.start();

    expect(session.getState().location.value?.source).toBe("demo");
    await expect(
      session.startRoute(DESTINATION, "foot-walking"),
    ).rejects.toMatchObject({
      code: "LOCATION_UNAVAILABLE",
    } satisfies Partial<RoutingError>);
    expect(fetchImpl).not.toHaveBeenCalledWith(
      "/api/route",
      expect.anything(),
    );
    session.dispose();
  });

  it("starts, persists, and ends a normalized route", async () => {
    const bridge = new StreamingBridge();
    const updates: LiveDashboardUpdate[] = [];
    const fetchImpl = liveFetch();
    const session = createLiveDashboardSession({
      bridge,
      fetchImpl,
      routingStatus: { enabled: true },
      now: () => NOW,
      onUpdate: (update) => updates.push(update),
    });
    await session.start();

    expect(session.getState().route).toEqual({ status: "fresh" });
    await session.startRoute(DESTINATION, "foot-walking");

    expect(session.getState().route).toMatchObject({
      status: "fresh",
      fetchedAt: NOW,
      value: {
        destinationName: "서울역",
        activeManeuverIndex: 0,
        remainingDistance: 4380,
        profile: "foot-walking",
      },
    });
    expect(updates.at(-1)?.target).toBe("all");
    expect(JSON.parse(
      bridge.values.get("sandevistan:active-route:v1") ?? "{}",
    )).toMatchObject({
      destination: DESTINATION,
      route: { destinationName: "서울역" },
      fetchedAt: NOW,
    });
    expect(bridge.startCalls).toEqual([
      {
        accuracy: AppLocationAccuracy.Medium,
        intervalMs: 15_000,
        distanceFilter: 15,
      },
      {
        accuracy: AppLocationAccuracy.Medium,
        intervalMs: 2_000,
        distanceFilter: 5,
      },
    ]);
    expect(bridge.stopCalls).toBe(1);

    await session.endRoute();
    expect(session.getState().route).toEqual({ status: "fresh" });
    expect(bridge.values.get("sandevistan:active-route:v1")).toBe("");
    expect(updates.at(-1)?.target).toBe("all");
    expect(bridge.startCalls.at(-1)).toEqual({
      accuracy: AppLocationAccuracy.Medium,
      intervalMs: 15_000,
      distanceFilter: 15,
    });
    expect(bridge.stopCalls).toBe(2);
    session.dispose();
  });

  it("keeps the last route stale when a replacement request fails", async () => {
    let routeCalls = 0;
    const session = createLiveDashboardSession({
      bridge: new TestBridge(),
      fetchImpl: liveFetch(async () => {
        routeCalls += 1;
        return routeCalls === 1
          ? routeResponse()
          : new Response(JSON.stringify({
            error: { code: "ROUTE_UPSTREAM_ERROR", message: "failed" },
          }), { status: 502 });
      }),
      routingStatus: { enabled: true },
      now: () => NOW,
      onUpdate: vi.fn(),
    });
    await session.start();
    await session.startRoute(DESTINATION, "foot-walking");

    await expect(
      session.startRoute(DESTINATION, "cycling-regular"),
    ).rejects.toBeInstanceOf(RoutingError);
    expect(session.getState().route).toMatchObject({
      status: "stale",
      value: {
        destinationName: "서울역",
        profile: "foot-walking",
      },
    });
    session.dispose();
  });

  it("does not let a late route response undo an explicit end", async () => {
    const pending = deferred<Response>();
    const bridge = new TestBridge();
    const session = createLiveDashboardSession({
      bridge,
      fetchImpl: liveFetch(() => pending.promise),
      routingStatus: { enabled: true },
      now: () => NOW,
      onUpdate: vi.fn(),
    });
    await session.start();

    const starting = session.startRoute(DESTINATION, "foot-walking");
    await vi.waitFor(() => {
      expect(session.getState().route.status).toBe("loading");
    });
    await session.endRoute();
    pending.resolve(routeResponse());
    await starting;

    expect(session.getState().route).toEqual({ status: "fresh" });
    expect(bridge.values.get("sandevistan:active-route:v1")).toBe("");
    session.dispose();
  });

  it("does not let a late route cache write undo an explicit end", async () => {
    const bridge = new BlockingRouteStorageBridge();
    const session = createLiveDashboardSession({
      bridge,
      fetchImpl: liveFetch(),
      routingStatus: { enabled: true },
      now: () => NOW,
      onUpdate: vi.fn(),
    });
    await session.start();

    const starting = session.startRoute(DESTINATION, "foot-walking");
    await bridge.routeWriteStarted.promise;
    const ending = session.endRoute();
    bridge.releaseRouteWrite.resolve();
    await Promise.all([starting, ending]);

    expect(session.getState().route).toEqual({ status: "fresh" });
    expect(bridge.values.get("sandevistan:active-route:v1")).toBe("");
    expect(bridge.startCalls.at(-1)).toEqual({
      accuracy: AppLocationAccuracy.Medium,
      intervalMs: 15_000,
      distanceFilter: 15,
    });
    session.dispose();
  });

  it("restores a recent route as stale and resumes only on request", async () => {
    const bridge = new TestBridge();
    bridge.values.set("sandevistan:active-route:v1", JSON.stringify({
      destination: DESTINATION,
      route: {
        destinationName: "서울역",
        geometry: [
          { latitude: 37.5563, longitude: 126.922 },
          { latitude: 37.5547, longitude: 126.9707 },
        ],
        maneuvers: [],
        activeManeuverIndex: 0,
        remainingDistance: 4380,
        profile: "foot-walking",
      },
      fetchedAt: NOW - 60_000,
    }));
    let routeCalls = 0;
    const session = createLiveDashboardSession({
      bridge,
      fetchImpl: liveFetch(async () => {
        routeCalls += 1;
        return routeResponse();
      }),
      routingStatus: { enabled: true },
      now: () => NOW,
      onUpdate: vi.fn(),
    });

    await session.start();
    expect(session.getState().route).toMatchObject({
      status: "stale",
      value: { destinationName: "서울역" },
    });
    expect(routeCalls).toBe(0);

    await session.resumeRoute();
    expect(routeCalls).toBe(1);
    expect(session.getState().route.status).toBe("fresh");
    session.dispose();
  });

  it("updates progress and reroutes once after three off-route fixes", async () => {
    const bridge = new StreamingBridge();
    const updates: LiveDashboardUpdate[] = [];
    let routeCalls = 0;
    let currentTime = NOW;
    const fetchImpl = liveFetch(async () => {
      routeCalls += 1;
      return routeResponse();
    });
    const session = createLiveDashboardSession({
      bridge,
      fetchImpl,
      routingStatus: { enabled: true },
      now: () => currentTime,
      onUpdate: (update) => updates.push(update),
    });
    await session.start();
    await session.startRoute(DESTINATION, "foot-walking");
    expect(routeCalls).toBe(1);
    diagnosticLogger.clear();

    for (let index = 1; index <= 3; index += 1) {
      currentTime += 15_000;
      bridge.emit({
        latitude: 37.5573,
        longitude: 126.922 + index / 10_000,
        timestamp: currentTime,
      });
      await vi.waitFor(() => {
        expect(session.getState().location.fetchedAt).toBe(currentTime);
      });
      await vi.waitFor(() => expect(diagnosticLogger.text()).toContain(
        `process #${index} complete`,
      ));
    }
    await vi.waitFor(() => expect(routeCalls).toBe(2));
    expect(updates.at(-1)?.state.route.status).toBe("fresh");

    currentTime += 15_000;
    bridge.emit({
      latitude: 37.558,
      longitude: 126.923,
      timestamp: currentTime,
    });
    await vi.waitFor(() => {
      expect(session.getState().location.fetchedAt).toBe(currentTime);
    });
    await vi.waitFor(() => expect(diagnosticLogger.text()).toContain(
      "process #4 complete",
    ));
    expect(routeCalls).toBe(2);
    session.dispose();
  });
});
