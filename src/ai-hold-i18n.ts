import type { AiCaptureState } from "./ai-hold-capture";
import type { PhoneLocale } from "./phone-types";
import { getReleaseCopy } from "./release-i18n";
import type { ReleaseCopyKey } from "./release-copy-en";
const KEYS = {
  waiting: ["holdWaiting", "holdWaitingHint"],
  starting: ["holdStarting", "holdStartingHint"],
  recording: ["holdRecording", "holdRecordingHint"],
  finishing: ["holdFinishing", "holdFinishingHint"],
} satisfies Record<AiCaptureState, [ReleaseCopyKey, ReleaseCopyKey]>;
export function aiHoldCopy(state: AiCaptureState, locale: PhoneLocale) {
  const [status, hint] = KEYS[state];
  return { status: getReleaseCopy(locale, status), hint: getReleaseCopy(locale, hint) };
}
