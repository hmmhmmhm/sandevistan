import { describe, expect, it, vi } from "vitest";
import type { EvenStorage } from "./live-cache";
import type { Coordinate, MapValue } from "./live-state";
import {
  clientMapCell,
  MAP_MAX_AGE_MS,
  mapLabelName,
  parseMapResponse,
  projectCoordinate,
  resolveMap,
} from "./map";

const NOW = Date.parse("2026-07-27T14:20:00Z");
const CENTER: Coordinate = {
  latitude: 37.5563,
  longitude: 126.922,
};
const VALUE: MapValue = {
  cell: "37.5552,126.9216",
  attribution: "© OSM CONTRIBUTORS",
  roads: [
    {
      kind: "major",
      points: [
        { latitude: 37.55, longitude: 126.91 },
        { latitude: 37.56, longitude: 126.92 },
      ],
    },
  ],
  labels: [
    {
      kind: "transit",
      name: "홍대입구역",
      point: { latitude: 37.5572, longitude: 126.9245 },
    },
  ],
};

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

function mapResponse(
  cell = "37.5552,126.9216",
  roads: unknown = [
    {
      kind: "major",
      points: [[37.55, 126.91], [37.56, 126.92]],
    },
  ],
  labels: unknown = [{
    kind: "transit",
    name: "홍대입구역",
    point: [37.5572, 126.9245],
  }],
): Response {
  return new Response(JSON.stringify({
    cell,
    attribution: "© OSM CONTRIBUTORS",
    roads,
    labels,
  }));
}

function setCache(
  storage: TestStorage,
  value: MapValue,
  fetchedAt: number,
) {
  storage.values.set(
    "sandevistan:map-labels-i18n-v2:v1",
    JSON.stringify({ value, fetchedAt, cell: value.cell }),
  );
}

describe("map response and projection helpers", () => {
  it("preserves the vector provider credit and rejects unknown providers", () => {
    const input = { cell: "test", attribution: "© OSM CONTRIBUTORS", roads: [], labels: [], tileSource: "openmaptiles" };
    expect(parseMapResponse(input).tileSource).toBe("openmaptiles");
    expect(() => parseMapResponse({ ...input, tileSource: "unknown" })).toThrow();
  });

  it("parses normalized server roads into coordinate objects", () => {
    expect(parseMapResponse({
      cell: "37.555,126.920",
      attribution: "© OSM CONTRIBUTORS",
      roads: [
        {
          kind: "major",
          points: [[37.55, 126.91], [37.56, 126.92]],
        },
      ],
      labels: [{
        kind: "transit",
        name: "홍대입구역",
        localizedNames: {
          ko: "홍대입구역",
          en: "Hongik University",
          ja: "弘大入口駅",
        },
        point: [37.5572, 126.9245],
      }],
    }).roads[0]).toEqual({
      kind: "major",
      points: [
        { latitude: 37.55, longitude: 126.91 },
        { latitude: 37.56, longitude: 126.92 },
      ],
    });
    expect(parseMapResponse({
      cell: "37.555,126.920",
      attribution: "© OSM CONTRIBUTORS",
      roads: [],
      labels: [{
        kind: "transit",
        name: "홍대입구역",
        localizedNames: {
          ko: "홍대입구역",
          en: "Hongik University",
          ja: "弘大入口駅",
        },
        point: [37.5572, 126.9245],
      }],
    }).labels[0]).toEqual({
      kind: "transit",
      name: "홍대입구역",
      localizedNames: {
        ko: "홍대입구역",
        en: "Hongik University",
        ja: "弘大入口駅",
      },
      point: {
        latitude: 37.5572,
        longitude: 126.9245,
      },
    });
    const label = parseMapResponse({
      cell: "37.555,126.920",
      attribution: "© OSM CONTRIBUTORS",
      roads: [],
      labels: [{
        kind: "road",
        name: "Daeche-ro",
        localizedNames: { ko: "대체로", en: "Daeche-ro" },
        point: [37.5572, 126.9245],
      }],
    }).labels[0];
    expect(mapLabelName(label, "ko")).toBe("대체로");
    expect(mapLabelName(label, "en")).toBe("Daeche-ro");
  });

  it("rejects malformed, excessive, or untrusted normalized responses", () => {
    expect(() => parseMapResponse({
      cell: "37.555,126.920",
      attribution: "someone else",
      roads: [],
      labels: [],
    })).toThrow();
    expect(() => parseMapResponse({
      cell: "37.555,126.920",
      attribution: "© OSM CONTRIBUTORS",
      roads: [{ kind: "minor", points: [[91, 127], [37, 127]] }],
      labels: [],
    })).toThrow();
    expect(() => parseMapResponse({
      cell: "37.555,126.920",
      attribution: "© OSM CONTRIBUTORS",
      roads: Array.from({ length: 181 }, () => ({
        kind: "minor",
        points: [[37, 127], [37.1, 127.1]],
      })),
      labels: [],
    })).toThrow();
    for (const labels of [
      undefined,
      [{ kind: "shop", name: "상점", point: [37, 127] }],
      [{ kind: "place", name: "", point: [37, 127] }],
      [{ kind: "place", name: "가".repeat(41), point: [37, 127] }],
      [{ kind: "place", name: "장소", point: [91, 127] }],
      [{
        kind: "place",
        name: "Place",
        localizedNames: { en: "x".repeat(41) },
        point: [37, 127],
      }],
      [{
        kind: "place",
        name: "Place",
        localizedNames: { "bad tag": "Invalid" },
        point: [37, 127],
      }],
      [{
        kind: "place",
        name: "Place",
        localizedNames: Object.fromEntries(
          ["aa", "ab", "ae", "af", "ak", "am", "an", "ar", "as"].map((
            language,
            index,
          ) => [
            language,
            `Name ${index}`,
          ]),
        ),
        point: [37, 127],
      }],
      Array.from({ length: 25 }, (_, index) => ({
        kind: "road",
        name: `도로 ${index}`,
        point: [37, 127],
      })),
    ]) {
      expect(() => parseMapResponse({
        cell: "37.555,126.920",
        attribution: "© OSM CONTRIBUTORS",
        roads: [],
        ...(labels === undefined ? {} : { labels }),
      })).toThrow();
    }
  });

  it("projects center, north, and east in the expected directions", () => {
    expect(projectCoordinate(CENTER, CENTER, 650)).toEqual({
      x: 144,
      y: 144,
    });
    expect(projectCoordinate({
      latitude: CENTER.latitude + 0.001,
      longitude: CENTER.longitude,
    }, CENTER, 650).y).toBeLessThan(144);
    expect(projectCoordinate({
      latitude: CENTER.latitude,
      longitude: CENTER.longitude + 0.001,
    }, CENTER, 650).x).toBeGreaterThan(144);
  });

  it("uses the same deterministic cell contract as the server", () => {
    expect(clientMapCell(CENTER)).toBe("37.5552,126.9216");
    expect(clientMapCell({
      latitude: 37.5568,
      longitude: 126.923,
    })).toBe("37.5552,126.9216");
    expect(clientMapCell({
      latitude: 37.557,
      longitude: 126.924,
    })).toBe("37.5570,126.9234");
  });
});

