import { readCache, writeCache, type EvenStorage } from "./live-cache";

export const X_POST_READ_USD = 0.005;
export const X_USER_READ_USD = 0.01;

export type XDailyUsage = {
  readonly date: string;
  readonly postIds: readonly string[];
  readonly userIds: readonly string[];
};

export type XUsageSummary = {
  readonly posts: number;
  readonly users: number;
  readonly usd: number;
};

const dayKey = (value: Date) => value.toISOString().slice(0, 10);
const emptySummary = (): XUsageSummary => ({ posts: 0, users: 0, usd: 0 });
const usageCost = (entry: Pick<XDailyUsage, "postIds" | "userIds">) => (
  entry.postIds.length * X_POST_READ_USD + entry.userIds.length * X_USER_READ_USD
);

function isLedger(value: unknown): value is readonly XDailyUsage[] {
  return Array.isArray(value) && value.length <= 400 && value.every((entry) => {
    if (typeof entry !== "object" || entry === null) return false;
    const item = entry as { date?: unknown; postIds?: unknown; userIds?: unknown };
    return typeof item.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
      && Array.isArray(item.postIds) && item.postIds.every((id: unknown) => typeof id === "string")
      && Array.isArray(item.userIds) && item.userIds.every((id: unknown) => typeof id === "string");
  });
}

export function addXUsage(
  ledger: readonly XDailyUsage[],
  value: { readonly postIds: readonly string[]; readonly userIds: readonly string[] },
  now = new Date(),
): readonly XDailyUsage[] {
  const date = dayKey(now);
  const previous = ledger.find((entry) => entry.date === date);
  const entry: XDailyUsage = {
    date,
    postIds: [...new Set([...(previous?.postIds ?? []), ...value.postIds])].slice(-2_000),
    userIds: [...new Set([...(previous?.userIds ?? []), ...value.userIds])].slice(-200),
  };
  return [...ledger.filter((item) => item.date !== date), entry]
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(-400);
}

function summarize(
  ledger: readonly XDailyUsage[],
  start: Date,
  end: Date,
): XUsageSummary {
  const startKey = dayKey(start);
  const endKey = dayKey(end);
  return ledger.reduce((total, entry) => {
    if (entry.date < startKey || entry.date > endKey) return total;
    return {
      posts: total.posts + entry.postIds.length,
      users: total.users + entry.userIds.length,
      usd: total.usd + usageCost(entry),
    };
  }, emptySummary());
}

export function summarizeXUsage(ledger: readonly XDailyUsage[], now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const week = new Date(today);
  week.setUTCDate(week.getUTCDate() - (week.getUTCDay() === 0 ? 6 : week.getUTCDay() - 1));
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const lastMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  return {
    today: summarize(ledger, today, now),
    week: summarize(ledger, week, now),
    month: summarize(ledger, month, now),
    lastMonth: summarize(ledger, lastMonthStart, lastMonthEnd),
  };
}

export const resolveXUsageLedger = (storage: EvenStorage) => readCache(
  storage,
  "x-usage",
  isLedger,
).then((ledger) => ledger ?? []);

export const writeXUsageLedger = (storage: EvenStorage, ledger: readonly XDailyUsage[]) =>
  writeCache(storage, "x-usage", ledger.slice(-400));
