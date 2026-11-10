import { drawKeySetup } from "./fast-release-screens";
import { aiPositionLabel } from "./ai-position-i18n";
import { recordingClockLabel } from "./ai-session-clock";
import { aiReadinessError } from "./ai-readiness-i18n";
import { drawAiReadiness } from "./fast-ai-readiness";
import type { AiHudSnapshot } from "./ai-hud-state";
import { aiHudStatusLabel, translateAiApproval, translateAiHud } from "./ai-hud-i18n";
import { selectAiTranscriptDisplayRows } from "./ai-transcript";
import { translatePhone } from "./phone-i18n";
import type { PhoneLocale } from "./phone-types";
import { aiDetailLines, drawAiDetailBlock, drawAiDetailHeader } from "./fast-ai-detail-style";
import { drawFastCanvasOpenFrame, drawFastCanvasText as text, FAST_CANVAS_COLOR as COLOR } from "./fast-canvas-style";

export function drawFastAiDetail(context: CanvasRenderingContext2D, snapshot: AiHudSnapshot, selectedLine: number, locale: PhoneLocale) {
  if (!snapshot.configured) { drawKeySetup(context, locale, "openai"); return; }
  const activity = !snapshot.configured ? translateAiHud(locale, "error")
    : snapshot.phase === "displaying" ? "" : aiHudStatusLabel(snapshot, locale);
  if (snapshot.pendingApproval) {
    drawAiDetailHeader(context, translatePhone(locale, "ai"), recordingClockLabel(snapshot.recording));
    const approval = translateAiApproval(locale);
    const request = snapshot.pendingApproval;
    drawAiDetailBlock(context, approval.title, [
      ...aiDetailLines(context, `${request.serverName} / ${request.toolName}`, 16, 528, 2),
      ...aiDetailLines(context, request.argumentsSummary, 16, 528, 3),
    ].slice(0, 5), 34, 16, 21);
    const actions = [approval.approve, approval.reject].flatMap((value) => aiDetailLines(context, value, 12, 528, 2));
    actions.slice(0, 4).forEach((value, index) => text(context, value, 24, 188 + index * 17, 12, COLOR.secondary, "bold"));
    return;
  }
  drawAiReadiness(context, snapshot, locale);
  if (!snapshot.configured || (snapshot.error && !snapshot.assistantText.trim())) {
    drawAiDetailBlock(context, translateAiHud(locale, "assistant"), aiDetailLines(context,
      !snapshot.configured ? translatePhone(locale, "aiKeyRequired") : aiReadinessError(snapshot.error || "", locale), 18, 528, 5), 108);
    return;
  }
  if (!snapshot.transcriptLines.length) {
    drawFastCanvasOpenFrame(context, 12, 110, 552, 142);
    text(context, translateAiHud(locale, "you"), 24, 116, 9, COLOR.secondary, "bold");
    return;
  }
  const rows = selectAiTranscriptDisplayRows(snapshot.transcriptLines, selectedLine, 7);
  const count = rows.filter((row) => row.trim()).length;
  const first = Math.max(0, Math.min(selectedLine, snapshot.transcriptLines.length - 1) - count + 1);
  let firstVisible = first;
  let leadingUser = false;
  for (const line of snapshot.transcriptLines.slice(0, first + 1)) {
    if (line.startsWith("YOU // ")) leadingUser = true;
    else if (line.startsWith("AI // ")) leadingUser = false;
  }
  const groups: Array<{ label: string; lines: string[] }> = [];
  for (const row of rows) {
    if (!row.trim()) continue;
    const isUser = row.startsWith("YOU // ");
    const isAssistant = row.startsWith("AI // ");
    if (!groups.length || isUser || isAssistant) groups.push({
      label: translateAiHud(locale, (isUser || (!groups.length && leadingUser)) ? "you" : "assistant"), lines: [],
    });
    const group = groups.at(-1);
    if (group) group.lines.push(row.replace(/^(?:YOU|AI) \/\/\s*/, "").trimStart());
  }
  const height = () => groups.reduce((sum, group) => sum + 30 + group.lines.length * 22, 0);
  while (groups.length && height() > 150) {
    firstVisible += 1;
    const first = groups[0];
    if (first.lines.length > 1) first.lines.shift();
    else groups.shift();
  }
  let y = 108;
  for (const group of groups) y = drawAiDetailBlock(context, group.label, group.lines, y);
  const total = snapshot.transcriptLines.length, end = Math.max(0, Math.min(selectedLine, total - 1));
  const label = aiPositionLabel(locale, firstVisible, end, total);
  context.font = 'bold 12px "SFMono-Regular", Consolas, monospace';
  text(context, label, 560 - context.measureText(label).width, 268, 12, COLOR.secondary, "bold");
  context.fillStyle = COLOR.dim;
  context.fillRect(570, 110, 2, 144);
  context.fillStyle = COLOR.primary;
  const thumbHeight = Math.max(8, 144 * (end - firstVisible + 1) / total);
  const top = total === end - firstVisible + 1 ? 110 : 110 + (144 - thumbHeight) * firstVisible / (total - (end - firstVisible + 1));
  context.fillRect(569, top, 4, thumbHeight);
}
