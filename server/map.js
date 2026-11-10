import {
  createTimeout,
  jsonResponse,
  readLimitedBytes,
} from "./http.js";

export const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
export const MAP_RADIUS_METERS = 650;

const MAX_BYTES = 1_000_000;
const MAX_ROADS = 180;
const MAX_POINTS = 4_000;
const MAX_LABELS = 24;
const MAX_LABEL_CODE_POINTS = 40;
const MAX_LOCALIZED_NAMES = 8;
const TIMEOUT_MS = 8_000;
const MAP_CELL_DEGREES = 0.0018;
const MAJOR_HIGHWAYS = new Set([
  "motorway",
  "trunk",
  "primary",
  "secondary",
  "tertiary",
  "motorway_link",
  "trunk_link",
  "primary_link",
  "secondary_link",
  "tertiary_link",
]);

function mapError(code, message, status) {
  return jsonResponse({ error: { code, message } }, { status });
}

function coordinateParameter(value, minimum, maximum) {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    return null;
  }
  return parsed;
}

export function mapCell(latitude, longitude) {
  const lat = Math.floor(latitude / MAP_CELL_DEGREES) * MAP_CELL_DEGREES;
  const lng = Math.floor(longitude / MAP_CELL_DEGREES) * MAP_CELL_DEGREES;
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

export function buildOverpassQuery(latitude, longitude) {
  const around = `(around:${MAP_RADIUS_METERS},${latitude},${longitude})`;
  return [
    "[out:json][timeout:8];",
    `way["highway"]${around}->.roads;`,
    `nwr["name"][~"^(railway|public_transport|place|leisure|tourism|amenity)$"` +
      `~"^(station|halt|city|town|village|suburb|quarter|neighbourhood|locality|square|park|garden|stadium|museum|attraction|gallery|hospital|university|school|library|marketplace|townhall)$"]${around}->.named;`,
    ".roads out geom;",
    ".named out center;",
  ].join("");
}

function normalizedRoad(element) {
  const highway = element?.tags?.highway;
  if (element?.type !== "way" || typeof highway !== "string") return null;
  const points = Array.isArray(element.geometry)
    ? element.geometry.flatMap((point) => {
      const latitude = Number(point?.lat);
      const longitude = Number(point?.lon);
      return Number.isFinite(latitude) && Number.isFinite(longitude)
        ? [[latitude, longitude]]
        : [];
    })
    : [];
  if (points.length < 2) return null;
  return {
    kind: MAJOR_HIGHWAYS.has(highway) ? "major" : "minor",
    points,
  };
}

function normalizedName(raw) {
  if (typeof raw !== "string") return null;
  const clean = raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return null;
  return [...clean].slice(0, MAX_LABEL_CODE_POINTS).join("").trimEnd();
}

function normalizedNames(tags) {
  const name = normalizedName(tags?.name);
  if (!name) return null;
  const localizedNames = Object.entries(tags ?? {})
    .flatMap(([key, value]) => {
      if (!key.startsWith("name:")) return [];
      const language = key.slice(5);
      if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(language)) return [];
      const localized = normalizedName(value);
      return localized ? [[language, localized]] : [];
    })
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, MAX_LOCALIZED_NAMES);
  return {
    name,
    ...(localizedNames.length > 0 && {
      localizedNames: Object.fromEntries(localizedNames),
    }),
  };
}

function geographicPoint(latitudeValue, longitudeValue) {
  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  return Number.isFinite(latitude)
    && latitude >= -90
    && latitude <= 90
    && Number.isFinite(longitude)
    && longitude >= -180
    && longitude <= 180
    ? [latitude, longitude]
    : null;
}

function labelPoint(element, road) {
  if (element?.type === "node") {
    const point = geographicPoint(element.lat, element.lon);
    if (point) return point;
  }
  const center = geographicPoint(element?.center?.lat, element?.center?.lon);
  if (center) return center;
  if (!road) return null;
  return road.points[Math.floor(road.points.length / 2)] ?? null;
}

function labelKind(element, road) {
  if (
    ["station", "halt"].includes(element?.tags?.railway)
    || element?.tags?.public_transport === "station"
  ) {
    return { kind: "transit", priority: 0 };
  }
  if (typeof element?.tags?.place === "string") {
    return { kind: "place", priority: 1 };
  }
  if (road?.kind === "major") {
    return { kind: "road", priority: 2 };
  }
  if (
    element?.tags?.leisure
    || element?.tags?.tourism
    || element?.tags?.amenity
  ) {
    return { kind: "landmark", priority: 3 };
  }
  if (road) return { kind: "road", priority: 4 };
  return null;
}

