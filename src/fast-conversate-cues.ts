import { conversateDirectoryEntries } from "./conversate-history";
import { translateConversate as t } from "./conversate-i18n";
import type { ConversateSettings, ConversateSnapshot } from "./conversate-state";
import type { PhoneLocale } from "./phone-types";
import { aiDetailLines } from "./fast-ai-detail-style";
import { drawFastCanvasOpenFrame as frame, drawFastCanvasText as text, FAST_CANVAS_COLOR as C } from "./fast-canvas-style";

function countdown(expiresAt: number | undefined, locale: PhoneLocale, now: number) {
  const seconds = Math.max(0, Math.ceil(((expiresAt ?? now) - now) / 1000));
  return `${seconds}${t(locale, "secondsShort")} ${t(locale, "untilHidden")}`;
}
function time(at: string) {
  const date = new Date(at);
  return Number.isFinite(date.getTime()) ? `${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}` : "--:--";
}
export function drawConversateCues(ctx: CanvasRenderingContext2D, snapshot: ConversateSnapshot, locale: PhoneLocale, settings: ConversateSettings, now = Date.now()) {
  const view = snapshot.directory;
  const inform = settings.inform ? view?.mode === "inform" ? snapshot.informs.find(i => i.id === view.id)
    : snapshot.activeInform && (!snapshot.activeInform.expiresAt || snapshot.activeInform.expiresAt > now) ? snapshot.activeInform : undefined : undefined;
  if (inform) {
    frame(ctx, 12, 34, 552, 92, C.dim);
    const lines = aiDetailLines(ctx, inform.text, 15, 528, 32);
    const offset = view?.mode === "inform" ? Math.min(view.row, Math.max(0, lines.length - 4)) : 0;
    const label = view?.mode === "inform" ? `${t(locale,"informHistory")} · ${offset + 1}/${lines.length} · ${t(locale,"tapLive")}`
      : `${t(locale,"inform")} · ${countdown(inform.expiresAt, locale, now)}`;
    text(ctx, aiDetailLines(ctx, label, 10, 528, 1)[0] ?? "", 24, 39, 10, C.secondary, "bold");
    lines.slice(offset, offset + 4).forEach((line,i) => text(ctx,line,24,55+i*18,15,C.primary,"bold"));
  }
  frame(ctx, 12, 220, 552, 60, C.dim);
  if (view?.mode === "list") {
    const entries = conversateDirectoryEntries(snapshot,settings);
    const selected = Math.max(0, entries.findIndex(e => e.id === view.selectedId));
    const label = `${t(locale,"directory")} ${entries.length ? selected + 1 : 0}/${entries.length} · ${t(locale,"directoryHelp")}`;
    text(ctx, aiDetailLines(ctx,label,10,528,1)[0] ?? "",24,225,10,C.secondary,"bold");
    if (!entries.length) text(ctx,t(locale,"noCues"),24,244,15,C.secondary,"bold");
    entries.slice(selected,selected+2).forEach((entry,i) => {
      const title = entry.kind === "inform" ? entry.inform.text : entry.copilot.suggestions[0]?.original ?? "";
      const value = `${i ? " " : ">"} ${t(locale,entry.kind)} ${time(entry.at)} ${title}`;
      text(ctx,aiDetailLines(ctx,value,i ? 12 : 15,528,1)[0] ?? "",24,242+i*21,i ? 12 : 15,i ? C.secondary : C.primary,"bold");
    });
    return;
  }
  const historical = view?.mode === "copilot" ? snapshot.copilotHistory?.find(c => c.id === view.id) : undefined;
  const suggestions = settings.copilot && view?.mode !== "inform" ? historical?.suggestions
    ?? (!snapshot.copilotExpiresAt || snapshot.copilotExpiresAt > now ? snapshot.suggestions : []) : [];
  const selected = view?.mode === "copilot" ? view.suggestion : snapshot.selectedSuggestion;
  const suggestion = suggestions[selected];
  const label = historical ? `${t(locale,"copilot")} ${selected+1}/${suggestions.length} · ${t(locale,"previous")} · ${t(locale,"tapLive")}`
    : suggestion ? `${t(locale,"copilot")} ${selected+1}/${suggestions.length} · ${countdown(snapshot.copilotExpiresAt,locale,now)} · ${t(locale,"tapRecords")}`
    : view ? t(locale,"tapLive") : `${t(locale,"directory")} · ${t(locale,"tapRecords")}`;
  text(ctx,aiDetailLines(ctx,label,10,528,1)[0] ?? "",24,225,10,C.secondary,"bold");
  if (suggestion) {
    text(ctx,aiDetailLines(ctx,suggestion.original,16,528,1)[0] ?? "",24,241,16,C.primary,"bold");
    const meaning = historical ? `${suggestion.pronunciation} · ${suggestion.meaning}` : suggestion.meaning;
    text(ctx,aiDetailLines(ctx,meaning,12,528,1)[0] ?? "",24,264,12,C.secondary,"bold");
  }
}
