import type { SupportedLocale } from "./i18n/locale-registry";
import { RELEASE_TRANSLATIONS } from "./i18n/release-translations";
import { RELEASE_COPY_EN, type ReleaseCopyKey } from "./release-copy-en";

export function releaseTranslation(locale: SupportedLocale, group: string, key: string): string | undefined {
  return RELEASE_TRANSLATIONS[locale]?.[group]?.[key];
}
export function getReleaseCopy(locale: SupportedLocale, key: ReleaseCopyKey): string {
  return releaseTranslation(locale, "release", key) ?? RELEASE_COPY_EN[key];
}
