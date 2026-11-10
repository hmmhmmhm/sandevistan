import type { FastCanvasBattery } from "../glasses";
import type { PhoneStringKey } from "../phone-i18n";
import "./phone-devices.css";
type Translate = (key: PhoneStringKey) => string;
export function DeviceProductImage({ kind }: { readonly kind: "g2" | "r1" }) {
  return <div className={`phone-product phone-product--${kind}`}><img src={`${import.meta.env.BASE_URL}devices/even-${kind}.png`} alt="" /></div>;
}
export function DeviceHomeCard({ battery, t }: { readonly battery?: FastCanvasBattery; readonly t: Translate }) {
  return <><span className="phone-visually-hidden">{t("devices")}</span>
    <div className="phone-products"><DeviceProductImage kind="g2"/><DeviceProductImage kind="r1"/></div>
    <div className="phone-battery-pair">{(["G2", "R1"] as const).map(label => <span key={label}>{label} <strong>{battery?.label === label && battery.level !== undefined ? `${battery.level}%` : "—%"}</strong>
      {battery?.label === label && battery.charging && <small>{t("charging")}</small>}
      {(battery?.label !== label || battery.level === undefined) && <small className="phone-visually-hidden">{t("unavailable")}</small>}
    </span>)}</div><span className="phone-device-summary">{t("glasses")} · {t("ring")}</span></>;
}
export function DeviceBatteryCard({ kind, battery, t }: { readonly kind: "g2" | "r1"; readonly battery?: FastCanvasBattery; readonly t: Translate }) {
  const name = kind === "g2" ? "Even G2" : "Even R1", known = battery?.level !== undefined;
  return <section className="phone-panel phone-device-detail" aria-label={name}>
    <div className="phone-device-title"><h2>{name}</h2><span>{battery ? t("connected") : t("unavailable")}</span></div>
    <DeviceProductImage kind={kind}/>
    <div className="phone-device-battery"><strong>{known ? `${battery.level}%` : "—%"}</strong><span>{known && battery.charging ? t("charging") : known ? t("battery") : t("unavailable")}</span></div>
    {known && <progress aria-label={`${name} ${t("battery")}`} max="100" value={battery.level}/>}
  </section>;
}
