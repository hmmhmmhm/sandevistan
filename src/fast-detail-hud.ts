import {
  drawFastCanvasOpenFrame as drawFrame,
  drawFastCanvasText as drawText,
  FAST_CANVAS_COLOR as COLOR,
} from "./fast-canvas-style";
import { wrapHudText } from "./fast-detail-text";
import {
  drawDetailEmptyState as drawEmptyState,
  drawDetailFooter as drawFooter,
  drawDetailHeader as drawHeader,
  formatDetailDistance as formatDistance,
  formatDetailPosition as formatPosition,
  formatDetailPublished as formatPublished,
} from "./fast-detail-frame";
import { paginateFastNewsSummary } from "./fast-news-pages";
import { drawFastWeatherIcon } from "./fast-weather-icon";
import { translateHud } from "./hud-i18n";
import type { PhoneLocale } from "./phone-types";
import { weatherCodeLabel } from "./weather";
import type {
  DataState,
  LiveDashboardState,
  NewsItem,
  RouteValue,
  TodoItem,
  XHudPost,
} from "./live-state";
import type { AiHudSnapshot } from "./ai-hud-state";
import { createAiHudSnapshot } from "./ai-hud-state";
import { drawFastAiDetail } from "./fast-ai-hud";
import { drawFastConversateDetail } from "./fast-conversate-hud";
import type { ConversateSnapshot } from "./conversate-state";

const WIDTH = 576;
const HEIGHT = 288;

export type FastDetailHudOptions = {
  readonly mode: "news" | "x" | "todo" | "weather" | "navigation" | "ai" | "conversate";
  readonly live: LiveDashboardState;
  readonly newsIndex: number;
  readonly newsPage: number;
  readonly todoIndex: number;
  readonly navigationIndex: number;
  readonly ai?: AiHudSnapshot;
  readonly aiLine?: number;
  readonly conversate?: ConversateSnapshot;
};

function newsLabel(state: DataState<readonly NewsItem[]>): string {
  if (state.status === "fresh") return "NEWS // LIVE";
  if (state.status === "stale") return "NEWS // STALE";
  if (state.status === "loading") return "NEWS // LOADING";
  return "NEWS // UNAVAILABLE";
}

function compactPosition(index: number, count: number): string {
  const width = Math.max(2, String(Math.max(0, count)).length);
  const current = count > 0 ? Math.min(index, count - 1) + 1 : 0;
  return `${String(current).padStart(width, "0")}/${
    String(count).padStart(width, "0")
  }`;
}

function drawNews(
  context: CanvasRenderingContext2D,
  state: DataState<readonly NewsItem[]>,
  selectedIndex: number,
  selectedPage: number,
  locale: PhoneLocale,
) {
  const items = state.value ?? [];
  const index = Math.min(Math.max(0, selectedIndex), Math.max(0, items.length - 1));
  const item = (state.status === "fresh" || state.status === "stale")
    ? items[index]
    : undefined;
  const pages = item
    ? paginateFastNewsSummary(context, item.summary, locale)
    : [[translateHud(locale, "noSummary")]];
  const page = Math.min(
    Math.max(0, selectedPage),
    Math.max(0, pages.length - 1),
  );
  drawHeader(
    context,
    newsLabel(state),
    item
      ? `${compactPosition(index, items.length)} · P${page + 1}/${pages.length}`
      : formatPosition(index, items.length),
  );
  drawFrame(context, 14, 44, 548, 204);
  if (!item) {
    const loading = state.status === "loading";
    drawEmptyState(
      context,
      translateHud(locale, loading ? "newsLoading" : "newsUnavailable"),
      translateHud(locale, loading ? "newsWaiting" : "retryConnected"),
    );
    drawFooter(context, "SCROLL // TEXT / ARTICLES");
    return;
  }

  const titleLines = wrapHudText(item.title, 36, 2);
  titleLines.forEach((line, lineIndex) => {
    drawText(
      context,
      line,
      32,
      54 + lineIndex * 31,
      25,
      COLOR.primary,
      "bold",
    );
  });
  const summaryLines = pages[page];
  summaryLines.forEach((line, lineIndex) => {
    drawText(
      context,
      line,
      24,
      118 + lineIndex * 25,
      21,
      lineIndex === 0 ? COLOR.secondary : COLOR.primary,
      "bold",
    );
  });
  drawText(
    context,
    formatPublished(item.publishedAt, locale),
    34,
    230,
    10,
    COLOR.dim,
    "bold",
  );
  drawFooter(context, "SCROLL // TEXT / ARTICLES");
}

