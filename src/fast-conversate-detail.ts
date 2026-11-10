import { drawKeySetup } from "./fast-release-screens";
import { aiReadinessError } from "./ai-readiness-i18n";
import { recordingClockLabel } from "./ai-session-clock";
import { createAiHudSnapshot } from "./ai-hud-state";
import { drawAiReadiness } from "./fast-ai-readiness";
import { DEFAULT_CONVERSATE_SETTINGS, type ConversateSnapshot, type ConversateSettings } from "./conversate-state";
import { conversateTranscriptRows, visibleConversateTranscript } from "./conversate-transcript-layout";
import { drawConversateCues } from "./fast-conversate-cues";
import { translateConversate as t } from "./conversate-i18n";
import type { PhoneLocale } from "./phone-types";
import { aiDetailLines, drawAiDetailHeader } from "./fast-ai-detail-style";
import { drawFastCanvasText as text, FAST_CANVAS_COLOR as C } from "./fast-canvas-style";

export function drawFastConversateDetail(context: CanvasRenderingContext2D, snapshot: ConversateSnapshot, locale: PhoneLocale, settings: ConversateSettings = DEFAULT_CONVERSATE_SETTINGS) {
  if (snapshot.error === "OpenAI key required") { drawKeySetup(context, locale, "openai", t(locale,"conversate")); return; }
  if (!snapshot.segments.length && !snapshot.partial && snapshot.phase !== "error" && !snapshot.directory) {
    drawAiReadiness(context, { ...createAiHudSnapshot(true), phase: snapshot.phase, recording: snapshot.recording }, locale, t(locale,"conversate"));
    return;
  }
  drawAiDetailHeader(context,t(locale,"conversate"),recordingClockLabel(snapshot.recording));
  drawConversateCues(context,snapshot,locale,settings);
  if (snapshot.error && !snapshot.activeInform && snapshot.directory?.mode !== "inform") {
    aiDetailLines(context,aiReadinessError(snapshot.error, locale),15,528,4)
      .forEach((line,i) => text(context,line,24,55+i*18,15,C.secondary,"bold"));
  }
  const label = `${t(locale,"transcription")} · ${snapshot.transcriptAnchor || snapshot.transcriptOffset ? t(locale,"previous") : t(locale,"latest")} · ${t(locale,"scrollRows")}`;
  text(context,aiDetailLines(context,label,9,544,1)[0] ?? "",16,129,9,C.secondary,"bold");
  const rows = conversateTranscriptRows(snapshot,settings.translation,context);
  visibleConversateTranscript(snapshot,rows).forEach((row,i) => text(context,row.text,24,143+i*18,row.translation ? 16 : 17,row.translation ? C.secondary : C.primary,"bold"));
}
