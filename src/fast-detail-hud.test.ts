// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { drawFastDetailHud } from "./fast-detail-hud";
import { createAiHudSnapshot } from "./ai-hud-state";
import {
  createInitialLiveDashboardState,
  type LiveDashboardState,
} from "./live-state";

type DrawnText = {
  readonly value: string;
  readonly x: number;
  readonly y: number;
  readonly style: string;
  readonly font: string;
};

function createCanvas() {
  const texts: DrawnText[] = [];
  const rectangles: number[][] = [];
  const strokedPaths: Array<Array<[number, number]>> = [];
  let currentPath: Array<[number, number]> = [];
  const rawContext = {
    fillStyle: "",
    font: "",
    textAlign: "left",
    textBaseline: "top",
    imageSmoothingEnabled: true,
    fillRect: (...args: number[]) => rectangles.push(args),
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
      strokedPaths.push([...currentPath]);
    },
    fill: () => undefined,
    measureText: (value: string) => ({
      width: [...value].length * 10,
    }),
    fillText(value: string, x: number, y: number) {
      texts.push({
        value,
        x,
        y,
        style: rawContext.fillStyle,
        font: rawContext.font,
      });
    },
  };
  const context = rawContext as unknown as CanvasRenderingContext2D;
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
  } as unknown as HTMLCanvasElement;
  return { canvas, texts, rectangles, strokedPaths };
}

