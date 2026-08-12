// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  createInitialLiveDashboardState,
  type LiveDashboardState,
} from "./live-state";
import { createAiHudSnapshot, type AiHudSnapshot } from "./ai-hud-state";
import type { PhoneLocale } from "./phone-types";

type FastHudPage =
  | "overview"
  | "navigation"
  | "news"
  | "x"
  | "todo"
  | "weather"
  | "ai";
type FastCanvasBattery = {
  label: "G1" | "G2" | "R1";
  level?: number;
  charging?: boolean;
};
type FastCanvasHudData = {
  readonly battery?: FastCanvasBattery;
  readonly live: LiveDashboardState;
  readonly mapRadiusMeters?: number;
  readonly dashboardMapEnabled?: boolean;
  readonly ai?: AiHudSnapshot;
};
type Rectangle = {
  style: string;
  args: [number, number, number, number];
};
type TextRecord = {
  style: string;
  font: string;
  value: string;
  x: number;
  y: number;
};
type PathRecord = {
  style: string;
  width: number;
  points: Array<[number, number]>;
};
type FastHudModule = {
  truncateHudTitle?: (title: string, maxUnits: number) => string;
  drawFastCanvasHud?: (
    canvas: HTMLCanvasElement,
    now?: Date,
    page?: FastHudPage,
    data?: FastCanvasHudData,
    locale?: PhoneLocale,
  ) => void;
};

async function loadFastHud() {
  const modulePath = "./fast-canvas-hud";
  const module = await import(
    /* @vite-ignore */ modulePath
  ).catch(() => null);
  expect(module).not.toBeNull();
  return module as FastHudModule | null;
}

function renderFastHud(
  module: FastHudModule,
  page: FastHudPage,
  data?: Partial<FastCanvasHudData>,
  locale: PhoneLocale = "ko",
) {
  const rectangles: Rectangle[] = [];
  const texts: TextRecord[] = [];
  const strokedPaths: PathRecord[] = [];
  const filledPaths: PathRecord[] = [];
  let fillStyle = "";
  let strokeStyle = "";
  let lineWidth = 1;
  let currentPath: Array<[number, number]> = [];
  const context = {
    imageSmoothingEnabled: true,
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
      rectangles.push({ style: fillStyle, args: [x, y, width, height] });
    },
    fillText: (value: string, x: number, y: number) => {
      texts.push({ style: fillStyle, font: context.font, value, x, y });
    },
    beginPath: () => {
      currentPath = [];
    },
    moveTo: (x: number, y: number) => {
      currentPath.push([x, y]);
    },
    lineTo: (x: number, y: number) => {
      currentPath.push([x, y]);
    },
    closePath: () => undefined,
    stroke: () => {
      strokedPaths.push({
        style: strokeStyle,
        width: lineWidth,
        points: [...currentPath],
      });
    },
    fill: () => {
      filledPaths.push({
        style: fillStyle,
        width: 0,
        points: [...currentPath],
      });
    },
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
  } as unknown as HTMLCanvasElement;

  module.drawFastCanvasHud!(
    canvas,
    new Date(2026, 6, 27, 14, 37, 42),
    page,
    {
      live: createInitialLiveDashboardState(),
      ...data,
    },
    locale,
  );
  return {
    canvas,
    rectangles,
    texts,
    values: texts.map(({ value }) => value),
    strokedPaths,
    filledPaths,
    paintedStyles: [
      ...rectangles.map(({ style }) => style),
      ...texts.map(({ style }) => style),
      ...strokedPaths.map(({ style }) => style),
      ...filledPaths.map(({ style }) => style),
    ],
  };
}

function leftSnapshot(hud: ReturnType<typeof renderFastHud>) {
  return {
    rectangles: hud.rectangles.filter(
      ({ args: [x, , width] }) => x + width <= 288,
    ),
    texts: hud.texts.filter(({ x }) => x < 288),
    strokedPaths: hud.strokedPaths.filter(({ points }) =>
      points.every(([x]) => x < 288)
    ),
    filledPaths: hud.filledPaths.filter(({ points }) =>
      points.every(([x]) => x < 288)
    ),
  };
}

