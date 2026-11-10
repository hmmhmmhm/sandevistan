import assert from "node:assert/strict";
import test from "node:test";
import { handleApiRequest } from "../server/api-router.js";

const SECRET = "fake-ors-secret";
const DEVICE_SECRET = "fake-device-ors-secret";
const START = { latitude: 37.5563, longitude: 126.922 };
const DESTINATION = { latitude: 37.5547, longitude: 126.9707 };

function jsonRequest(url, body) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function routeRequest(overrides = {}) {
  return jsonRequest("https://example.test/api/route", {
    start: START,
    destination: DESTINATION,
    profile: "foot-walking",
    ...overrides,
  });
}

function upstreamJson(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

async function assertNoSecret(response) {
  assert.doesNotMatch(
    await response.clone().text(),
    /fake-ors-secret|fake-device-ors-secret/,
  );
}

test("disables every ORS endpoint cleanly when the server secret is absent", async () => {
  const status = await handleApiRequest(
    new Request("https://example.test/api/routing-status"),
    {},
  );
  const geocode = await handleApiRequest(
    new Request("https://example.test/api/geocode?q=서울역"),
    {},
  );
  const route = await handleApiRequest(routeRequest(), {});

  for (const response of [status, geocode, route]) {
    await assertNoSecret(response);
  }
  assert.equal(status.status, 200);
  assert.deepEqual(await status.json(), { enabled: false });
  assert.equal(status.headers.get("cache-control"), "no-store");
  for (const response of [geocode, route]) {
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, "ROUTING_DISABLED");
  }
});