const xImages = new Map<string, HTMLImageElement>();

function drawX(context: CanvasRenderingContext2D, state: DataState<readonly XHudPost[]>, index: number, locale: PhoneLocale) {
  const posts = state.value ?? [];
  const post = state.status === "fresh" || state.status === "stale" ? posts[Math.min(index, posts.length - 1)] : undefined;
  drawHeader(context, state.status === "fresh" ? "X // HOME" : "X // UNAVAILABLE", post ? compactPosition(index, posts.length) : "00/00");
  drawFrame(context, 14, 44, 548, 204);
  if (!post) { drawEmptyState(context, "X timeline unavailable", "Check your X token and plan."); return; }
  const authorY = post.repostedFrom ? 84 : 62;
  if (post.repostedFrom) drawText(context, `↻ @${post.repostedFrom.username} reposted`, 30, 62, 11, COLOR.dim, "bold");
  context.fillStyle = COLOR.secondary;
  context.fillRect(30, authorY, 18, 18);
  drawText(context, post.author.slice(0, 1).toUpperCase(), 35, authorY + 2, 11, COLOR.background, "bold");
  drawText(context, post.author, 56, authorY, 15, COLOR.primary, "bold");
  drawText(context, `@${post.username}`, 56, authorY + 17, 11, COLOR.secondary, "bold");
  const image = post.imageUrl ? xImages.get(post.imageUrl) : undefined;
  if (post.imageUrl && !image) {
    const next = new Image();
    next.crossOrigin = "anonymous";
    next.onload = () => {
      window.dispatchEvent(new Event("sandevistan-x-image-ready"));
    };
    next.src = `https://sandevistan-x-relay.hmmhmmhm.workers.dev/media?url=${encodeURIComponent(post.imageUrl)}`;
    xImages.set(post.imageUrl, next);
  }
  if (image?.complete && image.naturalWidth > 0) {
    context.filter = "grayscale(1) contrast(1.6)";
    context.drawImage(image, 352, 100, 188, 112);
    context.filter = "none";
  }
  const textY = authorY + 46;
  wrapHudText(post.text, image ? 25 : 44, image ? 3 : 4).forEach((line, lineIndex) => drawText(context, line, 28, textY + lineIndex * 23, 18, COLOR.primary, "bold"));
  const metrics = post.metrics;
  const day = post.createdAt ? new Date(post.createdAt).toLocaleDateString(locale) : "";
  drawText(context, `${day}  ↩${metrics?.replies ?? 0}  ↻${metrics?.reposts ?? 0}  ♡${metrics?.likes ?? 0}  ▱${metrics?.quotes ?? 0}`, 28, 226, 10, COLOR.secondary, "bold");
  drawFooter(context, "SCROLL // TWEETS");
}

function todoLabel(state: DataState<readonly TodoItem[]>): string {
  if (state.status === "fresh") return "TODO // ACTIVE";
  if (state.status === "stale") return "TODO // STALE";
  if (state.status === "loading") return "TODO // LOADING";
  return "TODO // UNAVAILABLE";
}

