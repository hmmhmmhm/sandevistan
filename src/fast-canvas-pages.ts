import type { FastCanvasBattery } from "./glasses";
import {
  getFastHudPages,
  type FastHudPage,
} from "./fast-hud-pages";
import {
  type LiveDashboardState,
} from "./live-state";
import {
  drawFastCanvasPath as drawPath,
  drawFastCanvasText as drawText,
  FAST_CANVAS_COLOR as COLOR,
} from "./fast-canvas-style";
import { drawFastCanvasNavigation } from "./fast-canvas-navigation";
import { truncateHudTitle } from "./fast-hud-text";
import { drawFastWeatherIcon } from "./fast-weather-icon";
import {
  hudWeekday,
  translateHud,
} from "./hud-i18n";
import type { PhoneLocale } from "./phone-types";
import { weatherCodeLabel } from "./weather";
import type { AiHudSnapshot } from "./ai-hud-state";
import { createAiHudSnapshot } from "./ai-hud-state";
import { drawFastAiPanel } from "./fast-ai-hud";
import { drawFastConversatePanel } from "./fast-conversate-hud";
import type { ConversateSnapshot } from "./conversate-state";

export type FastCanvasHudData = {
  readonly battery?: FastCanvasBattery;
  readonly live: LiveDashboardState;
  readonly mapRadiusMeters?: number;
  readonly dashboardMapEnabled?: boolean;
  readonly ai?: AiHudSnapshot;
  readonly conversate?: ConversateSnapshot;
};