function normalizedLabels(elements) {
  const candidates = elements.flatMap((element, sourceIndex) => {
    const road = normalizedRoad(element);
    const classification = labelKind(element, road);
    const names = normalizedNames(element?.tags);
    const point = labelPoint(element, road);
    if (!classification || !names || !point) return [];
    return [{
      ...classification,
      ...names,
      point,
      sourceIndex,
    }];
  });
  candidates.sort(
    (left, right) =>
      left.priority - right.priority
      || left.sourceIndex - right.sourceIndex,
  );

  const labels = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const key = candidate.name.toLocaleLowerCase("ko-KR");
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push({
      kind: candidate.kind,
      name: candidate.name,
      ...(candidate.localizedNames && {
        localizedNames: candidate.localizedNames,
      }),
      point: candidate.point,
    });
    if (labels.length >= MAX_LABELS) break;
  }
  return labels;
}

export function normalizeMapPayload(payload, cell) {
  const elements = Array.isArray(payload?.elements) ? payload.elements : [];
  const candidates = elements.map(normalizedRoad).filter(Boolean);
  candidates.sort((left, right) => {
    if (left.kind === right.kind) return 0;
    return left.kind === "major" ? -1 : 1;
  });

  const roads = [];
  let pointCount = 0;
  for (const candidate of candidates) {
    if (roads.length >= MAX_ROADS) break;
    const remaining = MAX_POINTS - pointCount;
    if (remaining < 2) break;
    const points = candidate.points.slice(0, remaining);
    if (points.length < 2) continue;
    roads.push({ kind: candidate.kind, points });
    pointCount += points.length;
  }
  return {
    cell,
    attribution: "© OSM CONTRIBUTORS",
    roads,
    labels: normalizedLabels(elements),
  };
}

function cacheRequest(cell) {
  return new Request(
    `https://sandevistan-map-cache.invalid/roads-labels-v5?cell=${encodeURIComponent(cell)}`,
  );
}

export async function handleMapRequest(
  request,
  _env,
  {
    fetchImpl = fetch,
    cache = globalThis.caches?.default,
    setTimeoutImpl = setTimeout,
    clearTimeoutImpl = clearTimeout,
  } = {},
) {
  const url = new URL(request.url);
  const latitude = coordinateParameter(
    url.searchParams.get("lat"),
    -90,
    90,
  );
  const longitude = coordinateParameter(
    url.searchParams.get("lng"),
    -180,
    180,
  );
  if (latitude === null || longitude === null) {
    return mapError(
      "INVALID_COORDINATE",
      "Latitude or longitude is invalid",
      400,
    );
  }

  const cell = mapCell(latitude, longitude);
  const key = cacheRequest(cell);
  if (cache) {
    try {
      const cached = await cache.match(key);
      if (cached) return cached;
    } catch {
      // A cache outage must not prevent a live map response.
    }
  }

  const timeout = createTimeout(
    TIMEOUT_MS,
    setTimeoutImpl,
    clearTimeoutImpl,
  );
  try {
    const upstream = await fetchImpl(OVERPASS_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        "user-agent": "SANDEVISTAN-G2-Personal-Prototype/0.1",
      },
      body: new URLSearchParams({
        data: buildOverpassQuery(latitude, longitude),
      }),
      redirect: "manual",
      signal: timeout.signal,
    });
    if (!upstream.ok) {
      return mapError(
        "MAP_UPSTREAM_ERROR",
        "Map upstream request failed",
        502,
      );
    }

    const bytes = await readLimitedBytes(upstream, MAX_BYTES);
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    const response = jsonResponse(normalizeMapPayload(payload, cell), {
      headers: {
        "cache-control": "public, max-age=3600, s-maxage=86400",
      },
    });
    if (cache) {
      try {
        await cache.put(key, response.clone());
      } catch {
        // The current response remains usable when cache persistence fails.
      }
    }
    return response;
  } catch (error) {
    if (timeout.signal.aborted || error?.name === "AbortError") {
      return mapError("MAP_TIMEOUT", "Map request timed out", 504);
    }
    if (error instanceof Error && error.message === "RESPONSE_TOO_LARGE") {
      return mapError("MAP_TOO_LARGE", "Map response is too large", 502);
    }
    return mapError(
      "MAP_UPSTREAM_ERROR",
      "Map upstream request failed",
      502,
    );
  } finally {
    timeout.dispose();
  }
}
