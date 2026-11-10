import { recordingClockLabel } from "./ai-session-clock";
import { drawAiDetailHeader } from "./fast-ai-detail-style";
import type { AiHudSnapshot } from "./ai-hud-state";
import type { PhoneLocale } from "./phone-types";
import { aiReadinessCopy } from "./ai-readiness-i18n";
import { translatePhone } from "./phone-i18n";
import { aiDetailLines } from "./fast-ai-detail-style";
import { drawFastCanvasOpenFrame, drawFastCanvasText as text, FAST_CANVAS_COLOR as COLOR } from "./fast-canvas-style";

export function drawAiReadiness(context: CanvasRenderingContext2D, snapshot: AiHudSnapshot, locale: PhoneLocale, title = translatePhone(locale, "ai")) {
  const copy = aiReadinessCopy(snapshot, locale);
  drawAiDetailHeader(context, title, recordingClockLabel(snapshot.recording));
  drawFastCanvasOpenFrame(context, 12, 32, 552, 60);
  context.fillStyle = COLOR.primary;
  context.beginPath();
  context.arc(31, 49, 7, 0, Math.PI * 2);
  context.fill();
  const status = aiDetailLines(context, copy.status, 28, 500, 1)[0] ?? "";
  text(context, status, 48, 36, 28, COLOR.primary, "bold");
  if (copy.hint) text(context, aiDetailLines(context, copy.hint, 16, 516, 1)[0] ?? "", 24, 70, 16, COLOR.secondary, "bold");
  context.fillStyle = COLOR.dim;
  context.fillRect(12, 98, 552, 1);
  text(context, aiDetailLines(context, copy.back, 12, 544, 1)[0] ?? "", 16, 268, 12, COLOR.secondary, "bold");
}
