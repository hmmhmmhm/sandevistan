import type { ConversateSnapshot } from "./conversate-state";
import { translateConversate } from "./conversate-i18n";
import { drawFastCanvasText as drawText, FAST_CANVAS_COLOR as COLOR } from "./fast-canvas-style";
import { wrapHudText } from "./fast-detail-text";
import type { PhoneLocale } from "./phone-types";

export function drawFastConversatePanel(
  context: CanvasRenderingContext2D,
  snapshot: ConversateSnapshot,
  locale: PhoneLocale,
) {
  drawText(context, "CONVERSATE // LIVE", 308, 82, 11, COLOR.secondary, "bold");
  const latest = snapshot.history[0];
  const lines = latest?.segments.slice(-3).map((segment) => segment.translation || segment.text) ?? [];
  if (!lines.length) {
    drawText(context, translateConversate(locale, "ready"), 308, 112, 20, COLOR.primary, "bold");
    drawText(context, "TAP // START LISTENING", 308, 148, 11, COLOR.secondary, "bold");
  } else {
    lines.forEach((line, index) => drawText(
      context,
      wrapHudText(line, 29, 1)[0] ?? "",
      308,
      106 + index * 34,
      index === lines.length - 1 ? 17 : 14,
      index === lines.length - 1 ? COLOR.primary : COLOR.secondary,
      "bold",
    ));
  }
  drawText(context, `${snapshot.history.length} SAVED CONVERSATIONS`, 308, 246, 12, COLOR.secondary, "bold");
}

export { drawFastConversateDetail } from "./fast-conversate-detail";
