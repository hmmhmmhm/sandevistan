import {
  drawFastCanvasText as drawText,
  FAST_CANVAS_COLOR as COLOR,
} from "./fast-canvas-style";
import { wrapHudText } from "./fast-detail-text";
import { translateHud } from "./hud-i18n";
import type { PhoneLocale } from "./phone-types";

const WIDTH = 576;

export function formatDetailPosition(
  index: number,
  count: number,
): string {
  const current = count > 0 ? Math.min(index, count - 1) + 1 : 0;
  return `${String(current).padStart(2, "0")} / ${
    String(count).padStart(2, "0")
  }`;
}

export function formatDetailDistance(distance: number): string {
  const rounded = Math.max(0, Math.round(distance));
  return rounded >= 1_000
    ? `${(rounded / 1_000).toFixed(1)}km`
    : `${rounded}m`;
}

export function formatDetailPublished(
  publishedAt: number | undefined,
  locale: PhoneLocale,
): string {
  if (publishedAt === undefined) {
    return translateHud(locale, "publishedUnknown");
  }
  const date = new Date(publishedAt);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${month}.${day} ${hour}:${minute}`;
}

export function drawDetailHeader(
  context: CanvasRenderingContext2D,
  title: string,
  counter?: string,
) {
  context.fillStyle = COLOR.background;
  context.fillRect(0, 0, WIDTH, 38);
  drawText(context, title, 14, 10, 16, COLOR.primary, "bold");
  if (counter) {
    context.font = 'bold 13px "SFMono-Regular", Consolas, monospace';
    const width = context.measureText(counter).width;
    drawText(
      context,
      counter,
      Math.max(300, 562 - width),
      11,
      13,
      COLOR.secondary,
      "bold",
    );
  }
  context.fillStyle = COLOR.dim;
  context.fillRect(14, 36, 548, 1);
}

export function drawDetailFooter(
  context: CanvasRenderingContext2D,
  first: string,
  second?: string,
  back = "DOUBLE TAP // BACK",
) {
  context.fillStyle = COLOR.background;
  context.fillRect(0, 254, WIDTH, 34);
  context.fillStyle = COLOR.dim;
  context.fillRect(14, 254, 548, 1);
  drawText(context, first, 14, 268, 10, COLOR.secondary, "bold");
  if (second) {
    drawText(context, second, 196, 268, 10, COLOR.secondary, "bold");
  }
  context.font = 'bold 10px "SFMono-Regular", Consolas, monospace';
  const backWidth = context.measureText(back).width;
  drawText(
    context,
    back,
    Math.max(196, 562 - backWidth),
    268,
    10,
    COLOR.primary,
    "bold",
  );
}

export function drawDetailEmptyState(
  context: CanvasRenderingContext2D,
  headline: string,
  detail: string,
) {
  drawText(context, headline, 36, 84, 30, COLOR.primary, "bold");
  for (const [index, line] of wrapHudText(detail, 50, 3).entries()) {
    drawText(context, line, 38, 136 + index * 25, 17, COLOR.secondary, "bold");
  }
}