test("validates a device key and never returns it", async () => {
  const calls = [];
  const response = await handleApiRequest(
    new Request("https://example.test/api/routing-key-test", {
      method: "POST",
      headers: { "x-sandevistan-ors-key": DEVICE_SECRET },
    }),
    {},
    {
      fetchImpl: async (url, options) => {
        calls.push({ url: String(url), options });
        return upstreamJson({ features: [] });
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.clone().json(), { valid: true });
  await assertNoSecret(response);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(calls.length, 1);
  const upstream = new URL(calls[0].url);
  assert.equal(upstream.origin, "https://api.openrouteservice.org");
  assert.equal(upstream.pathname, "/geocode/search");
  assert.equal(upstream.searchParams.get("api_key"), DEVICE_SECRET);
  assert.equal(calls[0].options.redirect, "manual");
});

test("prefers the request key over the development fallback", async () => {
  const userKey = "device-owned-key-123456";
  const calls = [];
  const response = await handleApiRequest(
    new Request("https://example.test/api/geocode?q=Seoul", {
      headers: { "x-sandevistan-ors-key": userKey },
    }),
    { ORS_API_KEY: SECRET },
    {
      fetchImpl: async (url) => {
        calls.push(String(url));
        return upstreamJson({ features: [] });
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(new URL(calls[0]).searchParams.get("api_key"), userKey);
  assert.doesNotMatch(await response.text(), /device-owned-key|fake-ors-secret/);
});

test("normalizes at most five valid Korean geocoding results", async () => {
  const calls = [];
  const features = [
    {
      properties: {
        id: 101,
        name: "서울역",
        label: "서울역, 서울특별시, 대한민국",
      },
      geometry: { coordinates: [126.9707, 37.5547] },
    },
    {
      properties: {
        gid: "venue.2",
        name: "서울역 광장",
        label: "서울역 광장",
      },
      geometry: { coordinates: [126.971, 37.555] },
    },
    {
      properties: { id: "bad", name: "좌표 오류", label: "좌표 오류" },
      geometry: { coordinates: [181, 37.5] },
    },
    ...Array.from({ length: 5 }, (_, index) => ({
      properties: {
        id: `extra-${index}`,
        name: `후보 ${index}`,
        label: `후보 ${index}, 서울`,
      },
      geometry: { coordinates: [126.972 + index / 10_000, 37.556] },
    })),
  ];
  const response = await handleApiRequest(
    new Request(
      "https://example.test/api/geocode?q=%20%EC%84%9C%EC%9A%B8%EC%97%AD%20",
    ),
    { ORS_API_KEY: SECRET },
    {
      fetchImpl: async (url, options) => {
        calls.push({ url: String(url), options });
        return upstreamJson({ features });
      },
    },
  );

  assert.equal(response.status, 200);
  await assertNoSecret(response);
  assert.deepEqual(await response.json(), {
    results: [
      {
        id: "101",
        name: "서울역",
        label: "서울역, 서울특별시, 대한민국",
        coordinate: { latitude: 37.5547, longitude: 126.9707 },
      },
      {
        id: "venue.2",
        name: "서울역 광장",
        label: "서울역 광장",
        coordinate: { latitude: 37.555, longitude: 126.971 },
      },
      ...Array.from({ length: 3 }, (_, index) => ({
        id: `extra-${index}`,
        name: `후보 ${index}`,
        label: `후보 ${index}, 서울`,
        coordinate: {
          latitude: 37.556,
          longitude: 126.972 + index / 10_000,
        },
      })),
    ],
  });
  assert.equal(calls.length, 1);
  const upstream = new URL(calls[0].url);
  assert.equal(
    `${upstream.origin}${upstream.pathname}`,
    "https://api.openrouteservice.org/geocode/search",
  );
  assert.equal(upstream.searchParams.get("api_key"), SECRET);
  assert.equal(upstream.searchParams.get("text"), "서울역");
  assert.equal(upstream.searchParams.get("boundary.country"), "KR");
  assert.equal(upstream.searchParams.get("size"), "5");
  assert.equal(calls[0].options.redirect, "manual");
  assert.equal(calls[0].options.headers.accept, "application/json");
  assert.ok(calls[0].options.signal instanceof AbortSignal);
});

test("normalizes a directions result and sends the exact ORS request", async () => {
  const calls = [];
  const response = await handleApiRequest(
    routeRequest(),
    { ORS_API_KEY: SECRET },
    {
      fetchImpl: async (url, options) => {
        calls.push({ url: String(url), options });
        return upstreamJson({
          features: [{
            geometry: {
              type: "LineString",
              coordinates: [
                [126.922, 37.5563],
                [126.95, 37.555],
                [126.9707, 37.5547],
              ],
            },
            properties: {
              summary: { distance: 4380.5, duration: 3120.2 },
              segments: [{
                steps: [
                  {
                    instruction: "양화로 방면으로 직진",
                    distance: 120.4,
                    way_points: [0, 1],
                  },
                  {
                    instruction: "오른쪽으로 도세요",
                    distance: 4260.1,
                    way_points: [1, 2],
                  },
                ],
              }],
            },
          }],
        });
      },
    },
  );

  assert.equal(response.status, 200);
  await assertNoSecret(response);
  assert.deepEqual(await response.json(), {
    geometry: [
      [37.5563, 126.922],
      [37.555, 126.95],
      [37.5547, 126.9707],
    ],
    distance: 4380.5,
    duration: 3120.2,
    maneuvers: [
      {
        instruction: "양화로 방면으로 직진",
        distance: 120.4,
        wayPoints: [0, 1],
      },
      {
        instruction: "오른쪽으로 도세요",
        distance: 4260.1,
        wayPoints: [1, 2],
      },
    ],
  });
  assert.equal(
    calls[0].url,
    "https://api.openrouteservice.org/v2/directions/foot-walking/geojson",
  );
  assert.deepEqual(calls[0].options, {
    method: "POST",
    headers: {
      authorization: SECRET,
      "content-type": "application/json",
      accept: "application/geo+json",
    },
    body: JSON.stringify({
      coordinates: [
        [126.922, 37.5563],
        [126.9707, 37.5547],
      ],
      instructions: true,
      language: "en",
    }),
    redirect: "manual",
    signal: calls[0].options.signal,
  });
  assert.ok(calls[0].options.signal instanceof AbortSignal);
});

test("validates geocode queries before contacting ORS", async () => {
  for (const query of ["", "a", "가".repeat(81)]) {
    let calls = 0;
    const response = await handleApiRequest(
      new Request(
        `https://example.test/api/geocode?q=${encodeURIComponent(query)}`,
      ),
      { ORS_API_KEY: SECRET },
      { fetchImpl: async () => {
        calls += 1;
        return upstreamJson({ features: [] });
      } },
    );

    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "INVALID_QUERY");
    assert.equal(calls, 0);
  }
});

test("validates route JSON, profile, and coordinates before contacting ORS", async () => {
  const cases = [
    {
      request: jsonRequest("https://example.test/api/route", "{"),
      code: "INVALID_JSON",
    },
    {
      request: routeRequest({ profile: "wheelchair" }),
      code: "INVALID_PROFILE",
    },
    {
      request: routeRequest({
        start: { latitude: 91, longitude: 126.922 },
      }),
      code: "INVALID_COORDINATE",
    },
    {
      request: routeRequest({
        destination: { latitude: 37.5, longitude: -181 },
      }),
      code: "INVALID_COORDINATE",
    },
  ];

  for (const { request, code } of cases) {
    let calls = 0;
    const response = await handleApiRequest(
      request,
      { ORS_API_KEY: SECRET },
      { fetchImpl: async () => {
        calls += 1;
        return upstreamJson({});
      } },
    );

    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, code);
    assert.equal(calls, 0);
  }
});

test("maps ORS direction failures to stable responses without leaking the key", async () => {
  const upstream = await handleApiRequest(
    routeRequest(),
    { ORS_API_KEY: SECRET },
    { fetchImpl: async () => new Response(SECRET, { status: 429 }) },
  );
  const malformed = await handleApiRequest(
    routeRequest(),
    { ORS_API_KEY: SECRET },
    { fetchImpl: async () => upstreamJson({ features: [] }) },
  );
  const timeout = await handleApiRequest(
    routeRequest(),
    { ORS_API_KEY: SECRET },
    {
      setTimeoutImpl: (callback, milliseconds) => {
        assert.equal(milliseconds, 8_000);
        callback();
        return 42;
      },
      clearTimeoutImpl: () => undefined,
      fetchImpl: async (_url, { signal }) => {
        assert.equal(signal.aborted, true);
        throw new DOMException(SECRET, "AbortError");
      },
    },
  );

  for (const response of [upstream, malformed]) {
    await assertNoSecret(response);
    assert.equal(response.status, 502);
    assert.equal((await response.json()).error.code, "ROUTE_UPSTREAM_ERROR");
  }
  await assertNoSecret(timeout);
  assert.equal(timeout.status, 504);
  assert.equal((await timeout.json()).error.code, "ROUTE_TIMEOUT");
});

test("rejects oversized ORS direction responses", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(1_200_000));
      controller.enqueue(new Uint8Array(1_200_000));
    },
    cancel() {
      cancelled = true;
    },
  });
  const response = await handleApiRequest(
    routeRequest(),
    { ORS_API_KEY: SECRET },
    { fetchImpl: async () => new Response(body, { status: 200 }) },
  );

  await assertNoSecret(response);
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error.code, "ROUTE_TOO_LARGE");
  assert.equal(cancelled, true);
});

test("leaves unsupported ORS methods to the API 404", async () => {
  for (const request of [
    new Request("https://example.test/api/routing-status", { method: "POST" }),
    new Request("https://example.test/api/geocode?q=서울역", { method: "POST" }),
    new Request("https://example.test/api/route"),
  ]) {
    const response = await handleApiRequest(request, { ORS_API_KEY: SECRET });
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error.code, "API_NOT_FOUND");
  }
});
