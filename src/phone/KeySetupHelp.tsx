import type { PhoneLocale } from "../phone-types";
import { getReleaseCopy as t } from "../release-i18n";
export function KeySetupHelp({ locale = "en", provider }: { readonly locale?: PhoneLocale; readonly provider: "openai" | "ors" }) {
  const ai = provider === "openai";
  return <section className="phone-panel phone-key-intro">
    <p>{t(locale, ai ? "openAiSetupHint" : "orsSetupHint")}</p>
    <a href={ai ? "https://platform.openai.com/api-keys" : "https://openrouteservice.org/log-in/"} target="_blank" rel="noreferrer">{t(locale,"getKey")}</a>
    <small>{ai ? "platform.openai.com/api-keys" : "openrouteservice.org/log-in/"}</small>
    <p>{t(locale, ai ? "paidApiNotice" : "orsOptionalNotice")}</p>
    {ai && <details><summary>{t(locale,"privacy")}</summary>
      <p>{t(locale,"aiDataNotice")}</p><p>{t(locale,"aiCostNotice")}</p>
      <p>{t(locale,"aiStopNotice")}</p><p>{t(locale,"aiDeleteNotice")}</p>
    </details>}
  </section>;
}
