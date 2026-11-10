import { getReleaseCopy } from "./release-i18n";
import { aiDetailLines } from "./fast-ai-detail-style";
import { translateHud } from "./hud-i18n";
import { fixedHud } from "./fixed-hud-i18n";
import { translatePhone } from "./phone-i18n";
import type {
  Coordinate,
  DataState,
  LiveDashboardState,
  LocationValue,
  MapValue,
  RouteValue,
} from "./live-state";
import { mapLabelName, projectCoordinate } from "./map";
import type { PhoneLocale } from "./phone-types";
import {
  layoutMapLabels,
  type MapLabelViewport,
} from "./map-label-layout";
import {
  drawFastCanvasPath as drawPath,
  drawFastCanvasText as drawText,
  FAST_CANVAS_COLOR as COLOR,
  type FastCanvasColor as HudColor,
  type FastCanvasPoint as Point,
} from "./fast-canvas-style";
import {
  drawFullscreenMapFooter,
  drawFullscreenMapHeader,
} from "./fast-map-frame";
export const EMBEDDED_MAP_VIEWPORT: MapLabelViewport = {
  minX: 18,
  maxX: 270,
  minY: 34,
  maxY: 244,
  centerX: 144,
  centerY: 144,
  pixelRadius: 112,
};
export const FULLSCREEN_MAP_VIEWPORT: MapLabelViewport = {
  minX: 18,
  maxX: 558,
  minY: 34,
  maxY: 244,
  centerX: 288,
  centerY: 144,
  pixelRadius: 112,
};

function fillPolygon(
  context: CanvasRenderingContext2D,
  points: readonly Point[],
  color: HudColor,
) {
  const [first, ...rest] = points;
  if (!first) return;
  context.beginPath();
  context.moveTo(...first);
  for (const point of rest) context.lineTo(...point);
  context.closePath();
  context.fillStyle = color;
  context.fill();
}

function drawFrame(context: CanvasRenderingContext2D) {
  const x = 8;
  const y = 8;
  const width = 272;
  const height = 272;
  const corner = 18;
  const right = x + width;
  const bottom = y + height;
  context.fillStyle = COLOR.dim;
  context.fillRect(x, y, corner, 1);
  context.fillRect(x, y, 1, corner);
  context.fillRect(right - corner, y, corner, 1);
  context.fillRect(right - 1, y, 1, corner);
  context.fillRect(x, bottom - 1, corner, 1);
  context.fillRect(x, bottom - corner, 1, corner);
  context.fillRect(right - corner, bottom - 1, corner, 1);
  context.fillRect(right - 1, bottom - corner, 1, corner);
  context.fillStyle = COLOR.primary;
  context.fillRect(x, y, 10, 2);
}

