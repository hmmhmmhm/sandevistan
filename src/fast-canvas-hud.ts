import {
  drawFastDynamicHeader,
  drawFastDynamicPage,
  type FastCanvasHudData,
} from "./fast-canvas-pages";
import {
  normalizeFastHudPage,
  type FastHudPage,
} from "./fast-hud-pages";
import { drawFastMap } from "./fast-map";
import { createInitialLiveDashboardState } from "./live-state";
import { FAST_CANVAS_COLOR as COLOR } from "./fast-canvas-style";
import type { PhoneLocale } from "./phone-types";

const WIDTH = 576;
const HEIGHT = 288;

export type { FastCanvasHudData } from "./fast-canvas-pages";
export { getAdjacentFastHudPage } from "./fast-hud-pages";
export { truncateHudTitle } from "./fast-hud-text";

export function drawFastCanvasHud(
  canvas: HTMLCanvasElement,
  now = new Date(),
  page: FastHudPage = "overview",
  data: FastCanvasHudData = {
    live: createInitialLiveDashboardState(),
  },
  locale: PhoneLocale = "ko",
) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D Canvas unavailable");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  context.imageSmoothingEnabled = false;
  context.fillStyle = COLOR.background;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  const visiblePage = normalizeFastHudPage(page, data.live.route.status);
  if (data.dashboardMapEnabled !== false) {
    drawFastMap(context, data.live, data.mapRadiusMeters ?? 650, locale);
  }
  drawFastDynamicHeader(context, now, visiblePage, data.live, locale);
  drawFastDynamicPage(context, visiblePage, data, locale);
}
