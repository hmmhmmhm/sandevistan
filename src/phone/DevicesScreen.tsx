import type { FastCanvasBattery } from "../glasses";
import { DeviceBatteryCard } from "./DeviceBattery";
import { EVEN_HUB_SDK_VERSION } from "../app-metadata";
import type { PhoneStringKey } from "../phone-i18n";

export function DevicesScreen({
  battery,
  status,
  t,
}: {
  readonly battery?: FastCanvasBattery;
  readonly status: string;
  readonly t: (key: PhoneStringKey) => string;
}) {
  const g2 = battery?.label === "G2" ? battery : undefined;
  const ring = battery?.label === "R1" ? battery : undefined;
  return (
    <div className="phone-detail-stack">
      <DeviceBatteryCard kind="g2" battery={g2} t={t}/>
      <DeviceBatteryCard kind="r1" battery={ring} t={t}/>
      <section className="phone-panel">
        <dl className="phone-data-list">
          <div><dt>{t("sdk")}</dt><dd>{EVEN_HUB_SDK_VERSION}</dd></div>
          <div><dt>{t("bilateral")}</dt><dd>{t("active")}</dd></div>
          <div><dt>{t("transport")}</dt><dd>{status}</dd></div>
        </dl>
      </section>
    </div>
  );
}
