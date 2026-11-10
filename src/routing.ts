import { apiEndpoint } from "./api-endpoint";
import type {
  Coordinate,
  RouteManeuver,
  RouteValue,
} from "./live-state";
import { orsHeaders } from "./ors-key";

export type RoutingStatus = {
  readonly enabled: boolean;
};

export type Destination = {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly coordinate: Coordinate;
};

export type RouteProfile =
  | "foot-walking"
  | "cycling-regular"
  | "driving-car";

type RouteRequest = {
  readonly start: Coordinate;
  readonly destination: Destination;
  readonly profile: RouteProfile;
};

const REQUEST_TIMEOUT_MS = 8_000;
const ROUTE_PROFILES = new Set<RouteProfile>([
  "foot-walking",
  "cycling-regular",
  "driving-car",
]);

export class RoutingError extends Error {
  readonly disabled: boolean;

  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RoutingError";
    this.disabled = code === "ROUTING_DISABLED";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteCoordinate(value: unknown): value is Coordinate {
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

function finiteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

async function fetchJson(
  input: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );
  try {
    const response = await fetchImpl(apiEndpoint(input), {
      ...init,
      signal: controller.signal,
    });
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new RoutingError(
        "INVALID_RESPONSE",
        "길찾기 서버 응답을 읽지 못했습니다.",
      );
    }
    if (!response.ok) {
      const error = isRecord(payload) && isRecord(payload.error)
        ? payload.error
        : undefined;
      throw new RoutingError(
        typeof error?.code === "string" ? error.code : "ROUTING_ERROR",
        typeof error?.message === "string"
          ? error.message
          : "길찾기 요청에 실패했습니다.",
      );
    }
    return payload;
  } catch (error) {
    if (error instanceof RoutingError) throw error;
    throw new RoutingError(
      controller.signal.aborted ? "ROUTING_TIMEOUT" : "ROUTING_NETWORK_ERROR",
      controller.signal.aborted
        ? "길찾기 요청 시간이 초과되었습니다."
        : "길찾기 서버에 연결하지 못했습니다.",
    );
  } finally {
    globalThis.clearTimeout(timer);
  }
}

export async function getRoutingStatus(
  fetchImpl: typeof fetch = fetch,
): Promise<RoutingStatus> {
  const payload = await fetchJson(
    "/api/routing-status",
    { headers: { accept: "application/json" } },
    fetchImpl,
  );
  if (!isRecord(payload) || typeof payload.enabled !== "boolean") {
    throw new RoutingError(
      "INVALID_RESPONSE",
      "길찾기 상태 응답이 올바르지 않습니다.",
    );
  }
  return { enabled: payload.enabled };
}

export async function validateRoutingKey(
  key: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const payload = await fetchJson(
    "/api/routing-key-test",
    {
      method: "POST",
      headers: {
        accept: "application/json",
        ...orsHeaders(key),
      },
    },
    fetchImpl,
  );
  if (!isRecord(payload) || typeof payload.valid !== "boolean") {
    throw new RoutingError(
      "INVALID_RESPONSE",
      "길찾기 키 확인 응답이 올바르지 않습니다.",
    );
  }
  return payload.valid;
}

function parseDestination(value: unknown): Destination {
  if (
    !isRecord(value)
    || typeof value.id !== "string"
    || value.id.length === 0
    || typeof value.name !== "string"
    || value.name.trim().length === 0
    || typeof value.label !== "string"
    || value.label.trim().length === 0
    || !isFiniteCoordinate(value.coordinate)
  ) {
    throw new RoutingError(
      "INVALID_RESPONSE",
      "목적지 검색 응답이 올바르지 않습니다.",
    );
  }
  return {
    id: value.id,
    name: value.name.trim(),
    label: value.label.trim(),
    coordinate: { ...value.coordinate },
  };
}

export async function searchDestinations(
  query: string,
  fetchImpl: typeof fetch = fetch,
  orsKey?: string,
): Promise<readonly Destination[]> {
  const normalized = query.trim();
  if ([...normalized].length < 2 || [...normalized].length > 80) {
    throw new RoutingError(
      "INVALID_QUERY",
      "목적지를 두 글자 이상 입력하세요.",
    );
  }
  const payload = await fetchJson(
    `/api/geocode?q=${encodeURIComponent(normalized)}`,
    {
      headers: {
        accept: "application/json",
        ...(orsKey ? orsHeaders(orsKey) : {}),
      },
    },
    fetchImpl,
  );
  if (!isRecord(payload) || !Array.isArray(payload.results)) {
    throw new RoutingError(
      "INVALID_RESPONSE",
      "목적지 검색 응답이 올바르지 않습니다.",
    );
  }
  return payload.results.slice(0, 5).map(parseDestination);
}

function parseManeuver(
  value: unknown,
  geometryLength: number,
): RouteManeuver {
  if (
    !isRecord(value)
    || typeof value.instruction !== "string"
    || value.instruction.trim().length === 0
    || !finiteNonNegative(value.distance)
    || !Array.isArray(value.wayPoints)
    || value.wayPoints.length !== 2
    || !value.wayPoints.every(
      (point) =>
        Number.isInteger(point)
        && point >= 0
        && point < geometryLength,
    )
  ) {
    throw new RoutingError(
      "INVALID_RESPONSE",
      "길찾기 응답이 올바르지 않습니다.",
    );
  }
  return {
    instruction: value.instruction.trim(),
    distance: value.distance,
    wayPoints: [value.wayPoints[0], value.wayPoints[1]],
  };
}

export async function requestRoute(
  request: RouteRequest,
  fetchImpl: typeof fetch = fetch,
  orsKey?: string,
): Promise<RouteValue> {
  if (
    !isFiniteCoordinate(request.start)
    || !isFiniteCoordinate(request.destination.coordinate)
    || !ROUTE_PROFILES.has(request.profile)
  ) {
    throw new RoutingError(
      "INVALID_REQUEST",
      "길찾기 요청이 올바르지 않습니다.",
    );
  }
  const payload = await fetchJson(
    "/api/route",
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        ...(orsKey ? orsHeaders(orsKey) : {}),
      },
      body: JSON.stringify({
        start: request.start,
        destination: request.destination.coordinate,
        profile: request.profile,
      }),
    },
    fetchImpl,
  );
  if (
    !isRecord(payload)
    || !Array.isArray(payload.geometry)
    || payload.geometry.length < 2
    || payload.geometry.length > 20_000
    || !finiteNonNegative(payload.distance)
    || !finiteNonNegative(payload.duration)
    || !Array.isArray(payload.maneuvers)
    || payload.maneuvers.length > 500
  ) {
    throw new RoutingError(
      "INVALID_RESPONSE",
      "길찾기 응답이 올바르지 않습니다.",
    );
  }
  const geometry = payload.geometry.map((point) => {
    if (!Array.isArray(point) || point.length !== 2) {
      throw new RoutingError(
        "INVALID_RESPONSE",
        "길찾기 응답이 올바르지 않습니다.",
      );
    }
    const coordinate = { latitude: point[0], longitude: point[1] };
    if (!isFiniteCoordinate(coordinate)) {
      throw new RoutingError(
        "INVALID_RESPONSE",
        "길찾기 응답이 올바르지 않습니다.",
      );
    }
    return coordinate;
  });
  const maneuvers = payload.maneuvers.map(
    (maneuver) => parseManeuver(maneuver, geometry.length),
  );
  return {
    destinationName: request.destination.name,
    geometry,
    maneuvers,
    activeManeuverIndex: 0,
    remainingDistance: payload.distance,
    profile: request.profile,
  };
}
