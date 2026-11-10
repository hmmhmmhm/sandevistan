import { RELEASE_COPY_EN, type ReleaseCopyKey } from "./release-copy-en";
import { getReleaseCopy } from "./release-i18n";
import type { PhoneLocale } from "./phone-types";
const keys = new Map<string, ReleaseCopyKey>();
function isCopyKey(key: string): key is ReleaseCopyKey { return key in RELEASE_COPY_EN; }
for (const key of Object.keys(RELEASE_COPY_EN)) {
  if (key.startsWith("hudFixed") && isCopyKey(key)) keys.set(RELEASE_COPY_EN[key], key);
}
export function fixedHud(locale: PhoneLocale, english: string): string {
  const key = keys.get(english);
  return key ? getReleaseCopy(locale, key) : english;
}
