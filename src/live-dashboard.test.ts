// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import type { AppLocation, AppLocationOptions } from "@evenrealities/even_hub_sdk";
import type { LocationBridge } from "./location";
import {
  createLiveDashboardSession,
  type LiveDashboardUpdate,
} from "./live-dashboard";
import { NEWS_MAX_AGE_MS } from "./news";
import { WEATHER_MAX_AGE_MS } from "./weather";

const NOW = Date.parse("2026-07-27T14:20:00Z");
const LOCATION: AppLocation = {
  latitude: 37.5665,
  longitude: 126.978,
  accuracy: 4,
  timestamp: NOW - 1_000,
};
const NEWS_RSS = `<?xml version="1.0"?>
<rss><channel>
  <item>
    <title>실시간 첫 뉴스</title>
    <guid>live-one</guid>
    <pubDate>Mon, 27 Jul 2026 05:00:00 GMT</pubDate>
  </item>
</channel></rss>`;

function weatherResponse(temperature = 29.4): Response {
  return {
    ok: true,
    json: async () => ({
      current: {
        time: "2026-07-27T14:15",
        temperature_2m: temperature,
        apparent_temperature: 31.2,
        relative_humidity_2m: 67,
        weather_code: 2,
        wind_speed_10m: 8.2,
      },
      hourly: {
        time: ["2026-07-27T14:00", "2026-07-27T15:00"],
        precipitation_probability: [10, 20],
      },
    }),
  } as Response;
}

function newsResponse(): Response {
  return {
    ok: true,
    text: async () => NEWS_RSS,
  } as Response;
}

function mapResponse(): Response {
  return {
    ok: true,
    json: async () => ({
      cell: "37.5660,126.9774",
      attribution: "© OSM CONTRIBUTORS",
      roads: [],
      labels: [],
    }),
  } as Response;
}

function liveFetch(weatherTemperature = 29.4): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/news?feed=")) return newsResponse();
    if (url.startsWith("/api/map")) return mapResponse();
    return weatherResponse(weatherTemperature);
  }) as unknown as typeof fetch;
}

class TestBridge implements LocationBridge {
  readonly values = new Map<string, string>();
  readonly locationCalls: Array<AppLocationOptions | undefined> = [];

  constructor(
    private readonly getLocation: () => Promise<AppLocation | null> =
      async () => LOCATION,
  ) {}

  async getAppLocation(options?: AppLocationOptions) {
    this.locationCalls.push(options);
    return this.getLocation();
  }

  async getLocalStorage(key: string) {
    return this.values.get(key) ?? "";
  }

  async setLocalStorage(key: string, value: string) {
    this.values.set(key, value);
    return true;
  }
}

class TestDocument {
  visibilityState: DocumentVisibilityState = "visible";
  readonly added: EventListener[] = [];
  readonly removed: EventListener[] = [];

  addEventListener(_type: string, listener: EventListenerOrEventListenerObject) {
    this.added.push(listener as EventListener);
  }

  removeEventListener(
    _type: string,
    listener: EventListenerOrEventListenerObject,
  ) {
    this.removed.push(listener as EventListener);
  }

