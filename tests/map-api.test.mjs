import assert from "node:assert/strict";
import test from "node:test";
import { handleApiRequest } from "../server/api-router.js";
import {
  buildOverpassQuery,
  handleMapRequest,
  mapCell,
} from "../server/map.js";

function overpassResponse(elements = []) {
  return new Response(JSON.stringify({ elements }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

test("builds a bounded labelled Overpass query and normalizes geometry", async () => {
  const calls = [];
  const response = await handleApiRequest(
    new Request("https://example.test/api/map?lat=37.5563&lng=126.922"),
    {},
    {
      cache: null,
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return overpassResponse([
          {
            type: "way",
            tags: {
              highway: "primary",
              name: "Yanghwa-ro",
              "name:ko": "양화로",
              "name:en": "Yanghwa-ro",
            },
            geometry: [
              { lat: 37.55, lon: 126.91 },
              { lat: 37.56, lon: 126.92 },
            ],
          },
          {
            type: "way",
            tags: { highway: "residential" },
            geometry: [
              { lat: 37.56, lon: 126.92 },
              { lat: 37.57, lon: 126.93 },
            ],
          },
          {
            type: "node",
            lat: 37.5572,
            lon: 126.9245,
            tags: {
              railway: "station",
              name: "Hongik University",
              "name:ko": "홍대입구역",
              "name:en": "Hongik University Station",
              "name:ja": "弘大入口駅",
            },
          },
          {
            type: "node",
            lat: 37.5568,
            lon: 126.923,
            tags: {
              leisure: "park",
              name: "경의선숲길",
            },
          },
        ]);
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    cell: "37.5552,126.9216",
    attribution: "© OSM CONTRIBUTORS",
    roads: [
      {
        kind: "major",
        points: [[37.55, 126.91], [37.56, 126.92]],
      },
      {
        kind: "minor",
        points: [[37.56, 126.92], [37.57, 126.93]],
      },
    ],
    labels: [
      {
        kind: "transit",
        name: "Hongik University",
        localizedNames: {
          en: "Hongik University Station",
          ja: "弘大入口駅",
          ko: "홍대입구역",
        },
        point: [37.5572, 126.9245],
      },
      {
        kind: "road",
        name: "Yanghwa-ro",
        localizedNames: {
          ko: "양화로",
          en: "Yanghwa-ro",
        },
        point: [37.56, 126.92],
      },
      {
        kind: "landmark",
        name: "경의선숲길",
        point: [37.5568, 126.923],
      },
    ],
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://overpass-api.de/api/interpreter");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.redirect, "manual");
  assert.deepEqual(calls[0].options.headers, {
    "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
    "user-agent": "SANDEVISTAN-G2-Personal-Prototype/0.1",
  });
  const query = calls[0].options.body.get("data");
  assert.match(query, /way\["highway"\]\(around:650,37\.5563,126\.922\)/);
  assert.match(
    query,
    /nwr\["name"\]\[~"\^\(railway\|public_transport\|place\|leisure\|tourism\|amenity\)\$"~"\^\(station\|halt\|city\|town\|village\|suburb\|quarter\|neighbourhood\|locality\|square\|park\|garden\|stadium\|museum\|attraction\|gallery\|hospital\|university\|school\|library\|marketplace\|townhall\)\$"\]/,
  );
  assert.match(query, /\.roads out geom;\.named out center;$/);
  assert.ok(calls[0].options.signal instanceof AbortSignal);
  assert.equal(
    response.headers.get("cache-control"),
    "public, max-age=3600, s-maxage=86400",
  );
});

test("sanitizes, prioritizes, deduplicates, and caps labels", async () => {
  const minorDuplicate = {
    type: "way",
    tags: { highway: "residential", name: "main road" },
    geometry: [
      { lat: 37.5, lon: 127 },
      { lat: 37.501, lon: 127.001 },
    ],
  };
  const landmark = {
    type: "node",
    lat: 37.502,
    lon: 127.002,
    tags: { leisure: "park", name: "  시민\u0000  공원\n" },
  };
  const place = {
    type: "node",
    lat: 37.503,
    lon: 127.003,
    tags: { place: "neighbourhood", name: "연남동" },
  };
  const transit = {
    type: "node",
    lat: 37.504,
    lon: 127.004,
    tags: {
      public_transport: "station",
      name: "Hongdae",
      "name:ko": "홍대입구역",
    },
  };
  const majorDuplicate = {
    type: "way",
    tags: { highway: "primary", name: "MAIN ROAD" },
    geometry: [
      { lat: 37.505, lon: 127.005 },
      { lat: 37.506, lon: 127.006 },
      { lat: 37.507, lon: 127.007 },
    ],
  };
  const longPlace = {
    type: "node",
    lat: 37.508,
    lon: 127.008,
    tags: { place: "locality", name: "가".repeat(45) },
  };
  const invalid = {
    type: "node",
    lat: 91,
    lon: 127,
    tags: { railway: "station", name: "INVALID" },
  };
  const extras = Array.from({ length: 30 }, (_, index) => ({
    type: "way",
    tags: { highway: "service", name: `도로 ${index}` },
    geometry: [
      { lat: 37.51 + index / 10_000, lon: 127 },
      { lat: 37.51 + index / 10_000, lon: 127.001 },
    ],
  }));
  const response = await handleMapRequest(
    new Request("https://example.test/api/map?lat=37.5&lng=127"),
    {},
    {
      cache: null,
      fetchImpl: async () => overpassResponse([
        minorDuplicate,
        landmark,
        place,
        transit,
        majorDuplicate,
        longPlace,
        invalid,
        ...extras,
      ]),
    },
  );
  const { labels } = await response.json();

  assert.equal(labels.length, 24);
  assert.deepEqual(labels.slice(0, 5).map(({ kind }) => kind), [
    "transit",
    "place",
    "place",
    "road",
    "landmark",
  ]);
  assert.equal(labels[0].name, "Hongdae");
  assert.equal(labels[0].localizedNames.ko, "홍대입구역");
  assert.equal(labels.find(({ name }) => name.startsWith("가")).name, "가".repeat(40));
  assert.equal(labels.find(({ kind }) => kind === "landmark").name, "시민 공원");
  const duplicates = labels.filter(
    ({ name }) => name.toLowerCase() === "main road",
  );
  assert.deepEqual(duplicates, [{
    kind: "road",
    name: "MAIN ROAD",
    point: [37.506, 127.006],
  }]);
  assert.equal(labels.some(({ name }) => name === "INVALID"), false);
});

test("keeps only eight valid bounded OSM language names per label", async () => {
  const languages = ["aa", "ab", "ae", "af", "ak", "am", "an", "ar", "as"];
  const localizedTags = Object.fromEntries(
    languages.map((language, index) => [
      `name:${language}`,
      index === 0 ? "  Name\u0000 zero  " : `Name ${index}`,
    ]),
  );
  const response = await handleMapRequest(
    new Request("https://example.test/api/map?lat=35.6812&lng=139.7671"),
    {},
    {
      cache: null,
      fetchImpl: async () => overpassResponse([{
        type: "node",
        lat: 35.6812,
        lon: 139.7671,
        tags: {
          railway: "station",
          name: "Tokyo Station",
          ...localizedTags,
          "name:bad tag": "Invalid",
        },
      }]),
    },
  );
  const { labels } = await response.json();

  assert.deepEqual(Object.keys(labels[0].localizedNames), languages.slice(0, 8));
  assert.equal(labels[0].localizedNames.aa, "Name zero");
  assert.equal(labels[0].localizedNames["bad tag"], undefined);
});

test("validates coordinates before contacting Overpass", async () => {
  for (const query of [
    "lat=91&lng=126.922",
    "lat=x&lng=126.922",
    "lat=&lng=126.922",
    "lat=37.5&lng=181",
  ]) {
    let calls = 0;
    const response = await handleMapRequest(
      new Request(`https://example.test/api/map?${query}`),
      {},
      {
        fetchImpl: async () => {
          calls += 1;
          return overpassResponse();
        },
      },
    );
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "INVALID_COORDINATE");
    assert.equal(calls, 0);
  }
});

test("leaves non-GET map requests to the API 404", async () => {
  const response = await handleApiRequest(
    new Request("https://example.test/api/map?lat=37.5&lng=127", {
      method: "POST",
    }),
    {},
  );
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, "API_NOT_FOUND");
});

test("prefers major roads and enforces way and point limits", async () => {
  const minor = Array.from({ length: 180 }, (_, index) => ({
    type: "way",
    tags: { highway: "service" },
    geometry: [
      { lat: 37 + index / 10_000, lon: 127 },
      { lat: 37 + index / 10_000, lon: 127.001 },
    ],
  }));
  const major = {
    type: "way",
    tags: { highway: "secondary" },
    geometry: Array.from({ length: 3_900 }, (_, index) => ({
      lat: 37 + index / 1_000_000,
      lon: 127,
    })),
  };
  const response = await handleMapRequest(
    new Request("https://example.test/api/map?lat=37.5&lng=127"),
    {},
    {
      cache: null,
      fetchImpl: async () => overpassResponse([...minor, major]),
    },
  );
  const body = await response.json();
  assert.equal(body.roads[0].kind, "major");
  assert.ok(body.roads.length <= 180);
  assert.ok(
    body.roads.reduce((sum, road) => sum + road.points.length, 0) <= 4_000,
  );
});

test("caches a normalized response by rounded location cell", async () => {
  const entries = new Map();
  const cacheKeys = [];
  const cache = {
    async match(request) {
      cacheKeys.push(request.url);
      return entries.get(request.url)?.clone();
    },
    async put(request, response) {
      entries.set(request.url, response.clone());
    },
  };
  let calls = 0;
  const dependencies = {
    cache,
    fetchImpl: async () => {
      calls += 1;
      return overpassResponse();
    },
  };

  const first = await handleMapRequest(
    new Request("https://example.test/api/map?lat=37.5563&lng=126.922"),
    {},
    dependencies,
  );
  const second = await handleMapRequest(
    new Request("https://example.test/api/map?lat=37.5568&lng=126.923"),
    {},
    dependencies,
  );

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(calls, 1);
  assert.equal(new Set(cacheKeys).size, 1);
  assert.match(cacheKeys[0], /roads-labels-v5/);
});

test("maps upstream, size, and timeout failures to stable errors", async () => {
  const upstream = await handleMapRequest(
    new Request("https://example.test/api/map?lat=37.5&lng=127"),
    {},
    {
      cache: null,
      fetchImpl: async () => new Response("bad", { status: 503 }),
    },
  );
  assert.equal(upstream.status, 502);
  assert.equal((await upstream.json()).error.code, "MAP_UPSTREAM_ERROR");

  const tooLarge = await handleMapRequest(
    new Request("https://example.test/api/map?lat=37.5&lng=127"),
    {},
    {
      cache: null,
      fetchImpl: async () => new Response("x".repeat(1_000_001)),
    },
  );
  assert.equal(tooLarge.status, 502);
  assert.equal((await tooLarge.json()).error.code, "MAP_TOO_LARGE");

  const cleared = [];
  const timeout = await handleMapRequest(
    new Request("https://example.test/api/map?lat=37.5&lng=127"),
    {},
    {
      cache: null,
      setTimeoutImpl: (callback, milliseconds) => {
        assert.equal(milliseconds, 8_000);
        callback();
        return 77;
      },
      clearTimeoutImpl: (timer) => cleared.push(timer),
      fetchImpl: async (_url, { signal }) => {
        assert.equal(signal.aborted, true);
        throw new DOMException("Aborted", "AbortError");
      },
    },
  );
  assert.equal(timeout.status, 504);
  assert.equal((await timeout.json()).error.code, "MAP_TIMEOUT");
  assert.deepEqual(cleared, [77]);
});

test("cell and query helpers are deterministic", () => {
  assert.equal(mapCell(37.5563, 126.922), "37.5552,126.9216");
  assert.equal(
    buildOverpassQuery(37.5563, 126.922),
    '[out:json][timeout:8];way["highway"](around:650,37.5563,126.922)->.roads;nwr["name"][~"^(railway|public_transport|place|leisure|tourism|amenity)$"~"^(station|halt|city|town|village|suburb|quarter|neighbourhood|locality|square|park|garden|stadium|museum|attraction|gallery|hospital|university|school|library|marketplace|townhall)$"](around:650,37.5563,126.922)->.named;.roads out geom;.named out center;',
  );
});