describe("fast split Canvas HUD", () => {
  it("renders fixed overview and weather copy in English", async () => {
    const module = await loadFastHud();
    if (!module?.drawFastCanvasHud) return;
    const initial = createInitialLiveDashboardState();
    const live: LiveDashboardState = {
      ...initial,
      weather: {
        status: "fresh",
        value: {
          temperature: 29,
          apparentTemperature: 31,
          humidity: 67,
          windSpeed: 8,
          precipitationProbability: 20,
          weatherCode: 2,
          condition: "대체로 맑음",
        },
      },
    };

    const overview = renderFastHud(module, "overview", { live }, "en");
    expect(overview.values).toEqual(expect.arrayContaining([
      "2026.07.27 Monday",
      "29°C Mostly clear",
      "FEELS 31°  HUMIDITY 67%",
      "RAIN 20%  WIND 8km/h",
    ]));
    expect(overview.values.some((value) => /[가-힣]/.test(value))).toBe(false);

    const weather = renderFastHud(module, "weather", { live }, "en");
    expect(weather.values).toEqual(expect.arrayContaining([
      "Mostly clear",
      "FEELS 31°",
      "HUMIDITY 67%",
      "RAIN 20%",
      "WIND 8km/h",
    ]));
    expect(weather.values.some((value) => /[가-힣]/.test(value))).toBe(false);
  });

  it("keeps a static left map and draws high-contrast right pages", async () => {
    const module = await loadFastHud();
    if (!module) return;
    expect(module.drawFastCanvasHud).toBeTypeOf("function");
    if (!module.drawFastCanvasHud) return;

    const pageNames: FastHudPage[] = [
      "overview",
      "news",
      "x",
      "todo",
      "weather",
    ];
    const pages = pageNames.map((page) => renderFastHud(module, page));

    for (const [index, hud] of pages.entries()) {
      expect(hud.canvas.width).toBe(576);
      expect(hud.canvas.height).toBe(288);
      expect(hud.values).toEqual(expect.arrayContaining([
        "14:37",
        "2026.07.27 월요일",
        "WEATHER --",
        `0${index + 1} / 07`,
        "LOC // NO GPS · NO DATA",
        "NO GPS DATA",
        "© OSM CONTRIBUTORS",
      ]));
      expect(hud.texts.find(
        ({ value }) => value === "2026.07.27 월요일",
      )).toMatchObject({ x: 306, y: 40 });
      expect(hud.values).not.toContain("14:37:42");
      expect(hud.texts.some(({ font }) => /(?:2[0-8])px/.test(font))).toBe(true);
    }
    expect(new Set(pages[0].paintedStyles)).toEqual(new Set([
      "#000000",
      "#ffffff",
      "#d0d0d0",
      "#808080",
    ]));
    expect(pages.map(leftSnapshot)).toEqual([
      leftSnapshot(pages[0]),
      leftSnapshot(pages[0]),
      leftSnapshot(pages[0]),
      leftSnapshot(pages[0]),
      leftSnapshot(pages[0]),
    ]);
    expect(pages[4].values).toContain("WEATHER // LOADING");
    expect(pages[4].values).not.toContain("경로 키 필요");
    expect(pages[4].values).not.toContain("ORS 연결 후 사용");
    expect(pages[1].values).toContain("NEWS LOADING");
    expect(pages[1].values.filter((value) => value.startsWith("· "))).toHaveLength(
      0,
    );
    expect(pages[1].values).not.toContain("2호선 정상 운행");
    expect(pages[3].values).toEqual(expect.arrayContaining([
      "TODO // ACTIVE",
      "지하철역으로 이동",
      "우산 챙기기",
      "경로 확인",
      "완료 1 / 3",
    ]));
    expect(pages[3].values).not.toContain("CONNECTED");
    expect(pages[3].values).not.toContain("LINK // G2 + R1");
  });

  it("leaves the dashboard's left half blank when the map is disabled", async () => {
    const module = await loadFastHud();
    if (!module?.drawFastCanvasHud) return;
    const hud = renderFastHud(module, "weather", { dashboardMapEnabled: false });

    expect(hud.values).not.toContain("LOC // NO GPS · NO DATA");
    expect(hud.values).not.toContain("NO GPS DATA");
    expect(hud.values).not.toContain("© OSM CONTRIBUTORS");
  });

  it("focuses the fifth keyless page on current weather", async () => {
    const module = await loadFastHud();
    if (!module?.drawFastCanvasHud) return;
    const initial = createInitialLiveDashboardState();
    const live: LiveDashboardState = {
      ...initial,
      weather: {
        status: "fresh",
        fetchedAt: 1_800_000_000_000,
        value: {
          temperature: 28.4,
          apparentTemperature: 29.6,
          humidity: 63,
          windSpeed: 8.2,
          precipitationProbability: 20,
          weatherCode: 0,
          condition: "맑음",
        },
      },
    };
    const weather = renderFastHud(module, "weather", { live });

    expect(weather.values).toEqual(expect.arrayContaining([
      "WEATHER // NOW",
      "28°C",
      "맑음",
      "체감 30°",
      "습도 63%",
      "강수 20%",
      "바람 8km/h",
      "05 / 07",
    ]));
    expect(weather.values).not.toContain("BATTERY --");
    expect(weather.values).not.toContain("경로 키 필요");
    expect(weather.values).not.toContain("ORS 연결 후 사용");
    expect(weather.texts.find(({ value }) => value === "28°C"))
      .toMatchObject({ x: 400, y: 116 });
    expect(weather.texts.find(({ value }) => value === "맑음"))
      .toMatchObject({ x: 400, y: 154 });
    const iconPoints = weather.strokedPaths
      .filter(({ points }) => points.every(([x]) => x >= 296))
      .flatMap(({ points }) => points);
    expect(iconPoints.length).toBeGreaterThan(10);
    expect(
      Math.max(...iconPoints.map(([x]) => x))
        - Math.min(...iconPoints.map(([x]) => x)),
    ).toBeGreaterThanOrEqual(50);
    expect(
      Math.max(...iconPoints.map(([, y]) => y))
        - Math.min(...iconPoints.map(([, y]) => y)),
    ).toBeGreaterThanOrEqual(50);

    const loading = renderFastHud(module, "weather");
    expect(loading.strokedPaths.filter(({ points }) =>
      points.some(([x]) => x >= 296)
    )).toHaveLength(0);
  });

  it("renders Ask AI sixth with recent context and local cost", async () => {
    const module = await loadFastHud();
    if (!module?.drawFastCanvasHud) return;
    const ai = {
      ...createAiHudSnapshot(true, [{
        id: "recent",
        endedAt: "2026-08-01T12:00:00.000Z",
        user: "오늘 일정을 알려줘",
        assistant: "오후 세 시에 검토 일정이 있습니다.",
      }], 0.0012, 0.0084),
    };
    const hud = renderFastHud(module, "ai", { ai });

    expect(hud.values).toEqual(expect.arrayContaining([
      "06 / 07",
      "AI에게 묻기 // 준비됨",
      "대화 기록 // 사용자",
      "오늘 일정을 알려줘",
      "대화 기록 // AI",
      "오후 세 시에 검토 일정이…",
      "이번 주 $0.0012",
      "이번 달 $0.0084",
    ]));
  });

  it("adds Navigation eighth only when routing is enabled", async () => {
    const module = await loadFastHud();
    if (!module?.drawFastCanvasHud) return;
    const initial = createInitialLiveDashboardState();
    const live: LiveDashboardState = {
      ...initial,
      route: { status: "fresh" },
    };
    const navigation = renderFastHud(module, "navigation", { live });

    expect(navigation.values).toEqual(expect.arrayContaining([
      "08 / 08",
      "NAV // READY",
      "목적지를 선택하세요",
    ]));
    expect(navigation.values).not.toContain("경로 키 필요");
  });

  it("normalizes disabled Navigation rendering to Weather", async () => {
    const module = await loadFastHud();
    if (!module?.drawFastCanvasHud) return;
    const navigation = renderFastHud(module, "navigation");

    expect(navigation.values).toEqual(expect.arrayContaining([
      "05 / 07",
      "WEATHER // LOADING",
    ]));
    expect(navigation.values).not.toContain("NAV // DISABLED");
    expect(navigation.values).not.toContain("키 설정 필요");
  });

  it("renders one SDK battery snapshot with a safe fallback", async () => {
    const module = await loadFastHud();
    if (!module?.drawFastCanvasHud) return;

    expect(renderFastHud(module, "overview", {
      battery: {
        label: "G2",
        level: 82,
        charging: true,
      },
    }).values).toContain("G2 82% +");
    expect(renderFastHud(module, "overview").values).toContain("BATTERY --");
  });

  it("threads the retained map zoom into the embedded map", async () => {
    const module = await loadFastHud();
    if (!module?.drawFastCanvasHud) return;

    expect(renderFastHud(module, "overview", {
      mapRadiusMeters: 500,
    }).values).toContain("Z // 500m");
    expect(renderFastHud(module, "overview").values).toContain("Z // 650m");
  });

  it("labels map provenance from the current location source", async () => {
    const module = await loadFastHud();
    if (!module?.drawFastCanvasHud) return;
    const initial = createInitialLiveDashboardState();
    const withSource = (
      source: "live" | "cache" | "demo",
    ): LiveDashboardState => ({
      ...initial,
      location: {
        status: source === "live" ? "fresh" : "stale",
        value: {
          coordinate: { latitude: 37.5665, longitude: 126.978 },
          source,
        },
      },
    });

    expect(renderFastHud(module, "overview", {
      live: withSource("live"),
    }).values).toContain("LOC // LIVE · NO DATA");
    expect(renderFastHud(module, "overview", {
      live: withSource("cache"),
    }).values).toContain("LOC // LAST FIX · NO DATA");
    expect(renderFastHud(module, "overview", {
      live: withSource("demo"),
    }).values).toContain("LOC // NO GPS · NO DATA");
    expect(renderFastHud(module, "overview", {
      live: withSource("demo"),
    }).values).toContain("NO GPS DATA");
  });

  it("shows rounded live weather details and an unavailable fallback", async () => {
    const module = await loadFastHud();
    if (!module?.drawFastCanvasHud) return;
    const initial = createInitialLiveDashboardState();
    const live: LiveDashboardState = {
      ...initial,
      weather: {
        status: "fresh",
        fetchedAt: 1_800_000_000_000,
        value: {
          temperature: 29.4,
          apparentTemperature: 31.2,
          humidity: 67,
          windSpeed: 8.2,
          precipitationProbability: 20,
          weatherCode: 2,
          condition: "대체로 맑음",
        },
      },
    };
    const weather = renderFastHud(module, "overview", { live });

    expect(weather.values).toEqual(expect.arrayContaining([
      "29°C 대체로 맑음",
      "체감 31°  습도 67%",
      "강수 20%  바람 8km/h",
    ]));
    const details = weather.texts.filter(({ value }) =>
      value.startsWith("체감 ") || value.startsWith("강수 ")
    );
    expect(details).toHaveLength(2);
    expect(details.every(({ font }) => /\b14px\b/.test(font))).toBe(true);
    const headerWeather = weather.texts.find(
      ({ value, y }) => value === "29°C 대체로 맑음" && y === 40,
    );
    expect(headerWeather).toMatchObject({ x: 468, y: 40 });
    expect(headerWeather?.font).toMatch(/\b10px\b/);
    const estimatedHeaderWidth = [...headerWeather!.value].reduce(
      (width, character) =>
        width + (/^[\x00-\x7F]$/.test(character) ? 6 : 10),
      0,
    );
    expect(headerWeather!.x + estimatedHeaderWidth).toBeLessThanOrEqual(576);
    expect(renderFastHud(module, "overview", {
      live: {
        ...initial,
        weather: { status: "unavailable" },
      },
    }).values).toContain("WEATHER --");
  });

  it("renders six live headlines and labels stale or unavailable states", async () => {
    const module = await loadFastHud();
    if (!module?.drawFastCanvasHud) return;
    const initial = createInitialLiveDashboardState();
    const items = [
      "첫 번째 최신 기사",
      "두 번째 최신 기사",
      "세 번째 최신 기사",
      "네 번째 최신 기사",
      "다섯 번째 최신 기사",
      "여섯 번째 최신 기사",
    ].map((title, index) => ({
      id: `guid:${index}`,
      title,
    }));
    const live: LiveDashboardState = {
      ...initial,
      news: { status: "fresh", value: items, fetchedAt: 1 },
    };
    const news = renderFastHud(module, "news", { live });

    expect(news.values.filter((value) => value.startsWith("· "))).toEqual([
      "· 첫 번째 최신 기사",
      "· 두 번째 최신 기사",
      "· 세 번째 최신 기사",
      "· 네 번째 최신 기사",
      "· 다섯 번째 최신 기사",
      "· 여섯 번째 최신 기사",
    ]);
    expect(news.values).not.toContain("· AI 산업 투자 확대");
    expect(news.texts.filter(({ value }) => value.startsWith("· ")).map(
      ({ x, y, font }) => ({ x, y, font }),
    )).toEqual([
      { x: 308, y: 104, font: expect.stringContaining("14px") },
      { x: 308, y: 128, font: expect.stringContaining("14px") },
      { x: 308, y: 152, font: expect.stringContaining("14px") },
      { x: 308, y: 176, font: expect.stringContaining("14px") },
      { x: 308, y: 237, font: expect.stringContaining("13px") },
      { x: 308, y: 257, font: expect.stringContaining("13px") },
    ]);

    expect(renderFastHud(module, "news", {
      live: { ...live, news: { ...live.news, status: "stale" } },
    }).values).toContain("NEWS // FOCUS · STALE");
    expect(renderFastHud(module, "news", {
      live: { ...live, news: { status: "unavailable" } },
    }).values).toContain("NEWS UNAVAILABLE");
  });

  it("renders X posts as a separate dashboard page", async () => {
    const module = await loadFastHud();
    if (!module?.drawFastCanvasHud) return;
    const initial = createInitialLiveDashboardState();
    const x = renderFastHud(module, "x", {
      live: {
        ...initial,
        x: {
          status: "fresh",
          value: [{
            id: "tweet-1",
            username: "evenrealities",
            author: "Even Realities",
            text: "A fresh post is now available on the HUD.",
          }],
        },
      },
    });

    expect(x.values).toEqual(expect.arrayContaining([
      "X // HOME",
      "Even Realities · @evenrealities",
    ]));
    expect(x.values.some((value) => value.startsWith("A fresh post is now"))).toBe(true);
  });

  it("renders the restored TODO state on its dashboard page", async () => {
    const module = await loadFastHud();
    if (!module?.drawFastCanvasHud) return;
    const initial = createInitialLiveDashboardState();
    const live: LiveDashboardState = {
      ...initial,
      todos: {
        status: "fresh",
        value: [
          { id: "coffee", title: "커피 사기", completed: true },
          { id: "train", title: "열차 타기", completed: false },
          { id: "route", title: "경로 확인", completed: true },
        ],
      },
    };

    const todo = renderFastHud(module, "todo", { live });

    expect(todo.values).toEqual(expect.arrayContaining([
      "커피 사기",
      "열차 타기",
      "경로 확인",
      "완료 2 / 3",
    ]));
    expect(todo.values).not.toContain("지하철역으로 이동");
  });

  it("truncates mixed-width titles without exceeding HUD units", async () => {
    const module = await loadFastHud();
    expect(module?.truncateHudTitle).toBeTypeOf("function");
    expect(module?.truncateHudTitle?.("short title", 25)).toBe("short title");
    expect(module?.truncateHudTitle?.(
      "아주 긴 한국어 기사 제목입니다 ABCDEFG",
      25,
    )).toBe("아주 긴 한국어 기사 제…");
  });

  it("hides disabled routing and renders enabled route states", async () => {
    const module = await loadFastHud();
    if (!module?.drawFastCanvasHud) return;
    const initial = createInitialLiveDashboardState();
    const route = {
      destinationName: "서울역",
      geometry: [
        { latitude: 37.5563, longitude: 126.922 },
        { latitude: 37.5547, longitude: 126.9707 },
      ],
      maneuvers: [{
        instruction: "오른쪽으로 도세요",
        distance: 120,
        wayPoints: [0, 1] as const,
      }],
      activeManeuverIndex: 0,
      remainingDistance: 120,
      profile: "foot-walking" as const,
    };
    const values = (routeState: LiveDashboardState["route"]) =>
      renderFastHud(module, "navigation", {
        live: { ...initial, route: routeState },
      }).values;

    expect(values({ status: "disabled" })).toEqual(
      expect.arrayContaining([
        "WEATHER // LOADING",
        "날씨 불러오는 중",
      ]),
    );
    expect(values({ status: "disabled" })).not.toContain("경로 키 필요");
    expect(values({ status: "fresh" })).toEqual(
      expect.arrayContaining([
        "NAV // READY",
        "목적지를 선택하세요",
      ]),
    );
    expect(values({ status: "loading" })).toEqual(
      expect.arrayContaining([
        "NAV // ROUTING",
        "경로 계산 중",
      ]),
    );
    expect(values({ status: "fresh", value: route, fetchedAt: 1 })).toEqual(
      expect.arrayContaining([
        "NAV // ACTIVE",
        "120m",
        "오른쪽으로 도세요",
        "DEST // 서울역",
      ]),
    );
    expect(values({ status: "stale", value: route, fetchedAt: 1 })).toEqual(
      expect.arrayContaining([
        "NAV // STALE",
        "경로 확인 필요",
        "DEST // 서울역",
      ]),
    );
  });
});
