// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fixedHud } from "./fixed-hud-i18n";
import { drawFastFullscreenMap, drawFastMap } from "./fast-map";
import {
  createInitialLiveDashboardState,
  type LiveDashboardState,
} from "./live-state";

type Stroke = {
  readonly style: string;
  readonly width: number;
  readonly points: readonly [number, number][];
  readonly order: number;
};
type Text = {
  readonly value: string;
  readonly style: string;
  readonly font: string;
  readonly x: number;
  readonly y: number;
  readonly order: number;
};
type Rectangle = {
  readonly style: string;
  readonly args: readonly [number, number, number, number];
  readonly order: number;
};
type Arc = {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly startAngle: number;
  readonly endAngle: number;
};

function liveState(): LiveDashboardState {
  const initial = createInitialLiveDashboardState();
  return {
    ...initial,
    location: {
      status: "fresh",
      value: {
        coordinate: { latitude: 37.5563, longitude: 126.922 },
        source: "live",
        heading: 47,
      },
    },
    map: {
      status: "fresh",
      fetchedAt: 1,
      value: {
        cell: "37.555,126.920",
        attribution: "© OSM CONTRIBUTORS",
        roads: [
          {
            kind: "major",
            points: [
              { latitude: 37.54, longitude: 126.9 },
              { latitude: 37.58, longitude: 126.95 },
            ],
          },
          {
            kind: "minor",
            points: [
              { latitude: 37.555, longitude: 126.921 },
              { latitude: 37.557, longitude: 126.923 },
            ],
          },
        ],
        labels: [
          {
            kind: "transit",
            name: "홍대입구역",
            localizedNames: {
              ko: "홍대입구역",
              en: "Hongik University",
            },
            point: { latitude: 37.5603, longitude: 126.918 },
          },
          {
            kind: "road",
            name: "양화로",
            point: { latitude: 37.5593, longitude: 126.926 },
          },
          {
            kind: "landmark",
            name: "경의선숲길",
            point: { latitude: 37.5533, longitude: 126.918 },
          },
          {
            kind: "place",
            name: "화살표와 겹침",
            point: { latitude: 37.5563, longitude: 126.922 },
          },
        ],
      },
    },
    route: {
      status: "fresh",
      fetchedAt: 1,
      value: {
        destinationName: "홍대입구역",
        geometry: [
          { latitude: 37.5563, longitude: 126.922 },
          { latitude: 37.557, longitude: 126.923 },
        ],
        maneuvers: [],
        activeManeuverIndex: 0,
        remainingDistance: 800,
        profile: "foot-walking",
      },
    },
  };
}

function draw(
  live: LiveDashboardState,
  radiusMeters = 650,
  fullscreen = false,
  locale: "ko" | "en" = "ko",
) {
  const strokes: Stroke[] = [];
  const fills: Array<{
    style: string;
    points: readonly [number, number][];
    order: number;
  }> = [];
  const texts: Text[] = [];
  const rectangles: Rectangle[] = [];
  const arcs: Arc[] = [];
  let fillStyle = "";
  let strokeStyle = "";
  let lineWidth = 1;
  let order = 0;
  let points: [number, number][] = [];
  const context = {
    font: "",
    textAlign: "start",
    textBaseline: "alphabetic",
    lineCap: "butt",
    lineJoin: "miter",
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(value: string | CanvasGradient | CanvasPattern) {
      fillStyle = String(value);
    },
    get strokeStyle() {
      return strokeStyle;
    },
    set strokeStyle(value: string | CanvasGradient | CanvasPattern) {
      strokeStyle = String(value);
    },
    get lineWidth() {
      return lineWidth;
    },
    set lineWidth(value: number) {
      lineWidth = value;
    },
    fillRect: (x: number, y: number, width: number, height: number) => {
      rectangles.push({
        style: fillStyle,
        args: [x, y, width, height],
        order: order++,
      });
    },
    measureText: (value: string) => ({ width: [...value].length * 8 }),
    fillText: (value: string, x: number, y: number) => {
      texts.push({
        value,
        style: fillStyle,
        font: context.font,
        x,
        y,
        order: order++,
      });
    },
    beginPath: () => {
      points = [];
    },
    moveTo: (x: number, y: number) => {
      points.push([x, y]);
    },
    lineTo: (x: number, y: number) => {
      points.push([x, y]);
    },
    arc: (
      x: number,
      y: number,
      radius: number,
      startAngle: number,
      endAngle: number,
    ) => {
      arcs.push({ x, y, radius, startAngle, endAngle });
    },
    closePath: () => undefined,
    stroke: () => {
      strokes.push({
        style: strokeStyle,
        width: lineWidth,
        points: [...points],
        order: order++,
      });
    },
    fill: () => {
      fills.push({ style: fillStyle, points: [...points], order: order++ });
    },
  } as unknown as CanvasRenderingContext2D;

  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
  } as unknown as HTMLCanvasElement;
  if (fullscreen) {
    drawFastFullscreenMap(canvas, live, radiusMeters, locale);
  } else {
    drawFastMap(context, live, radiusMeters, locale);
  }
  return { arcs, canvas, strokes, fills, texts, rectangles };
}

