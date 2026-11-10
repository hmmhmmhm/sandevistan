import { getReleaseCopy } from "./release-i18n";
import type { PhoneLocale } from "./phone-types";

export function aiPositionLabel(locale: PhoneLocale, first: number, end: number, total: number) {
  const above = first, below = total - end - 1, range = `${first + 1}–${end + 1}/${total}`;
  if (locale === "ko") return `▲ 위 ${above}줄 · ${range} · ${below ? `아래 ${below}줄 ▼` : "끝"}`;
  if (locale === "ja") return `▲ 上 ${above}行 · ${range} · ${below ? `下 ${below}行 ▼` : "終わり"}`;
  const aboveLabel = getReleaseCopy(locale, "positionAbove").replace("{count}", String(above));
  const belowLabel = getReleaseCopy(locale, "positionBelow").replace("{count}", String(below));
  return `▲ ${aboveLabel} · ${range} · ${below ? `${belowLabel} ▼` : getReleaseCopy(locale, "positionEnd")}`;
}
