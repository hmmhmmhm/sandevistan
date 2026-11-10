import { getReleaseCopy } from "./release-i18n";
import type { ReleaseCopyKey } from "./release-copy-en";
import { aiHoldCopy } from "./ai-hold-i18n";
import type { AiHudSnapshot } from "./ai-hud-state";
import { aiHudStatusLabel, translateAiHud } from "./ai-hud-i18n";
import type { PhoneLocale } from "./phone-types";

export function aiReadinessCopy(snapshot: AiHudSnapshot, locale: PhoneLocale) {
  if (snapshot.captureState && !snapshot.error && snapshot.phase !== "connecting"
    && (snapshot.captureState !== "waiting" || snapshot.phase === "listening" || snapshot.phase === "displaying")) {
    return { ...aiHoldCopy(snapshot.captureState, locale), back: translateAiHud(locale, "doubleTapBack") };
  }
  const listening = snapshot.configured && snapshot.phase === "listening";
  const connecting = snapshot.phase === "connecting" || snapshot.phase === "idle";
  const answering = Boolean(snapshot.assistantText) && !snapshot.responseComplete && !snapshot.activeTool;
  const status = !snapshot.configured ? translateAiHud(locale, "error") : listening ? getReleaseCopy(locale, "holdRecording")
    : connecting ? getReleaseCopy(locale, "preparing")
    : snapshot.phase === "thinking" && answering
      ? getReleaseCopy(locale, "answering")
      : aiHudStatusLabel(snapshot, locale);
  const hint = snapshot.error ? aiReadinessError(snapshot.error, locale)
    : listening ? getReleaseCopy(locale, "listeningNow") : "";
  return { status, hint, back: translateAiHud(locale, "doubleTapBack") };
}

export function aiReadinessError(message: string, locale: PhoneLocale) {
  let key: ReleaseCopyKey = "errorGeneric";
  if (/timeout|timed out/i.test(message)) key = "errorTimeout";
  else if (/quota|billing|rate.?limit|429/i.test(message)) key = "errorQuota";
  else if (/(?:openai|api).?key|unauthori[sz]ed|authentication|401/i.test(message)) key = "errorKey";
  else if (/microphone|audio capture|audio input/i.test(message)) key = "errorMicrophone";
  else if (/network|disconnect|websocket|connection closed|fetch/i.test(message)) key = "errorConnection";
  else if (/configur|session.updated|connect/i.test(message)) key = "errorConfiguration";
  return getReleaseCopy(locale, key);
}