function liveState(): LiveDashboardState {
  const initial = createInitialLiveDashboardState();
  return {
    ...initial,
    weather: {
      status: "fresh",
      fetchedAt: Date.parse("2026-07-27T05:00:00Z"),
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
    news: {
      status: "fresh",
      fetchedAt: Date.parse("2026-07-27T05:00:00Z"),
      value: Array.from({ length: 6 }, (_, index) => ({
        id: `news-${index}`,
        title: index === 0 ? "첫 번째 실제 기사 제목" : `뉴스 ${index + 1}`,
        summary: index === 0
          ? "RSS 요약 내용이 안경 전체 화면에 선명하게 표시됩니다."
          : undefined,
        publishedAt: Date.parse("2026-07-27T05:00:00Z") - index * 60_000,
      })),
    },
    route: {
      status: "fresh",
      fetchedAt: Date.parse("2026-07-27T05:00:00Z"),
      value: {
        destinationName: "홍대입구역",
        geometry: [],
        maneuvers: [
          { instruction: "오른쪽 골목으로 우회전", distance: 120, wayPoints: [0, 1] },
          { instruction: "횡단보도를 건너 직진", distance: 80, wayPoints: [1, 2] },
        ],
        activeManeuverIndex: 1,
        remainingDistance: 820,
        profile: "foot-walking",
      },
    },
  };
}

function values(texts: readonly DrawnText[]) {
  return texts.map(({ value }) => value);
}

describe("drawFastDetailHud", () => {
  it("draws only the localized streaming Ask AI transcript", () => {
    const { canvas, texts } = createCanvas();
    const ai = {
      ...createAiHudSnapshot(true),
      phase: "thinking" as const,
      userText: "오늘 날씨는 어때?",
      assistantText: "현재 맑고 기온은 28도입니다.",
      transcriptLines: [
        "YOU // 오늘 날씨는 어때?",
        "AI // 현재 맑고 기온은 28도입니다.",
      ],
    };

    drawFastDetailHud(canvas, {
      mode: "ai",
      live: liveState(),
      newsIndex: 0,
      newsPage: 0,
      todoIndex: 0,
      navigationIndex: 0,
      ai,
      aiLine: 1,
    }, "ko");

    expect(values(texts)).toEqual(expect.arrayContaining([
      "사용자 // 오늘 날씨는 어때?",
      "AI // 현재 맑고 기온은 28도입니다.",
    ]));
    expect(values(texts)).not.toContain("AI에게 묻기 // 생각하는 중…");
    expect(values(texts)).not.toContain("스크롤 // 대화 기록");
    expect(values(texts)).not.toContain("두 번 탭 // 뒤로");
    const user = texts.find(({ value }) => value.startsWith("사용자 //"));
    const assistant = texts.find(({ value }) => value.startsWith("AI //"));
    expect(user?.x).toBe(8);
    expect(assistant?.x).toBe(8);
    expect((assistant?.y ?? 0) - (user?.y ?? 0)).toBe(58);
  });

  it("shows localized listening status below the live transcript", () => {
    const { canvas, texts } = createCanvas();
    const ai = {
      ...createAiHudSnapshot(true),
      phase: "listening" as const,
      transcriptLines: [
        "YOU // 이전 질문",
        "AI // 이전 답변",
        "YOU // 현재 질문",
        "AI // 현재 답변",
      ],
    };

    drawFastDetailHud(canvas, {
      mode: "ai",
      live: liveState(),
      newsIndex: 0,
      newsPage: 0,
      todoIndex: 0,
      navigationIndex: 0,
      ai,
      aiLine: 3,
    }, "ko");

    expect(values(texts)).toEqual(expect.arrayContaining([
      "사용자 // 이전 질문",
      "AI // 이전 답변",
      "듣는 중…",
    ]));
    const listening = texts.find(({ value }) => value === "듣는 중…");
    const user = texts.find(({ value }) => value === "사용자 // 이전 질문");
    expect(listening?.y).toBe(274);
    expect((listening?.y ?? 0) - (user?.y ?? 0)).toBeGreaterThanOrEqual(29);
    expect(values(texts).some((value) => value.includes("1/"))).toBe(false);
  });

  it("does not show a response-displaying phase header", () => {
    const { canvas, texts } = createCanvas();
    const ai = {
      ...createAiHudSnapshot(true),
      phase: "displaying" as const,
      transcriptLines: ["AI // 천천히 표시되는 답변"],
    };

    drawFastDetailHud(canvas, {
      mode: "ai",
      live: liveState(),
      newsIndex: 0,
      newsPage: 0,
      todoIndex: 0,
      navigationIndex: 0,
      ai,
      aiLine: 0,
    }, "ko");

    expect(values(texts)).toContain("AI // 천천히 표시되는 답변");
    expect(values(texts)).not.toContain("답변 표시 중…");
  });

  it("renders an X post as a readable HUD detail", () => {
    const { canvas, texts } = createCanvas();
    const live = liveState();
    drawFastDetailHud(canvas, {
      mode: "x",
      live: {
        ...live,
        x: {
          status: "fresh",
          value: [{
            id: "tweet-1",
            username: "evenrealities",
            author: "Even Realities",
            text: "The attached photo and tweet text stay together in the HUD detail.",
          }],
        },
      },
      newsIndex: 0,
      newsPage: 0,
      todoIndex: 0,
      navigationIndex: 0,
    }, "en");

    expect(values(texts)).toEqual(expect.arrayContaining([
      "X // HOME",
      "@evenrealities · Even Realities",
      "The attached photo and tweet text stay",
      "SCROLL // TWEETS",
    ]));
  });

  it("renders English fixed copy while preserving source content", () => {
    const weather = createCanvas();
    drawFastDetailHud(weather.canvas, {
      mode: "weather",
      live: liveState(),
      newsIndex: 0,
      newsPage: 0,
      todoIndex: 0,
      navigationIndex: 0,
    }, "en");
    expect(values(weather.texts)).toEqual(expect.arrayContaining([
      "Clear",
      "FEELS LIKE",
      "HUMIDITY",
      "PRECIPITATION",
      "WIND",
    ]));

    const todo = createCanvas();
    drawFastDetailHud(todo.canvas, {
      mode: "todo",
      live: liveState(),
      newsIndex: 0,
      newsPage: 0,
      todoIndex: 0,
      navigationIndex: 0,
    }, "en");
    expect(values(todo.texts)).toContain("DONE 1 / 3");
    expect(values(todo.texts)).toContain("> [ ] 지하철역으로 이동");

    const initial = createInitialLiveDashboardState();
    const news = createCanvas();
    drawFastDetailHud(news.canvas, {
      mode: "news",
      live: { ...initial, news: { status: "unavailable" } },
      newsIndex: 0,
      newsPage: 0,
      todoIndex: 0,
      navigationIndex: 0,
    }, "en");
    expect(values(news.texts)).toEqual(expect.arrayContaining([
      "News unavailable",
      "Will retry automatically when connected.",
    ]));
    expect(values(news.texts).some((value) => /[가-힣]/.test(value))).toBe(false);
  });

  it("draws a full-screen RSS article with summary and position", () => {
    const { canvas, texts, rectangles } = createCanvas();

    drawFastDetailHud(canvas, {
      mode: "news",
      live: liveState(),
      newsIndex: 0,
      newsPage: 0,
      todoIndex: 0,
      navigationIndex: 0,
    });

    expect(canvas.width).toBe(576);
    expect(canvas.height).toBe(288);
    expect(rectangles[0]).toEqual([0, 0, 576, 288]);
    expect(values(texts)).toEqual(expect.arrayContaining([
      "NEWS // LIVE",
      "01/06 · P1/1",
      "첫 번째 실제 기사 제목",
      "RSS 요약 내용이 안경 전체 화면에 선명하게 표시됩니다.",
      "DOUBLE TAP // BACK",
    ]));
    expect(texts.find(({ value }) => value.startsWith("RSS 요약"))).toMatchObject({
      x: 24,
      font: 'bold 21px "SFMono-Regular", Consolas, monospace',
    });
  });

  it("draws all TODOs, progress, selection, and controls", () => {
    const { canvas, texts, strokedPaths } = createCanvas();

    drawFastDetailHud(canvas, {
      mode: "todo",
      live: liveState(),
      newsIndex: 0,
      newsPage: 0,
      todoIndex: 1,
      navigationIndex: 0,
    });

    expect(values(texts)).toEqual(expect.arrayContaining([
      "TODO // ACTIVE",
      "완료 1 / 3",
      "[ ] 지하철역으로 이동",
      "> [ ] 우산 챙기기",
      "[X] 경로 확인",
      "TAP // TOGGLE",
      "DOUBLE TAP // BACK",
    ]));
  });

  it("draws one route step with current-step context", () => {
    const { canvas, texts } = createCanvas();

    drawFastDetailHud(canvas, {
      mode: "navigation",
      live: liveState(),
      newsIndex: 0,
      newsPage: 0,
      todoIndex: 0,
      navigationIndex: 0,
    });

    expect(values(texts)).toEqual(expect.arrayContaining([
      "NAV // ACTIVE",
      "STEP 01 / 02",
      "DEST // 홍대입구역",
      "오른쪽 골목으로 우회전",
      "STEP // 120m",
      "TAP // CURRENT",
      "DOUBLE TAP // BACK",
    ]));
  });

  it("draws a full-screen current weather dashboard", () => {
    const { canvas, texts, strokedPaths } = createCanvas();

    drawFastDetailHud(canvas, {
      mode: "weather",
      live: liveState(),
      newsIndex: 0,
      newsPage: 0,
      todoIndex: 0,
      navigationIndex: 0,
    });

    expect(values(texts)).toEqual(expect.arrayContaining([
      "WEATHER // LIVE",
      "28°C",
      "맑음",
      "체감온도",
      "30°",
      "습도",
      "63%",
      "강수확률",
      "20%",
      "바람",
      "8km/h",
      "DOUBLE TAP // BACK",
    ]));
    expect(values(texts)).not.toContain("경로 키 필요");
    expect(texts.find(({ value }) => value === "28°C")?.font)
      .toContain("48px");
    const iconPoints = strokedPaths.flat();
    expect(iconPoints.length).toBeGreaterThan(10);
    expect(
      Math.max(...iconPoints.map(([x]) => x))
        - Math.min(...iconPoints.map(([x]) => x)),
    ).toBeGreaterThanOrEqual(70);
    expect(
      Math.max(...iconPoints.map(([, y]) => y))
        - Math.min(...iconPoints.map(([, y]) => y)),
    ).toBeGreaterThanOrEqual(70);
  });

  it.each([
    ["stale", "WEATHER // LAST", "LAST DATA"],
    ["loading", "WEATHER // LOADING", "날씨 불러오는 중"],
    ["unavailable", "WEATHER // UNAVAILABLE", "날씨를 표시할 수 없음"],
  ] as const)("shows weather %s state without key guidance", (
    status,
    expected,
    copy,
  ) => {
    const base = liveState();
    const live: LiveDashboardState = {
      ...base,
      weather: status === "stale"
        ? { ...base.weather, status }
        : { status },
    };
    const { canvas, texts, strokedPaths } = createCanvas();

    drawFastDetailHud(canvas, {
      mode: "weather",
      live,
      newsIndex: 0,
      newsPage: 0,
      todoIndex: 0,
      navigationIndex: 0,
    });

    expect(values(texts)).toContain(expected);
    expect(values(texts)).toContain(copy);
    expect(values(texts)).not.toContain("ORS");
    expect(values(texts)).not.toContain("키 설정 필요");
    if (status !== "stale") {
      expect(strokedPaths).toHaveLength(0);
    }
  });

  it.each([
    ["news", "loading", "NEWS // LOADING"],
    ["news", "unavailable", "NEWS // UNAVAILABLE"],
    ["todo", "loading", "TODO // LOADING"],
    ["todo", "unavailable", "TODO // UNAVAILABLE"],
    ["navigation", "loading", "NAV // LOADING"],
    ["navigation", "disabled", "NAV // DISABLED"],
    ["navigation", "unavailable", "NAV // UNAVAILABLE"],
  ] as const)("shows %s %s state", (mode, status, expected) => {
    const live = {
      ...liveState(),
      [mode === "navigation" ? "route" : mode === "todo" ? "todos" : "news"]: {
        status,
      },
    } as LiveDashboardState;
    const { canvas, texts } = createCanvas();

    drawFastDetailHud(canvas, {
      mode,
      live,
      newsIndex: 0,
      newsPage: 0,
      todoIndex: 0,
      navigationIndex: 0,
    });

    expect(values(texts)).toContain(expected);
    expect(values(texts)).toContain("DOUBLE TAP // BACK");
  });

  it("renders every long summary page without changing the article title", () => {
    const base = liveState();
    const summary = [
      "A".repeat(50),
      "B".repeat(50),
      "C".repeat(50),
      "D".repeat(50),
      "E".repeat(50),
    ].join(" ");
    const live: LiveDashboardState = {
      ...base,
      news: {
        ...base.news,
        value: [{
          ...base.news.value![0],
          summary,
        }],
      },
    };
    const first = createCanvas();
    const second = createCanvas();

    drawFastDetailHud(first.canvas, {
      mode: "news",
      live,
      newsIndex: 0,
      newsPage: 0,
      todoIndex: 0,
      navigationIndex: 0,
    });
    drawFastDetailHud(second.canvas, {
      mode: "news",
      live,
      newsIndex: 0,
      newsPage: 1,
      todoIndex: 0,
      navigationIndex: 0,
    });

    expect(values(first.texts)).toContain("01/01 · P1/2");
    expect(values(first.texts)).toContain("A".repeat(50));
    expect(values(first.texts)).not.toContain("E".repeat(50));
    expect(values(second.texts)).toContain("01/01 · P2/2");
    expect(values(second.texts)).toContain("첫 번째 실제 기사 제목");
    expect(values(second.texts)).toContain("E".repeat(50));
    expect(values(second.texts)).not.toContain("A".repeat(50));
  });
});