function formatTime(now: Date) {
  return [now.getHours(), now.getMinutes()]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function formatDate(now: Date, locale: PhoneLocale) {
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join(".");
  return `${date} ${hudWeekday(locale, now.getDay())}`;
}

function drawFrame(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
) {
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

function drawCheckbox(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  checked: boolean,
) {
  context.fillStyle = checked ? COLOR.secondary : COLOR.primary;
  context.fillRect(x, y, 14, 14);
  context.fillStyle = COLOR.background;
  context.fillRect(x + 3, y + 3, 8, 8);
  if (checked) {
    drawPath(context, [
      [x + 2, y + 7],
      [x + 6, y + 11],
      [x + 13, y + 2],
    ], COLOR.primary, 2);
  }
}

export function drawFastDynamicHeader(
  context: CanvasRenderingContext2D,
  now: Date,
  page: FastHudPage,
  live: LiveDashboardState,
  locale: PhoneLocale,
) {
  drawFrame(context, 296, 8, 272, 54);
  drawText(context, formatTime(now), 306, 12, 22, COLOR.primary, "bold");
  drawText(
    context,
    formatDate(now, locale),
    306,
    40,
    10,
    COLOR.secondary,
    "bold",
  );
  drawText(
    context,
    weatherSummary(live, locale),
    468,
    40,
    10,
    COLOR.secondary,
    "bold",
  );
  const pages = getFastHudPages(live.route.status);
  const pageNumber = pages.indexOf(page) + 1;
  drawText(
    context,
    `${String(pageNumber).padStart(2, "0")} / ${
      String(pages.length).padStart(2, "0")
    }`,
    516,
    18,
    9,
    COLOR.dim,
    "bold",
  );
}

function drawOverview(
  context: CanvasRenderingContext2D,
  data: FastCanvasHudData,
  locale: PhoneLocale,
) {
  const { battery, live } = data;
  const batteryText = battery?.level === undefined
    ? "BATTERY --"
    : `${battery.label} ${battery.level}%${battery.charging ? " +" : ""}`;
  drawText(context, "SYSTEM // OVERVIEW", 308, 82, 11, COLOR.secondary, "bold");
  drawText(context, batteryText, 308, 106, 22, COLOR.primary, "bold");
  context.fillStyle = COLOR.dim;
  context.fillRect(308, 140, 248, 1);
  drawText(context, "WEATHER // NOW", 308, 152, 11, COLOR.secondary, "bold");
  drawText(
    context,
    weatherSummary(live, locale),
    308,
    172,
    20,
    COLOR.primary,
    "bold",
  );

  const weather = usableWeather(live);
  if (weather) {
    drawText(
      context,
      `${translateHud(locale, "feels")} ${
        Math.round(weather.apparentTemperature)
      }°  ${translateHud(locale, "humidity")} ${
        Math.round(weather.humidity)
      }%`,
      308,
      226,
      14,
      COLOR.secondary,
      "bold",
    );
    drawText(
      context,
      `${translateHud(locale, "rain")} ${
        Math.round(weather.precipitationProbability)
      }%  ${translateHud(locale, "wind")} ${
        Math.round(weather.windSpeed)
      }km/h`,
      308,
      248,
      14,
      COLOR.primary,
      "bold",
    );
    if (live.weather.status === "stale") {
      drawText(context, "LAST", 522, 226, 8, COLOR.dim, "bold");
    }
  } else {
    drawText(context, "LIVE DATA UNAVAILABLE", 308, 244, 11, COLOR.dim, "bold");
  }
}

function drawWeather(
  context: CanvasRenderingContext2D,
  live: LiveDashboardState,
  locale: PhoneLocale,
) {
  const weather = usableWeather(live);
  const status = live.weather.status === "stale"
    ? "WEATHER // LAST"
    : live.weather.status === "loading"
      ? "WEATHER // LOADING"
      : weather
        ? "WEATHER // NOW"
        : "WEATHER // UNAVAILABLE";
  drawText(context, status, 308, 82, 11, COLOR.secondary, "bold");
  if (!weather) {
    drawText(
      context,
      live.weather.status === "loading"
        ? translateHud(locale, "weatherLoading")
        : "WEATHER DATA UNAVAILABLE",
      308,
      112,
      18,
      COLOR.primary,
      "bold",
    );
    return;
  }
  drawFastWeatherIcon(
    context,
    weather.weatherCode,
    310,
    110,
    72,
  );
  drawText(
    context,
    `${Math.round(weather.temperature)}°C`,
    400,
    116,
    30,
    COLOR.primary,
    "bold",
  );
  drawText(
    context,
    weatherCodeLabel(weather.weatherCode, locale),
    400,
    154,
    17,
    COLOR.secondary,
    "bold",
  );
  drawText(
    context,
    `${translateHud(locale, "feels")} ${
      Math.round(weather.apparentTemperature)
    }°`,
    308,
    228,
    15,
    COLOR.primary,
    "bold",
  );
  drawText(
    context,
    `${translateHud(locale, "humidity")} ${Math.round(weather.humidity)}%`,
    430,
    228,
    15,
    COLOR.primary,
    "bold",
  );
  drawText(
    context,
    `${translateHud(locale, "rain")} ${
      Math.round(weather.precipitationProbability)
    }%`,
    308,
    252,
    15,
    COLOR.secondary,
    "bold",
  );
  drawText(
    context,
    `${translateHud(locale, "wind")} ${Math.round(weather.windSpeed)}km/h`,
    430,
    252,
    15,
    COLOR.primary,
    "bold",
  );
}

function usableWeather(live: LiveDashboardState) {
  return (live.weather.status === "fresh" || live.weather.status === "stale")
    ? live.weather.value
    : undefined;
}

function weatherSummary(
  live: LiveDashboardState,
  locale: PhoneLocale,
) {
  const weather = usableWeather(live);
  return weather
    ? `${Math.round(weather.temperature)}°C ${
      weatherCodeLabel(weather.weatherCode, locale)
    }`
    : "WEATHER --";
}

function drawNews(
  context: CanvasRenderingContext2D,
  live: LiveDashboardState,
) {
  const stale = live.news.status === "stale";
  const items = live.news.status === "fresh" || stale
    ? live.news.value ?? []
    : [];
  drawText(
    context,
    stale ? "NEWS // FOCUS · STALE" : "NEWS // FOCUS",
    308,
    82,
    11,
    COLOR.secondary,
    "bold",
  );
  if (items.length === 0) {
    drawText(
      context,
      live.news.status === "loading" ? "NEWS LOADING" : "NEWS UNAVAILABLE",
      308,
      112,
      16,
      COLOR.primary,
      "bold",
    );
    return;
  }

  const positions = [
    [308, 104, 14, 25],
    [308, 128, 14, 25],
    [308, 152, 14, 25],
    [308, 176, 14, 25],
    [308, 237, 13, 29],
    [308, 257, 13, 29],
  ] as const;
  items.slice(0, 6).forEach((item, index) => {
    const [x, y, size, maxUnits] = positions[index];
    drawText(
      context,
      `· ${truncateHudTitle(item.title, maxUnits)}`,
      x,
      y,
      size,
      index < 4 ? COLOR.primary : COLOR.secondary,
      "bold",
    );
  });
  drawText(context, "NEWS // MORE", 308, 222, 10, COLOR.secondary, "bold");
}

function drawX(context: CanvasRenderingContext2D, live: LiveDashboardState) {
  const posts = live.x.value ?? [];
  drawText(context, "X // HOME", 308, 82, 11, COLOR.secondary, "bold");
  if (posts.length === 0) {
    drawText(context, live.x.status === "loading" ? "X LOADING" : "X UNAVAILABLE", 308, 112, 16, COLOR.primary, "bold");
    return;
  }
  posts.slice(0, 4).forEach((post, index) => {
    drawText(context, `${post.author} · @${post.username}`, 308, 106 + index * 39, 10, COLOR.secondary, "bold");
    drawText(context, truncateHudTitle(post.text, 27), 308, 121 + index * 39, 14, COLOR.primary, "bold");
  });
  drawText(context, "TAP // TWEETS", 308, 257, 10, COLOR.secondary, "bold");
}

function drawTodo(
  context: CanvasRenderingContext2D,
  live: LiveDashboardState,
  locale: PhoneLocale,
) {
  const items = live.todos.value ?? [];
  const completed = items.filter((item) => item.completed).length;
  drawText(context, "TODO // ACTIVE", 308, 82, 11, COLOR.secondary, "bold");
  const positions = [108, 150, 188] as const;
  items.slice(0, positions.length).forEach((item, index) => {
    drawCheckbox(context, 308, positions[index], item.completed);
    drawText(
      context,
      truncateHudTitle(item.title, 24),
      332,
      positions[index] - 5,
      index < 2 ? 18 : 16,
      item.completed ? COLOR.secondary : COLOR.primary,
      "bold",
    );
  });

  drawText(context, "PROGRESS // TODAY", 308, 226, 10, COLOR.secondary, "bold");
  const progress = `${translateHud(locale, "done")} ${
    completed
  } / ${items.length}`;
  drawText(context, progress, 308, 244, 18, COLOR.primary, "bold");
}

export function drawFastDynamicPage(
  context: CanvasRenderingContext2D,
  page: FastHudPage,
  data: FastCanvasHudData,
  locale: PhoneLocale,
) {
  drawFrame(context, 296, 72, 272, 134);
  drawFrame(context, 296, 216, 272, 64);
  if (page === "overview") drawOverview(context, data, locale);
  if (page === "navigation") {
    drawFastCanvasNavigation(context, data.live.route, locale);
  }
  if (page === "news") drawNews(context, data.live);
  if (page === "x") drawX(context, data.live);
  if (page === "todo") drawTodo(context, data.live, locale);
  if (page === "weather") drawWeather(context, data.live, locale);
  if (page === "ai") {
    drawFastAiPanel(context, data.ai ?? createAiHudSnapshot(false), locale);
  }
  if (page === "conversate" && data.conversate) {
    drawFastConversatePanel(context, data.conversate, locale);
  }
}