  dispatchVisibility() {
    for (const listener of this.added) listener(new Event("visibilitychange"));
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe("createLiveDashboardSession", () => {
  it("exposes a manual weather refresh decision for the phone companion", async () => {
    const fetchImpl = liveFetch();
    const session = createLiveDashboardSession({
      bridge: new TestBridge(),
      fetchImpl,
      now: () => NOW,
      onUpdate: vi.fn(),
    });
    await session.start();
    const weatherCallsBefore = vi.mocked(fetchImpl).mock.calls.filter(
      ([input]) => !String(input).startsWith("/api/"),
    ).length;

    await expect(session.refreshWeather()).resolves.toBe("accepted");
    expect(vi.mocked(fetchImpl).mock.calls.filter(
      ([input]) => !String(input).startsWith("/api/"),
    )).toHaveLength(weatherCallsBefore + 1);
    session.dispose();
    await expect(session.refreshWeather()).resolves.toBe("dropped");
  });

  it("force-refills fresh news after phone RSS source changes", async () => {
    const bridge = new TestBridge();
    const fetchImpl = liveFetch();
    const session = createLiveDashboardSession({
      bridge,
      fetchImpl,
      now: () => NOW,
      onUpdate: vi.fn(),
    });
    await session.start();
    bridge.values.set("sandevistan:rss-sources:v1", JSON.stringify([
      {
        id: "sbs-latest",
        name: "SBS Latest",
        url: "https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=01",
        enabled: true,
        isDefault: true,
      },
      {
        id: "example",
        name: "Example",
        url: "https://feeds.example.com/rss.xml",
        enabled: true,
        isDefault: false,
      },
    ]));
    vi.mocked(fetchImpl).mockClear();

    await expect(session.refreshNewsSources()).resolves.toBe("accepted");

    expect(vi.mocked(fetchImpl).mock.calls.map(([input]) => String(input)))
      .toEqual(expect.arrayContaining([
        "https://sandevistan-x-relay.hmmhmmhm.workers.dev/news?feed=sbs-latest",
        "https://feeds.example.com/rss.xml",
      ]));
  });

  it("does no work at construction, then resolves location, weather, and news", async () => {
    const bridge = new TestBridge();
    const updates: LiveDashboardUpdate[] = [];
    const fetchImpl = liveFetch();
    const documentTarget = new TestDocument();
    const session = createLiveDashboardSession({
      bridge,
      fetchImpl: fetchImpl as typeof fetch,
      now: () => NOW,
      documentTarget,
      onUpdate: (update) => updates.push(update),
    });

    expect(bridge.locationCalls).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
    await Promise.all([session.start(), session.start()]);

    expect(documentTarget.added).toHaveLength(1);
    expect(bridge.locationCalls).toHaveLength(1);
    expect(updates[0].target).toBe("left");
    expect(updates.filter(({ target }) => target === "left")).toHaveLength(2);
    expect(updates.filter(({ target }) => target === "right")).toHaveLength(2);
    expect(updates[0].state.location.value?.source).toBe("live");
    expect(updates.at(-1)?.state.weather).toMatchObject({
      status: "fresh",
      value: { temperature: 29.4, condition: "대체로 맑음" },
      fetchedAt: NOW,
    });
    expect(updates.at(-1)?.state.news).toMatchObject({
      status: "fresh",
      value: [{ id: "guid:live-one", title: "실시간 첫 뉴스" }],
      fetchedAt: NOW,
    });
  });

  it("emits a fresh cached weather snapshot only once", async () => {
    const bridge = new TestBridge();
    bridge.values.set("sandevistan:weather:v1", JSON.stringify({
      value: {
        temperature: 24,
        apparentTemperature: 25,
        humidity: 50,
        windSpeed: 3,
        precipitationProbability: 0,
        weatherCode: 0,
        condition: "맑음",
      },
      fetchedAt: NOW - 1_000,
      coordinate: {
        latitude: LOCATION.latitude,
        longitude: LOCATION.longitude,
      },
    }));
    const updates: LiveDashboardUpdate[] = [];
    const fetchImpl = liveFetch();
    const session = createLiveDashboardSession({
      bridge,
      fetchImpl: fetchImpl as typeof fetch,
      now: () => NOW,
      onUpdate: (update) => updates.push(update),
    });

    await session.start();

    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(vi.mocked(fetchImpl).mock.calls.map(([input]) => String(input)))
      .toEqual(expect.arrayContaining([
        "https://sandevistan-x-relay.hmmhmmhm.workers.dev/news?feed=sbs-latest",
        "https://sandevistan-x-relay.hmmhmmhm.workers.dev/news?feed=newsis-breaking",
        "https://sandevistan-x-relay.hmmhmmhm.workers.dev/news?feed=weekly-khan-latest",
        expect.stringMatching(/^\/api\/map/),
      ]));
    expect(updates.filter(({ target }) => target === "left")).toHaveLength(2);
    expect(updates.filter(({ target }) => target === "right")).toHaveLength(2);
    expect(updates[1].state.weather.value?.temperature).toBe(24);
  });

  it("does not emit the same stale cache again after a failed refresh", async () => {
    const bridge = new TestBridge();
    bridge.values.set("sandevistan:weather:v1", JSON.stringify({
      value: {
        temperature: 24,
        apparentTemperature: 25,
        humidity: 50,
        windSpeed: 3,
        precipitationProbability: 0,
        weatherCode: 0,
        condition: "맑음",
      },
      fetchedAt: NOW - WEATHER_MAX_AGE_MS - 1,
      coordinate: {
        latitude: LOCATION.latitude,
        longitude: LOCATION.longitude,
      },
    }));
    const updates: LiveDashboardUpdate[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/news?feed=")) return newsResponse();
      if (url.startsWith("/api/map")) return mapResponse();
      return { ok: false } as Response;
    }) as unknown as typeof fetch;
    const session = createLiveDashboardSession({
      bridge,
      fetchImpl,
      now: () => NOW,
      onUpdate: (update) => updates.push(update),
    });

    await session.start();

    expect(updates.filter(({ target }) => target === "left")).toHaveLength(2);
    expect(updates.filter(({ target }) => target === "right")).toHaveLength(2);
    expect(updates[1].state.weather.status).toBe("stale");
    expect(updates.at(-1)?.state.news.status).toBe("fresh");
  });

  it("emits stale cache followed by different fresh network weather", async () => {
    const bridge = new TestBridge();
    bridge.values.set("sandevistan:weather:v1", JSON.stringify({
      value: {
        temperature: 24,
        apparentTemperature: 25,
        humidity: 50,
        windSpeed: 3,
        precipitationProbability: 0,
        weatherCode: 0,
        condition: "맑음",
      },
      fetchedAt: NOW - WEATHER_MAX_AGE_MS - 1,
      coordinate: {
        latitude: LOCATION.latitude,
        longitude: LOCATION.longitude,
      },
    }));
    const updates: LiveDashboardUpdate[] = [];
    const session = createLiveDashboardSession({
      bridge,
      fetchImpl: liveFetch(),
      now: () => NOW,
      onUpdate: (update) => updates.push(update),
    });

    await session.start();

    expect(updates.filter(({ target }) => target === "left")).toHaveLength(2);
    expect(updates.filter(({ target }) => target === "right")).toHaveLength(3);
    expect(updates[1].state.weather.status).toBe("stale");
    expect(updates.at(-1)?.state.weather.status).toBe("fresh");
    expect(updates.at(-1)?.state.weather.value?.temperature).toBe(29.4);
  });

  it("does not let visibility refresh demo weather before location resolves", async () => {
    const location = deferred<AppLocation | null>();
    const documentTarget = new TestDocument();
    const fetchImpl = liveFetch();
    const session = createLiveDashboardSession({
      bridge: new TestBridge(() => location.promise),
      fetchImpl: fetchImpl as typeof fetch,
      now: () => NOW,
      documentTarget,
      onUpdate: vi.fn(),
    });

    const starting = session.start();
    documentTarget.dispatchVisibility();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchImpl).not.toHaveBeenCalled();

    location.resolve(LOCATION);
    await starting;
    const weatherCalls = vi.mocked(fetchImpl).mock.calls.filter(
      ([input]) => String(input).startsWith("https://api.open-meteo"),
    );
    expect(weatherCalls).toHaveLength(1);
    expect(String(weatherCalls[0][0])).toContain(
      `latitude=${LOCATION.latitude}`,
    );
  });

  it("refreshes stale visible services and coalesces concurrent visibility events", async () => {
    let now = NOW;
    const secondFetch = deferred<Response>();
    let weatherCalls = 0;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/news?feed=")) return newsResponse();
      if (String(input).startsWith("/api/map")) return mapResponse();
      weatherCalls += 1;
      return weatherCalls === 1 ? weatherResponse() : secondFetch.promise;
    }) as unknown as typeof fetch;
    const documentTarget = new TestDocument();
    const updates: LiveDashboardUpdate[] = [];
    const session = createLiveDashboardSession({
      bridge: new TestBridge(),
      fetchImpl,
      now: () => now,
      documentTarget,
      onUpdate: (update) => updates.push(update),
    });
    await session.start();

    documentTarget.visibilityState = "hidden";
    now += WEATHER_MAX_AGE_MS + 1;
    documentTarget.dispatchVisibility();
    expect(weatherCalls).toBe(1);

    documentTarget.visibilityState = "visible";
    documentTarget.dispatchVisibility();
    documentTarget.dispatchVisibility();
    await vi.waitFor(() => expect(weatherCalls).toBe(2));
    secondFetch.resolve(weatherResponse(30.4));
    await vi.waitFor(() => {
      expect(updates.at(-1)?.state.weather.value?.temperature).toBe(30.4);
    });
  });

  it("drops due news checks while reading or busy without replaying them", async () => {
    let now = NOW;
    let canRefreshNews = false;
    const bridge = new TestBridge();
    bridge.values.set("sandevistan:news:v1", JSON.stringify({
      value: [{
        id: "guid:cached",
        title: "캐시 뉴스",
        publishedAt: NOW - 60_000,
      }],
      fetchedAt: NOW,
    }));
    const pendingNews = deferred<Response>();
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/news?feed=")) return pendingNews.promise;
      if (url.startsWith("/api/map")) return mapResponse();
      return weatherResponse();
    }) as unknown as typeof fetch;
    const session = createLiveDashboardSession({
      bridge,
      fetchImpl,
      now: () => now,
      canRefreshNews: () => canRefreshNews,
      onUpdate: vi.fn(),
    });

    await session.start();
    const newsCalls = () => vi.mocked(fetchImpl).mock.calls.filter(
      ([input]) => String(input).includes("/news?feed="),
    ).length;
    expect(newsCalls()).toBe(0);

    now += NEWS_MAX_AGE_MS + 1;
    session.refreshNewsIfDue();
    session.refreshNewsIfDue();
    expect(newsCalls()).toBe(0);

    canRefreshNews = true;
    session.refreshNewsIfDue();
    session.refreshNewsIfDue();
    await vi.waitFor(() => expect(newsCalls()).toBe(3));
    pendingNews.resolve(newsResponse());
    await vi.waitFor(() => {
      expect(session.getState().news.fetchedAt).toBe(now);
    });
    await Promise.resolve();
    expect(newsCalls()).toBe(3);
  });

  it("defers a source-change refresh while the news reader is open", async () => {
    let canRefreshNews = false;
    const fetchImpl = liveFetch();
    const session = createLiveDashboardSession({
      bridge: new TestBridge(),
      fetchImpl,
      now: () => NOW,
      canRefreshNews: () => canRefreshNews,
      onUpdate: vi.fn(),
    });
    await session.start();
    vi.mocked(fetchImpl).mockClear();

    await expect(session.refreshNewsSources()).resolves.toBe("dropped");
    expect(fetchImpl).not.toHaveBeenCalled();

    canRefreshNews = true;
    session.refreshNewsIfDue();
    await vi.waitFor(() => expect(vi.mocked(fetchImpl).mock.calls.filter(
      ([input]) => String(input).includes("/news?feed="),
    )).toHaveLength(3));
  });

  it("relabels unchanged built-in tasks when the locale changes", async () => {
    let locale: "ko" | "en" = "ko";
    const session = createLiveDashboardSession({
      bridge: new TestBridge(),
      fetchImpl: liveFetch(),
      now: () => NOW,
      getLocale: () => locale,
      onUpdate: vi.fn(),
    });
    await session.start();
    expect(session.getState().todos.value?.[0].title)
      .toBe("지하철역으로 이동");

    locale = "en";
    session.refreshLocale();

    expect(session.getState().todos.value?.map(({ title }) => title)).toEqual([
      "Go to the subway station",
      "Bring an umbrella",
      "Check route",
    ]);
  });

  it("disposes once and blocks late state, emissions, refresh, and restart", async () => {
    const location = deferred<AppLocation | null>();
    const bridge = new TestBridge(() => location.promise);
    const documentTarget = new TestDocument();
    const onUpdate = vi.fn();
    const fetchImpl = vi.fn();
    const session = createLiveDashboardSession({
      bridge,
      fetchImpl: fetchImpl as typeof fetch,
      documentTarget,
      onUpdate,
    });

    const starting = session.start();
    session.dispose();
    session.dispose();
    location.resolve(LOCATION);
    await starting;
    documentTarget.dispatchVisibility();
    await session.start();

    expect(documentTarget.added).toHaveLength(1);
    expect(documentTarget.removed).toEqual(documentTarget.added);
    expect(onUpdate).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(session.getState().location.value?.source).toBe("demo");
  });

  it("returns defensive snapshots from getState and update callbacks", async () => {
    const updates: LiveDashboardUpdate[] = [];
    const session = createLiveDashboardSession({
      bridge: new TestBridge(),
      fetchImpl: liveFetch(),
      now: () => NOW,
      onUpdate: (update) => updates.push(update),
    });
    await session.start();

    const exposed = session.getState() as {
      location: { value?: { coordinate: { latitude: number } } };
      news: { value?: string[] };
    };
    exposed.location.value!.coordinate.latitude = 0;
    exposed.news.value!.push("mutated");
    const callbackState = updates[0].state as {
      location: { value?: { coordinate: { longitude: number } } };
    };
    callbackState.location.value!.coordinate.longitude = 0;

    expect(session.getState().location.value?.coordinate).toEqual({
      latitude: LOCATION.latitude,
      longitude: LOCATION.longitude,
    });
    expect(session.getState().news.value).toEqual([{
      id: "guid:live-one",
      title: "실시간 첫 뉴스",
      publishedAt: Date.parse("2026-07-27T05:00:00Z"),
      source: "주간경향 최신기사",
    }]);
  });

  it("keeps news fresh when weather fails", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/news?feed=")) return newsResponse();
      if (url.startsWith("/api/map")) return mapResponse();
      return { ok: false } as Response;
    }) as unknown as typeof fetch;
    const session = createLiveDashboardSession({
      bridge: new TestBridge(),
      fetchImpl,
      now: () => NOW,
      onUpdate: vi.fn(),
    });

    await session.start();

    expect(session.getState().weather.status).toBe("unavailable");
    expect(session.getState().news).toMatchObject({
      status: "fresh",
      value: [{ title: "실시간 첫 뉴스" }],
    });
  });
});
