import type { HudPage } from "./canvas-hud";
import type { DataStatus } from "./live-state";

export type FastHudPage = HudPage | "weather" | "ai" | "conversate" | "x";
export type FastHudPageDirection = "next" | "previous";
export type FastHudLayout = {
  readonly order: readonly FastHudPage[];
  readonly enabled: readonly FastHudPage[];
};

const KEYLESS_FAST_HUD_PAGES = [
  "overview",
  "news",
  "x",
  "todo",
  "weather",
  "ai",
  "conversate",
] as const satisfies readonly FastHudPage[];

const ROUTED_FAST_HUD_PAGES = [
  ...KEYLESS_FAST_HUD_PAGES,
  "navigation",
] as const satisfies readonly FastHudPage[];

export function getFastHudPages(
  routeStatus: DataStatus,
  layout?: FastHudLayout,
): readonly FastHudPage[] {
  if (layout) {
    const available = new Set<FastHudPage>(
      routeStatus === "disabled"
        ? KEYLESS_FAST_HUD_PAGES
        : ROUTED_FAST_HUD_PAGES,
    );
    const enabled = new Set(layout.enabled);
    const pages = layout.order.filter((page, index) => (
      available.has(page)
      && enabled.has(page)
      && layout.order.indexOf(page) === index
    ));
    if (!pages.includes("overview")) pages.unshift("overview");
    return pages;
  }
  return routeStatus === "disabled"
    ? KEYLESS_FAST_HUD_PAGES
    : ROUTED_FAST_HUD_PAGES;
}

export function normalizeFastHudPage(
  page: FastHudPage,
  routeStatus: DataStatus,
  layout?: FastHudLayout,
): FastHudPage {
  const pages = getFastHudPages(routeStatus, layout);
  if (pages.includes(page)) return page;
  return layout ? pages[0] ?? "overview" : "weather";
}

export function getAdjacentFastHudPage(
  page: FastHudPage,
  direction: FastHudPageDirection,
  routeStatus: DataStatus,
  layout?: FastHudLayout,
): FastHudPage {
  const pages = getFastHudPages(routeStatus, layout);
  const current = normalizeFastHudPage(page, routeStatus, layout);
  const index = pages.indexOf(current);
  const offset = direction === "next" ? 1 : -1;
  return pages[(index + offset + pages.length) % pages.length];
}