function clamped(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function projected(
  point: Coordinate,
  center: Coordinate,
  viewport: MapLabelViewport,
  radiusMeters: number,
): Point {
  const output = projectCoordinate(point, center, radiusMeters);
  return [
    clamped(
      viewport.centerX
        + (output.x - 144) * viewport.pixelRadius / 112,
      viewport.minX,
      viewport.maxX,
    ),
    clamped(
      viewport.centerY
        + (output.y - 144) * viewport.pixelRadius / 112,
      viewport.minY,
      viewport.maxY,
    ),
  ];
}

function mapDescriptor(
  location: DataState<LocationValue>,
  map: DataState<MapValue>,
  locale: PhoneLocale,
) {
  const source = !location.value || location.value.source === "demo"
    ? "NO GPS"
    : location.value.source === "live"
    ? "LIVE"
    : location.value?.source === "cache"
      ? "LAST FIX"
      : "NO GPS";
  const value = map.status === "fresh" || map.status === "stale"
    ? map.value
    : undefined;
  const hasMapData = Boolean(
    value && (value.roads.length > 0 || value.labels.length > 0),
  );
  const layer = hasMapData
    ? map.status === "stale" ? "OSM LAST" : "OSM"
    : "NO DATA";
  return { source: fixedHud(locale, source), layer: fixedHud(locale, layer) };
}

function mapHeader(
  location: DataState<LocationValue>,
  map: DataState<MapValue>,
  locale: PhoneLocale,
) {
  const { source, layer } = mapDescriptor(location, map, locale);
  return `${translatePhone(locale, "location")} // ${source} · ${layer}`;
}

function drawRoads(
  context: CanvasRenderingContext2D,
  map: MapValue,
  center: Coordinate,
  viewport: MapLabelViewport,
  radiusMeters: number,
) {
  for (const kind of ["minor", "major"] as const) {
    for (const road of map.roads) {
      if (road.kind !== kind) continue;
      drawPath(
        context,
        road.points.map(
          (point) => projected(point, center, viewport, radiusMeters),
        ),
        kind === "minor" ? COLOR.dim : COLOR.secondary,
        kind === "minor" ? 1 : 2,
      );
    }
  }
}

function drawMapLabels(
  context: CanvasRenderingContext2D,
  map: MapValue,
  center: Coordinate,
  viewport: MapLabelViewport,
  radiusMeters: number,
  maximumLabels: number,
  locale: PhoneLocale,
) {
  const localizedLabels = map.labels.map((label) => ({
    ...label,
    name: mapLabelName(label, locale),
  }));
  for (const label of layoutMapLabels(localizedLabels, center, {
    viewport,
    radiusMeters,
    maximumLabels,
  })) {
    context.fillStyle = COLOR.background;
    context.fillRect(
      label.x - 2,
      label.y - 1,
      label.width + 4,
      label.height + 2,
    );
    drawText(
      context,
      label.text,
      label.x,
      label.y,
      label.fontSize,
      label.kind === "transit" || label.kind === "place"
        ? COLOR.primary
        : COLOR.secondary,
      "bold",
    );
  }
}

function activeRoute(
  route: DataState<RouteValue>,
): RouteValue | undefined {
  return route.status === "fresh" || route.status === "stale"
    ? route.value
    : undefined;
}

function drawRoute(
  context: CanvasRenderingContext2D,
  route: RouteValue,
  center: Coordinate,
  viewport: MapLabelViewport,
  radiusMeters: number,
) {
  const points = route.geometry.map(
    (point) => projected(point, center, viewport, radiusMeters),
  );
  drawPath(context, points, COLOR.secondary, 6);
  drawPath(context, points, COLOR.primary, 3);
}

function drawPositionMarker(
  context: CanvasRenderingContext2D,
  viewport: MapLabelViewport,
  heading: number | undefined,
) {
  if (!Number.isFinite(heading)) {
    context.beginPath();
    context.arc(
      viewport.centerX,
      viewport.centerY,
      8,
      0,
      Math.PI * 2,
    );
    context.strokeStyle = COLOR.primary;
    context.lineWidth = 2;
    context.stroke();
    return;
  }
  const angle = heading! * Math.PI / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const points: readonly Point[] = [
    [0, -14],
    [7, 8],
    [0, 4],
    [-7, 8],
  ];
  fillPolygon(
    context,
    points.map(([x, y]) => [
      viewport.centerX + x * cosine - y * sine,
      viewport.centerY + x * sine + y * cosine,
    ]),
    COLOR.primary,
  );
}

function drawFooter(
  context: CanvasRenderingContext2D,
  map: DataState<MapValue>,
  route: DataState<RouteValue>,
  radiusMeters: number,
  mapStatus: "ready" | "NO GPS DATA" | "NO DATA",
  locale: PhoneLocale,
) {
  context.fillStyle = COLOR.background;
  context.fillRect(12, 250, 264, 25);
  context.fillStyle = COLOR.dim;
  context.fillRect(12, 249, 264, 1);
  const active = activeRoute(route);
  const status = mapStatus !== "ready"
    ? mapStatus
    : active
    ? `${translatePhone(locale, "navigation")} ${(active.remainingDistance / 1_000).toFixed(1)}km`
    : map.status === "fresh"
      ? "OSM LIVE"
      : map.status === "stale"
        ? "OSM LAST"
        : "NO DATA";
  drawText(context, fixedHud(locale, status), 18, 256, 10, COLOR.primary, "bold");
  drawText(
    context,
    `Z // ${radiusMeters}m`,
    94,
    257,
    8,
    COLOR.secondary,
    "bold",
  );
  if (map.value?.tileSource === "openmaptiles") {
    drawText(context, "© OPENMAPTILES · © OSM CONTRIBUTORS", 18, 268, 8, COLOR.secondary, "bold");
    return;
  }
  drawText(
    context,
    "© OSM CONTRIBUTORS",
    154,
    257,
    8,
    COLOR.secondary,
    "bold",
  );
}

type MapAreaState =
  | { readonly status: "NO GPS DATA" | "NO DATA" }
  | {
      readonly status: "ready";
      readonly center: Coordinate;
      readonly map: MapValue;
    };

function mapAreaState(live: LiveDashboardState): MapAreaState {
  const location = live.location.value;
  if (!location?.coordinate || location.source === "demo") {
    return { status: "NO GPS DATA" };
  }
  const map = live.map.status === "fresh" || live.map.status === "stale"
    ? live.map.value
    : undefined;
  if (!map || (map.roads.length === 0 && map.labels.length === 0)) {
    return { status: "NO DATA" };
  }
  return {
    status: "ready",
    center: location.coordinate,
    map,
  };
}

function drawMapStatus(
  context: CanvasRenderingContext2D,
  viewport: MapLabelViewport,
  status: "NO GPS DATA" | "NO DATA",
  locale: PhoneLocale,
) {
  context.fillStyle = COLOR.primary;
  context.font = 'bold 18px "SFMono-Regular", Consolas, monospace';
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(fixedHud(locale, status), viewport.centerX, viewport.centerY);
  const hint = status === "NO GPS DATA" ? getReleaseCopy(locale, "locationSetupHint") : translateHud(locale, "retryConnected");
  const lines = aiDetailLines(context, hint, 11, viewport.maxX - viewport.minX - 20, 3);
  context.font = '11px "SFMono-Regular", Consolas, monospace';
  lines.forEach((line, index) => context.fillText(line, viewport.centerX, viewport.centerY + 27 + index * 14));
}

function drawMapLayers(
  context: CanvasRenderingContext2D,
  live: LiveDashboardState,
  viewport: MapLabelViewport,
  radiusMeters: number,
  maximumLabels: number,
  locale: PhoneLocale,
): MapAreaState {
  const area = mapAreaState(live);
  if (area.status !== "ready") {
    drawMapStatus(context, viewport, area.status, locale);
    return area;
  }

  const { center, map } = area;
  drawRoads(context, map, center, viewport, radiusMeters);
  drawMapLabels(
    context,
    map,
    center,
    viewport,
    radiusMeters,
    maximumLabels,
    locale,
  );
  const route = activeRoute(live.route);
  if (route) {
    drawRoute(context, route, center, viewport, radiusMeters);
  }
  drawPositionMarker(context, viewport, live.location.value?.heading);
  return area;
}

export function drawFastMap(
  context: CanvasRenderingContext2D,
  live: LiveDashboardState,
  radiusMeters = 650,
  locale: PhoneLocale = "ko",
) {
  drawFrame(context);
  drawText(
    context,
    mapHeader(live.location, live.map, locale),
    18,
    16,
    11,
    COLOR.secondary,
    "bold",
  );
  const area = drawMapLayers(
    context,
    live,
    EMBEDDED_MAP_VIEWPORT,
    radiusMeters,
    10,
    locale,
  );
  drawFooter(context, live.map, live.route, radiusMeters, area.status, locale);
}

export function drawFastFullscreenMap(
  canvas: HTMLCanvasElement,
  live: LiveDashboardState,
  radiusMeters: number,
  locale: PhoneLocale = "ko",
) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D Canvas unavailable");
  canvas.width = 576;
  canvas.height = 288;
  context.imageSmoothingEnabled = false;
  context.fillStyle = COLOR.background;
  context.fillRect(0, 0, 576, 288);
  drawMapLayers(
    context,
    live,
    FULLSCREEN_MAP_VIEWPORT,
    radiusMeters,
    18,
    locale,
  );
  const { source, layer } = mapDescriptor(live.location, live.map, locale);
  drawFullscreenMapHeader(context, source, layer, radiusMeters, locale);
  drawFullscreenMapFooter(context, live.map.value?.tileSource, locale);
}
