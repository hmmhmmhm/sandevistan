import type { PhoneLocale } from "../phone-types";
import { getReleaseCopy } from "../release-i18n";
export function phoneThemeCopy(locale: PhoneLocale) {
  return { label: getReleaseCopy(locale, "themeLabel"), system: getReleaseCopy(locale, "themeSystem"), light: getReleaseCopy(locale, "themeLight"), dark: getReleaseCopy(locale, "themeDark") };
}