describe("resolveMap", () => {
  it("reuses a fresh map in one cell and requests again after crossing cells", async () => {
    const storage = new TestStorage();
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "https://example.test");
      return mapResponse(clientMapCell({
        latitude: Number(url.searchParams.get("lat")),
        longitude: Number(url.searchParams.get("lng")),
      }));
    }) as unknown as typeof fetch;

    await resolveMap(storage, CENTER, fetchImpl, NOW);
    await resolveMap(storage, {
      latitude: 37.5568,
      longitude: 126.923,
    }, fetchImpl, NOW + 1);
    await resolveMap(storage, {
      latitude: 37.557,
      longitude: 126.924,
    }, fetchImpl, NOW + 2);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(String(vi.mocked(fetchImpl).mock.calls[0][0])).toBe(
      "/api/map?lat=37.5563&lng=126.922",
    );
  });

  it("shows a stale matching map before refresh and keeps it on failure", async () => {
    const storage = new TestStorage();
    const fetchedAt = NOW - MAP_MAX_AGE_MS - 1;
    setCache(storage, VALUE, fetchedAt);
    const cached = vi.fn();

    const result = await resolveMap(
      storage,
      CENTER,
      vi.fn(async () => {
        throw new Error("network failed");
      }) as unknown as typeof fetch,
      NOW,
      cached,
    );

    expect(cached).toHaveBeenCalledWith({
      status: "stale",
      value: VALUE,
      fetchedAt,
    });
    expect(result).toEqual({
      status: "stale",
      value: VALUE,
      fetchedAt,
    });
  });

  it("uses geometry from a different cell only as stale fallback", async () => {
    const storage = new TestStorage();
    setCache(storage, VALUE, NOW);
    const cached = vi.fn();

    await expect(resolveMap(
      storage,
      { latitude: 37.57, longitude: 126.94 },
      vi.fn(async () => new Response("", { status: 502 })) as unknown as typeof fetch,
      NOW,
      cached,
    )).resolves.toEqual({
      status: "stale",
      value: VALUE,
      fetchedAt: NOW,
    });
    expect(cached).toHaveBeenCalledWith({
      status: "stale",
      value: VALUE,
      fetchedAt: NOW,
    });
  });

  it("persists a bounded fresh response and rejects a mismatched server cell", async () => {
    const storage = new TestStorage();
    const result = await resolveMap(
      storage,
      CENTER,
      vi.fn(async () => mapResponse()) as unknown as typeof fetch,
      NOW,
    );

    expect(result).toEqual({
      status: "fresh",
      value: VALUE,
      fetchedAt: NOW,
    });
    expect(storage.writes).toEqual([[
      "sandevistan:map-labels-i18n-v2:v1",
      JSON.stringify({
        value: VALUE,
        fetchedAt: NOW,
        cell: VALUE.cell,
      }),
    ]]);

    await expect(resolveMap(
      new TestStorage(),
      CENTER,
      vi.fn(async () => mapResponse("37.5570,126.9234")) as unknown as typeof fetch,
      NOW,
    )).resolves.toEqual({ status: "unavailable" });
  });

  it("ignores the old road-only cache contract", async () => {
    const storage = new TestStorage();
    storage.values.set("sandevistan:map:v1", JSON.stringify({
      value: {
        cell: VALUE.cell,
        attribution: VALUE.attribution,
        roads: VALUE.roads,
      },
      fetchedAt: NOW,
      cell: VALUE.cell,
    }));
    const fetchImpl = vi.fn(async () => mapResponse()) as unknown as typeof fetch;

    await expect(resolveMap(storage, CENTER, fetchImpl, NOW))
      .resolves.toMatchObject({ status: "fresh", value: VALUE });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(storage.values.has("sandevistan:map-labels-i18n-v2:v1")).toBe(true);
  });
});
