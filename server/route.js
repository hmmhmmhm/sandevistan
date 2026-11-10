import {
  createTimeout,
  jsonResponse,
  readLimitedBytes,
} from "./http.js";

const GEOCODE_URL = "https://api.openrouteservice.org/geocode/search";
const DIRECTIONS_BASE_URL =
  "https://api.openrouteservice.org/v2/directions";
const ROUTE_PROFILES = new Set([
  "foot-walking",
  "cycling-regular",
  "driving-car",
]);
const TIMEOUT_MS = 8_000;
const GEOCODE_MAX_BYTES = 1_000_000;
const ROUTE_MAX_BYTES = 2_000_000;
const REQUEST_MAX_BYTES = 32_000;

function routeError(code, message, status) {
  return jsonResponse(
    { error: { code, message } },
    {
      status,
      headers: { "cache-control": "no-store" },
    },
  );
}

function serverKey(env) {
  if (typeof env?.ORS_API_KEY !== "string") return undefined;
  const key = env.ORS_API_KEY.trim();
  return key.length > 0 ? key : undefined;
}

function requestKey(request, env) {
  const supplied = request.headers
    .get("x-sandevistan-ors-key")
    ?.trim();
  if (supplied !== undefined) {
    return supplied.length >= 16
      && supplied.length <= 4_096
      && !/[\u0000-\u001f\u007f]/.test(supplied)
      ? supplied
      : undefined;
  }
  return serverKey(env);
}

export function routingStatus(env) {
  return { enabled: serverKey(env) !== undefined };
}

