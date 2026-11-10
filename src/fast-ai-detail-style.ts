import { drawFastCanvasOpenFrame, drawFastCanvasText as text, FAST_CANVAS_COLOR as COLOR } from "./fast-canvas-style";
import { wrapHudTextByWidth } from "./fast-detail-text";

export function aiDetailLines(context: CanvasRenderingContext2D, value: string, size: number, width: number, count: number) {
  context.font = `bold ${size}px "SFMono-Regular", Consolas, monospace`;
  return wrapHudTextByWidth(value, (line) => context.measureText(line).width, width, count);
}

export function drawAiDetailHeader(context: CanvasRenderingContext2D, title: string, status: string) {
  text(context, aiDetailLines(context, title, 10, 190, 1)[0] ?? "", 16, 8, 10, COLOR.secondary, "bold");
  const activity = aiDetailLines(context, status, 12, 328, 1)[0] ?? "";
  const width = context.measureText(activity).width;
  text(context, activity, Math.max(216, 560 - width), 7, 12, COLOR.primary, "bold");
  context.fillStyle = COLOR.dim;
  context.fillRect(16, 26, 544, 1);
}

export function drawAiDetailBlock(context: CanvasRenderingContext2D, label: string, lines: readonly string[], y: number, size = 18, lineHeight = 22) {
  const height = 22 + lines.length * lineHeight;
  drawFastCanvasOpenFrame(context, 12, y, 552, height, COLOR.dim);
  text(context, label, 24, y + 5, 9, COLOR.secondary, "bold");
  lines.forEach((line, index) => text(context, line, 24, y + 19 + index * lineHeight, size, COLOR.primary, "bold"));
  return y + height + 8;
}
