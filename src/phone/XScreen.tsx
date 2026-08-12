import {
  summarizeXUsage,
  X_POST_READ_USD,
  X_USER_READ_USD,
  type XDailyUsage,
  type XUsageSummary,
} from "../x-usage";

const usd = (value: number) => `$${value.toFixed(value < 0.1 ? 3 : 2)}`;

function UsageRow({ label, value }: { readonly label: string; readonly value: XUsageSummary }) {
  return (
    <div className="phone-x-usage__row">
      <strong>{label}</strong>
      <span>{usd(value.usd)}</span>
      <small>{value.posts} posts · {value.users} users</small>
    </div>
  );
}

function UsageChart({ ledger }: { readonly ledger: readonly XDailyUsage[] }) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    const entry = ledger.find((item) => item.date === key);
    const cost = (entry?.postIds.length ?? 0) * X_POST_READ_USD
      + (entry?.userIds.length ?? 0) * X_USER_READ_USD;
    return { label: key.slice(5), cost };
  });
  const maximum = Math.max(...days.map((day) => day.cost), 0.001);
  return (
    <div className="phone-x-usage__chart" aria-label="Last seven days estimated X API cost">
      {days.map((day) => (
        <div key={day.label} className="phone-x-usage__bar">
          <span style={{ height: `${Math.max(4, day.cost / maximum * 100)}%` }} />
          <small>{day.label}</small>
        </div>
      ))}
    </div>
  );
}

export function XScreen({
  configured,
  ledger,
  loading,
  error,
  onOpenByok,
}: {
  readonly configured: boolean;
  readonly ledger: readonly XDailyUsage[];
  readonly loading: boolean;
  readonly error?: string;
  readonly onOpenByok?: () => void;
}) {
  if (!configured) {
    return (
      <section className="phone-panel phone-x-empty">
        <h2>X (Twitter)</h2>
        <p>Connect X in BYOK Keys to show its API usage estimate and load the HUD timeline.</p>
        <p className="phone-form-message">Required scopes: tweet.read, users.read, and offline.access.</p>
        <button type="button" className="phone-primary-button" onClick={onOpenByok}>Set up BYOK Keys</button>
      </section>
    );
  }
  const summary = summarizeXUsage(ledger);
  return (
    <section className="phone-x-usage" aria-busy={loading || undefined}>
      <div className="phone-x-feed__title">
        <div><h2>X (Twitter)</h2><p>Device-local API usage estimate · X timeline remains on the HUD</p></div>
        {loading && <span>Syncing…</span>}
      </div>
      {error && <p role="alert" className="phone-form-message">{error}</p>}
      <div className="phone-x-usage__rate">
        <span><strong>Post read</strong>{usd(X_POST_READ_USD)} each</span>
        <span><strong>User read</strong>{usd(X_USER_READ_USD)} each</span>
      </div>
      <UsageChart ledger={ledger} />
      <div className="phone-x-usage__rows">
        <UsageRow label="Today" value={summary.today} />
        <UsageRow label="This week" value={summary.week} />
        <UsageRow label="This month" value={summary.month} />
        <UsageRow label="Last month" value={summary.lastMonth} />
      </div>
      <p className="phone-form-message">Estimate is stored only on this device. X bills per returned resource and deduplicates reads within each UTC day; the Developer Console remains the billing source of truth.</p>
      <a className="phone-key-link" href="https://developer.x.com/#pricing" target="_blank" rel="noreferrer">View X API pricing ↗</a>
    </section>
  );
}