describe("fast OSM map Canvas layer", () => {
  it("selects OSM labels using the active locale", () => {
    const korean = draw(liveState(), 650, false, "ko");
    const english = draw(liveState(), 650, false, "en");

    expect(korean.texts.map(({ value }) => value))
      .toContain("홍대입구역");
    expect(english.texts.some(({ value }) =>
      value.startsWith("Hongik")
    )).toBe(true);
    expect(english.texts.map(({ value }) => value))
      .not.toContain("홍대입구역");
  });

  it("draws minor, major, route, and position layers in tactical order", () => {
    const result = draw(liveState());
    const minor = result.strokes.find(
      ({ style, width }) => style === "#808080" && width === 1,
    );
    const major = result.strokes.find(
      ({ style, width }) => style === "#d0d0d0" && width === 2,
    );
    const route = result.strokes.filter(
      ({ width }) => width === 6 || width === 3,
    );
    const labels = result.texts.filter(({ value }) => [
      "홍대입구역",
      "양화로",
      "경의선숲길",
    ].includes(value));

    expect(minor).toBeTruthy();
    expect(major).toBeTruthy();
    expect(route).toHaveLength(2);
    expect(labels.map(({ value }) => value)).toEqual([
      "홍대입구역",
      "양화로",
      "경의선숲길",
    ]);
    expect(minor!.order).toBeLessThan(major!.order);
    expect(major!.order).toBeLessThan(labels[0].order);
    expect(labels.at(-1)!.order).toBeLessThan(route[0].order);
    expect(route[1].order).toBeLessThan(result.fills.at(-1)!.order);
    expect(labels.map(({ style, font }) => ({ style, font }))).toEqual([
      { style: "#ffffff", font: expect.stringContaining("bold 14px") },
      { style: "#d0d0d0", font: expect.stringContaining("bold 12px") },
      { style: "#d0d0d0", font: expect.stringContaining("bold 12px") },
    ]);
    for (const label of labels) {
      expect(result.rectangles).toContainEqual(expect.objectContaining({
        style: "#000000",
        order: label.order - 1,
      }));
    }
    expect(result.texts.some(
      ({ value }) => value === "화살표와 겹침",
    )).toBe(false);
  });

  it("clamps all projected road and route points to the map viewport", () => {
    const result = draw(liveState());
    const geometry = result.strokes.filter(
      ({ width }) => [1, 2, 3, 6].includes(width),
    );

    for (const { points } of geometry) {
      for (const [x, y] of points) {
        expect(x).toBeGreaterThanOrEqual(18);
        expect(x).toBeLessThanOrEqual(270);
        expect(y).toBeGreaterThanOrEqual(34);
        expect(y).toBeLessThanOrEqual(244);
      }
    }
  });

  it("shows honest empty states without schematic geometry or markers", () => {
    expect(draw(liveState()).texts.map(({ value }) => value)).toEqual(
      expect.arrayContaining([
      "위치 // 실시간 · OSM",
      "© OSM CONTRIBUTORS",
      ]),
    );

    const initial = createInitialLiveDashboardState();
    const noGps = draw(initial);
    expect(noGps.texts.map(({ value }) => value)).toContain(fixedHud("ko", "NO GPS DATA"));
    expect(noGps.strokes).toEqual([]);
    expect(noGps.fills).toEqual([]);

    const base = liveState();
    const noMap = draw({
      ...base,
      map: { status: "unavailable" },
    });
    expect(noMap.texts.map(({ value }) => value)).toContain(fixedHud("ko", "NO DATA"));
    expect(noMap.strokes).toEqual([]);
    expect(noMap.fills).toEqual([]);

    const emptyMap = draw({
      ...base,
      map: {
        status: "fresh",
        value: {
          cell: "37.555,126.920",
          attribution: "© OSM CONTRIBUTORS",
          roads: [],
          labels: [],
        },
      },
    });
    expect(emptyMap.texts.map(({ value }) => value)).toContain(fixedHud("ko", "NO DATA"));
    expect(emptyMap.strokes).toEqual([]);
    expect(emptyMap.fills).toEqual([]);
  });

  it("draws a hollow circle only when map data exists without heading", () => {
    const base = liveState();
    const withoutHeading = draw({
      ...base,
      location: {
        ...base.location,
        value: {
          coordinate: base.location.value!.coordinate,
          source: "live",
        },
      },
      route: { status: "disabled" },
    });

    expect(withoutHeading.arcs).toEqual([{
      x: 144,
      y: 144,
      radius: 8,
      startAngle: 0,
      endAngle: Math.PI * 2,
    }]);
    expect(withoutHeading.fills).toEqual([]);
    expect(withoutHeading.strokes.at(-1)).toMatchObject({
      style: "#ffffff",
      width: 2,
    });
  });

  it("draws live geometry, zoom, and guidance across the full display", () => {
    const base = liveState();
    const live: LiveDashboardState = {
      ...base,
      location: {
        ...base.location,
        value: {
          ...base.location.value!,
          heading: 0,
        },
      },
    };
    const full = draw(live, 500, true);

    expect(full.canvas.width).toBe(576);
    expect(full.canvas.height).toBe(288);
    expect(full.texts.map(({ value }) => value)).toEqual(
      expect.arrayContaining([
        "위치 // 실시간 · OSM",
        "Z // 500m",
        "© OSM CONTRIBUTORS",
        "두 번 탭 // 뒤로",
      ]),
    );
    expect(full.strokes.some(({ points }) =>
      points.some(([x]) => x > 288)
    )).toBe(true);
    expect(full.fills.at(-1)?.points).toEqual([
      [288, 130],
      [295, 152],
      [288, 148],
      [281, 152],
    ]);
    expect(full.arcs).toEqual([]);
    expect(full.texts.filter(({ value }) => [
      "홍대입구역",
      "양화로",
      "경의선숲길",
    ].includes(value)).map(({ font }) => font)).toEqual([
      expect.stringContaining("bold 14px"),
      expect.stringContaining("bold 12px"),
      expect.stringContaining("bold 12px"),
    ]);
  });
});
