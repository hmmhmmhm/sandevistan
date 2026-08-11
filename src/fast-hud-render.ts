import type { AiHudSnapshot } from "./ai-hud-state";
import { drawFastCanvasHud } from "./fast-canvas-hud";
import { drawFastDetailHud } from "./fast-detail-hud";
import type { FastHudPage } from "./fast-hud-pages";
import { drawFastFullscreenMap } from "./fast-map";
import { paginateFastNewsSummary } from "./fast-news-pages";
import type { FastHudViewContext, FastHudViewState } from "./fast-hud-view";
import type { FastCanvasBattery } from "./glasses";
import type { LiveDashboardState } from "./live-state";
import type { PhoneLocale } from "./phone-types";
import type { ConversateSnapshot } from "./conversate-state";

export type FastHudNewsPageCache = {
  readonly key: string;
  readonly counts: readonly number[];
};

export function resolveFastHudViewContext(
  canvas: HTMLCanvasElement,
  live: LiveDashboardState,
  locale: PhoneLocale,
  ai: AiHudSnapshot,
  cache: FastHudNewsPageCache,
): { readonly context: FastHudViewContext; readonly cache: FastHudNewsPageCache } {
  const route = live.route.value;
  const news = live.news.value ?? [];
  const key = [live.news.status, live.news.fetchedAt ?? "", news.length].join(":");
  let counts = cache.counts;
  if (key !== cache.key) {
    const context = canvas.getContext("2d");
    counts = news.length === 0
      ? []
      : context
        ? news.map((item) => paginateFastNewsSummary(
            context,
            item.summary,
            locale,
          ).length)
        : news.map(() => 1);
  }
  return {
    context: {
      newsCount: news.length,
      newsPageCounts: counts,
      todoCount: live.todos.value?.length ?? 0,
      maneuverCount: route?.maneuvers.length ?? 0,
      activeManeuverIndex: route?.activeManeuverIndex ?? 0,
      aiLineCount: ai.transcriptLines.length,
    },
    cache: { key, counts },
  };
}

export function drawFastHudSurface(options: {
  readonly canvas: HTMLCanvasElement;
  readonly page: FastHudPage;
  readonly view: FastHudViewState;
  readonly live: LiveDashboardState;
  readonly battery?: FastCanvasBattery;
  readonly mapRadiusMeters: number;
  readonly dashboardMapEnabled?: boolean;
  readonly ai: AiHudSnapshot;
  readonly conversate: ConversateSnapshot;
  readonly locale: PhoneLocale;
}) {
  const { canvas, page, view, live, battery, mapRadiusMeters, dashboardMapEnabled = true, ai, conversate, locale } = options;
  if (view.mode === "map") {
    drawFastFullscreenMap(canvas, live, mapRadiusMeters, locale);
    return;
  }
  if (view.mode !== "dashboard") {
    const detailLive = view.mode === "x"
      ? {
          ...live,
          news: {
            status: live.x.status,
            value: (live.x.value ?? []).map((post) => ({
              id: post.id,
              title: `@${post.username} · ${post.author}`,
              summary: post.text,
              publishedAt: post.createdAt ? Date.parse(post.createdAt) : undefined,
            })),
          },
        }
      : live;
    drawFastDetailHud(canvas, {
      mode: view.mode,
      live: detailLive,
      newsIndex: view.newsIndex,
      newsPage: view.newsPage,
      todoIndex: view.todoIndex,
      navigationIndex: view.navigationIndex,
      ...(view.mode === "ai" ? { ai, aiLine: view.aiLine } : {}),
      ...(view.mode === "conversate" ? { conversate } : {}),
    }, locale);
    return;
  }
  drawFastCanvasHud(canvas, new Date(), page, {
    battery,
    live,
    mapRadiusMeters,
    dashboardMapEnabled,
    ...(page === "ai" ? { ai } : {}),
    ...(page === "conversate" ? { conversate } : {}),
  }, locale);
}