export async function handleRoutingStatus(_request, env) {
  return jsonResponse(routingStatus(env), {
    headers: { "cache-control": "no-store" },
  });
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteCoordinate(value) {
  return isRecord(value)
    && typeof value.latitude === "number"
    && Number.isFinite(value.latitude)
    && value.latitude >= -90
    && value.latitude <= 90
    && typeof value.longitude === "number"
    && Number.isFinite(value.longitude)
    && value.longitude >= -180
    && value.longitude <= 180;
}

function normalizedText(value) {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizedGeocodeFeature(feature) {
  if (!isRecord(feature) || !isRecord(feature.properties)) return undefined;
  const coordinates = feature.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return undefined;
  const coordinate = {
    latitude: coordinates[1],
    longitude: coordinates[0],
  };
  const identifier = feature.properties.id ?? feature.properties.gid;
  const name = normalizedText(feature.properties.name);
  const label = normalizedText(feature.properties.label);
  if (
    (typeof identifier !== "string" && typeof identifier !== "number")
    || !name
    || !label
    || !isFiniteCoordinate(coordinate)
  ) {
    return undefined;
  }
  return {
    id: String(identifier),
    name,
    label,
    coordinate,
  };
}

function normalizeGeocodePayload(payload) {
  const features = Array.isArray(payload?.features) ? payload.features : [];
  return {
    results: features
      .flatMap((feature) => {
        const normalized = normalizedGeocodeFeature(feature);
        return normalized ? [normalized] : [];
      })
      .slice(0, 5),
  };
}

export async function handleGeocodeRequest(
  request,
  env,
  {
    fetchImpl = fetch,
    setTimeoutImpl = setTimeout,
    clearTimeoutImpl = clearTimeout,
  } = {},
) {
  const key = requestKey(request, env);
  if (!key) {
    return routeError(
      "ROUTING_DISABLED",
      "Routing is not configured",
      503,
    );
  }

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const queryLength = [...query].length;
  if (queryLength < 2 || queryLength > 80) {
    return routeError(
      "INVALID_QUERY",
      "Destination query must contain 2 to 80 characters",
      400,
    );
  }

  const upstreamUrl = new URL(GEOCODE_URL);
  upstreamUrl.searchParams.set("api_key", key);
  upstreamUrl.searchParams.set("text", query);
  upstreamUrl.searchParams.set("boundary.country", "KR");
  upstreamUrl.searchParams.set("size", "5");
  const timeout = createTimeout(
    TIMEOUT_MS,
    setTimeoutImpl,
    clearTimeoutImpl,
  );
  try {
    const upstream = await fetchImpl(upstreamUrl, {
      redirect: "manual",
      headers: { accept: "application/json" },
      signal: timeout.signal,
    });
    if (!upstream.ok) {
      return routeError(
        "GEOCODE_UPSTREAM_ERROR",
        "Destination search failed",
        502,
      );
    }
    const bytes = await readLimitedBytes(upstream, GEOCODE_MAX_BYTES);
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    return jsonResponse(normalizeGeocodePayload(payload), {
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return routeError(
      "GEOCODE_UPSTREAM_ERROR",
      "Destination search failed",
      502,
    );
  } finally {
    timeout.dispose();
  }
}

export async function handleRoutingKeyTest(
  request,
  env,
  {
    fetchImpl = fetch,
    setTimeoutImpl = setTimeout,
    clearTimeoutImpl = clearTimeout,
  } = {},
) {
  const key = requestKey(request, env);
  if (!key) {
    return routeError(
      "INVALID_ROUTING_KEY",
      "Routing key is invalid",
      400,
    );
  }
  const upstreamUrl = new URL(GEOCODE_URL);
  upstreamUrl.searchParams.set("api_key", key);
  upstreamUrl.searchParams.set("text", "Seoul");
  upstreamUrl.searchParams.set("size", "1");
  const timeout = createTimeout(
    TIMEOUT_MS,
    setTimeoutImpl,
    clearTimeoutImpl,
  );
  try {
    const upstream = await fetchImpl(upstreamUrl, {
      redirect: "manual",
      headers: { accept: "application/json" },
      signal: timeout.signal,
    });
    return upstream.ok
      ? jsonResponse(
        { valid: true },
        { headers: { "cache-control": "no-store" } },
      )
      : routeError(
        "INVALID_ROUTING_KEY",
        "Routing key validation failed",
        401,
      );
  } catch {
    return routeError(
      timeout.signal.aborted
        ? "ROUTING_KEY_TIMEOUT"
        : "ROUTING_KEY_UPSTREAM_ERROR",
      "Routing key validation failed",
      timeout.signal.aborted ? 504 : 502,
    );
  } finally {
    timeout.dispose();
  }
}

async function readRouteRequest(request) {
  try {
    const bytes = await readLimitedBytes(
      new Response(request.body),
      REQUEST_MAX_BYTES,
    );
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    return isRecord(payload) ? payload : undefined;
  } catch {
    return undefined;
  }
}

function finiteNonNegative(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function normalizeRoutePayload(payload) {
  const feature = payload?.features?.[0];
  const coordinates = feature?.geometry?.coordinates;
  const summary = feature?.properties?.summary;
  const steps = feature?.properties?.segments?.[0]?.steps;
  if (
    feature?.geometry?.type !== "LineString"
    || !Array.isArray(coordinates)
    || coordinates.length < 2
    || !isRecord(summary)
    || !finiteNonNegative(summary.distance)
    || !finiteNonNegative(summary.duration)
    || !Array.isArray(steps)
  ) {
    return undefined;
  }

  const geometry = coordinates.map((point) => {
    if (!Array.isArray(point) || point.length < 2) return undefined;
    const coordinate = {
      latitude: point[1],
      longitude: point[0],
    };
    return isFiniteCoordinate(coordinate)
      ? [coordinate.latitude, coordinate.longitude]
      : undefined;
  });
  if (geometry.some((point) => point === undefined)) return undefined;

  const maneuvers = steps.map((step) => {
    const instruction = normalizedText(step?.instruction);
    const wayPoints = step?.way_points;
    if (
      !instruction
      || !finiteNonNegative(step?.distance)
      || !Array.isArray(wayPoints)
      || wayPoints.length !== 2
      || !wayPoints.every(
        (point) =>
          Number.isInteger(point)
          && point >= 0
          && point < geometry.length,
      )
      || wayPoints[0] > wayPoints[1]
    ) {
      return undefined;
    }
    return {
      instruction,
      distance: step.distance,
      wayPoints: [wayPoints[0], wayPoints[1]],
    };
  });
  if (maneuvers.some((maneuver) => maneuver === undefined)) return undefined;

  return {
    geometry,
    distance: summary.distance,
    duration: summary.duration,
    maneuvers,
  };
}

export async function handleRouteRequest(
  request,
  env,
  {
    fetchImpl = fetch,
    setTimeoutImpl = setTimeout,
    clearTimeoutImpl = clearTimeout,
  } = {},
) {
  const key = requestKey(request, env);
  if (!key) {
    return routeError(
      "ROUTING_DISABLED",
      "Routing is not configured",
      503,
    );
  }

  const payload = await readRouteRequest(request);
  if (!payload) {
    return routeError("INVALID_JSON", "Route request JSON is invalid", 400);
  }
  if (!ROUTE_PROFILES.has(payload.profile)) {
    return routeError(
      "INVALID_PROFILE",
      "Route profile is not supported",
      400,
    );
  }
  if (
    !isFiniteCoordinate(payload.start)
    || !isFiniteCoordinate(payload.destination)
  ) {
    return routeError(
      "INVALID_COORDINATE",
      "Route coordinate is invalid",
      400,
    );
  }

  const timeout = createTimeout(
    TIMEOUT_MS,
    setTimeoutImpl,
    clearTimeoutImpl,
  );
  try {
    const upstream = await fetchImpl(
      `${DIRECTIONS_BASE_URL}/${payload.profile}/geojson`,
      {
        method: "POST",
        headers: {
          authorization: key,
          "content-type": "application/json",
          accept: "application/geo+json",
        },
        body: JSON.stringify({
          coordinates: [
            [payload.start.longitude, payload.start.latitude],
            [payload.destination.longitude, payload.destination.latitude],
          ],
          instructions: true,
          language: "en",
        }),
        redirect: "manual",
        signal: timeout.signal,
      },
    );
    if (!upstream.ok) {
      return routeError(
        "ROUTE_UPSTREAM_ERROR",
        "Route request failed",
        502,
      );
    }
    const bytes = await readLimitedBytes(upstream, ROUTE_MAX_BYTES);
    const normalized = normalizeRoutePayload(
      JSON.parse(new TextDecoder().decode(bytes)),
    );
    return normalized
      ? jsonResponse(normalized, {
        headers: { "cache-control": "no-store" },
      })
      : routeError(
        "ROUTE_UPSTREAM_ERROR",
        "Route request failed",
        502,
      );
  } catch (error) {
    if (timeout.signal.aborted || error?.name === "AbortError") {
      return routeError("ROUTE_TIMEOUT", "Route request timed out", 504);
    }
    if (error instanceof Error && error.message === "RESPONSE_TOO_LARGE") {
      return routeError(
        "ROUTE_TOO_LARGE",
        "Route response is too large",
        502,
      );
    }
    return routeError(
      "ROUTE_UPSTREAM_ERROR",
      "Route request failed",
      502,
    );
  } finally {
    timeout.dispose();
  }
}