function drawTodo(
  context: CanvasRenderingContext2D,
  state: DataState<readonly TodoItem[]>,
  selectedIndex: number,
  locale: PhoneLocale,
) {
  const items = state.value ?? [];
  const completed = items.filter((item) => item.completed).length;
  drawHeader(
    context,
    todoLabel(state),
    `${translateHud(locale, "done")} ${completed} / ${items.length}`,
  );
  drawFrame(context, 14, 44, 548, 204);
  if (
    (state.status !== "fresh" && state.status !== "stale")
    || items.length === 0
  ) {
    drawEmptyState(
      context,
      translateHud(
        locale,
        state.status === "loading" ? "todoLoading" : "todoUnavailable",
      ),
      translateHud(locale, "todoChecking"),
    );
    drawFooter(context, "SCROLL // SELECT", "TAP // TOGGLE");
    return;
  }

  const index = Math.min(Math.max(0, selectedIndex), items.length - 1);
  items.slice(0, 6).forEach((item, itemIndex) => {
    const prefix = itemIndex === index ? "> " : "";
    const checkbox = item.completed ? "[X]" : "[ ]";
    const title = wrapHudText(item.title, 42, 1)[0] ?? "";
    drawText(
      context,
      `${prefix}${checkbox} ${title}`,
      itemIndex === index ? 28 : 42,
      55 + itemIndex * 31,
      itemIndex === index ? 19 : 17,
      item.completed ? COLOR.secondary : COLOR.primary,
      "bold",
    );
  });
  drawFooter(context, "SCROLL // SELECT", "TAP // TOGGLE");
}

function weatherLabel(
  state: LiveDashboardState["weather"],
): string {
  if (state.status === "fresh") return "WEATHER // LIVE";
  if (state.status === "stale") return "WEATHER // LAST";
  if (state.status === "loading") return "WEATHER // LOADING";
  return "WEATHER // UNAVAILABLE";
}

function drawWeather(
  context: CanvasRenderingContext2D,
  state: LiveDashboardState["weather"],
  locale: PhoneLocale,
) {
  drawHeader(context, weatherLabel(state));
  drawFrame(context, 14, 44, 548, 204);
  const weather = (
      state.status === "fresh"
      || state.status === "stale"
    )
    ? state.value
    : undefined;
  if (!weather) {
    const loading = state.status === "loading";
    drawEmptyState(
      context,
      translateHud(
        locale,
        loading ? "weatherLoading" : "weatherUnavailable",
      ),
      translateHud(locale, loading ? "weatherWaiting" : "weatherRetry"),
    );
    drawFooter(context, "SOURCE // OPEN-METEO");
    return;
  }

  drawFastWeatherIcon(
    context,
    weather.weatherCode,
    28,
    48,
    104,
  );
  drawText(
    context,
    `${Math.round(weather.temperature)}°C`,
    160,
    56,
    48,
    COLOR.primary,
    "bold",
  );
  drawText(
    context,
    weatherCodeLabel(weather.weatherCode, locale),
    318,
    72,
    25,
    COLOR.secondary,
    "bold",
  );
  if (state.status === "stale") {
    drawText(context, "LAST DATA", 468, 108, 12, COLOR.dim, "bold");
  }

  const metrics = [
    [translateHud(locale, "feelsLike"), `${Math.round(weather.apparentTemperature)}°`],
    [translateHud(locale, "humidity"), `${Math.round(weather.humidity)}%`],
    [translateHud(locale, "precipitation"), `${Math.round(weather.precipitationProbability)}%`],
    [translateHud(locale, "wind"), `${Math.round(weather.windSpeed)}km/h`],
  ] as const;
  const positions = [
    [34, 156],
    [308, 156],
    [34, 208],
    [308, 208],
  ] as const;
  metrics.forEach(([label, value], index) => {
    const [x, y] = positions[index];
    drawText(context, label, x, y, 14, COLOR.secondary, "bold");
    drawText(context, value, x, y + 18, 25, COLOR.primary, "bold");
  });
  drawFooter(context, "SOURCE // OPEN-METEO");
}

function routeLabel(state: DataState<RouteValue>): string {
  if (state.status === "fresh") return "NAV // ACTIVE";
  if (state.status === "stale") return "NAV // STALE";
  if (state.status === "loading") return "NAV // LOADING";
  if (state.status === "disabled") return "NAV // DISABLED";
  return "NAV // UNAVAILABLE";
}

function drawNavigation(
  context: CanvasRenderingContext2D,
  state: DataState<RouteValue>,
  selectedIndex: number,
  locale: PhoneLocale,
) {
  const route = state.value;
  const maneuvers = route?.maneuvers ?? [];
  const index = Math.min(
    Math.max(0, selectedIndex),
    Math.max(0, maneuvers.length - 1),
  );
  drawHeader(
    context,
    routeLabel(state),
    maneuvers.length > 0
      ? `STEP ${formatPosition(index, maneuvers.length)}`
      : undefined,
  );
  drawFrame(context, 14, 44, 548, 204);
  if (!route || maneuvers.length === 0) {
    const copy = state.status === "disabled"
      ? [
          translateHud(locale, "routingKeyRequired"),
          translateHud(locale, "routingConfigure"),
        ]
      : state.status === "loading"
        ? [
            translateHud(locale, "routingCalculating"),
            translateHud(locale, "routingPreparing"),
          ]
        : [
            translateHud(locale, "destinationSelect"),
            translateHud(locale, "destinationSearch"),
          ];
    drawEmptyState(context, copy[0], copy[1]);
    drawFooter(context, "SCROLL // STEPS", "TAP // CURRENT");
    return;
  }

  const maneuver = maneuvers[index];
  drawText(
    context,
    `DEST // ${wrapHudText(route.destinationName, 38, 1)[0] ?? route.destinationName}`,
    32,
    54,
    13,
    COLOR.secondary,
    "bold",
  );
  drawText(
    context,
    `REMAIN // ${formatDistance(route.remainingDistance)}`,
    32,
    76,
    21,
    COLOR.primary,
    "bold",
  );
  wrapHudText(maneuver.instruction, 34, 3).forEach((line, lineIndex) => {
    drawText(
      context,
      line,
      32,
      112 + lineIndex * 31,
      26,
      COLOR.primary,
      "bold",
    );
  });
  drawText(
    context,
    `STEP // ${formatDistance(maneuver.distance)}`,
    32,
    218,
    15,
    COLOR.secondary,
    "bold",
  );
  drawText(
    context,
    index === route.activeManeuverIndex ? "CURRENT" : "BROWSE",
    472,
    220,
    11,
    index === route.activeManeuverIndex ? COLOR.primary : COLOR.dim,
    "bold",
  );
  drawFooter(context, "SCROLL // STEPS", "TAP // CURRENT");
}

export function drawFastDetailHud(
  canvas: HTMLCanvasElement,
  options: FastDetailHudOptions,
  locale: PhoneLocale = "ko",
): void {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D Canvas unavailable");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  context.imageSmoothingEnabled = false;
  context.fillStyle = COLOR.background;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  if (options.mode === "ai") {
    drawFastAiDetail(
      context,
      options.ai ?? createAiHudSnapshot(false),
      options.aiLine ?? 0,
      locale,
    );
  } else if (options.mode === "conversate" && options.conversate) {
    drawFastConversateDetail(context, options.conversate, locale);
  } else if (options.mode === "news") {
    drawNews(
      context,
      options.live.news,
      options.newsIndex,
      options.newsPage,
      locale,
    );
  } else if (options.mode === "x") {
    drawX(context, options.live.x, options.newsIndex, locale);
  } else if (options.mode === "weather") {
    drawWeather(context, options.live.weather, locale);
  } else if (options.mode === "todo") {
    drawTodo(context, options.live.todos, options.todoIndex, locale);
  } else {
    drawNavigation(
      context,
      options.live.route,
      options.navigationIndex,
      locale,
    );
  }
}
