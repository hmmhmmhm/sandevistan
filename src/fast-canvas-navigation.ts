import { LOCALE_REGISTRY } from "./i18n/locale-registry";
import { translatePhone } from "./phone-i18n";
import { fixedHud } from "./fixed-hud-i18n";
import {
  drawFastCanvasPath as drawPath,
  drawFastCanvasText as drawText,
  FAST_CANVAS_COLOR as COLOR,
} from "./fast-canvas-style";
import { truncateHudTitle } from "./fast-hud-text";
import { translateHud } from "./hud-i18n";
import type { DataState, RouteValue } from "./live-state";
import type { PhoneLocale } from "./phone-types";

function drawRouteDestination(
  context: CanvasRenderingContext2D,
  route: RouteValue,
  locale: PhoneLocale,
) {
  drawText(
    context,
    `${LOCALE_REGISTRY[locale].route.destination} // ${truncateHudTitle(route.destinationName, 18)}`,
    308,
    226,
    10,
    COLOR.secondary,
    "bold",
  );
  const profile = route.profile === "foot-walking"
    ? translateHud(locale, "walking")
    : route.profile === "cycling-regular"
      ? translateHud(locale, "cycling")
      : translateHud(locale, "driving");
  drawText(context, `${translatePhone(locale, "routingMode")} // ${profile}`, 308, 246, 15, COLOR.primary, "bold");
}

function formatRouteDistance(distance: number) {
  const rounded = Math.max(0, Math.round(distance));
  return rounded >= 1_000
    ? `${(rounded / 1_000).toFixed(1)}km`
    : `${rounded}m`;
}

export function drawFastCanvasNavigation(
  context: CanvasRenderingContext2D,
  routeState: DataState<RouteValue>,
  locale: PhoneLocale,
) {
  if (routeState.status === "disabled") {
    drawText(context, fixedHud(locale, "NAV // READY"), 308, 82, 11, COLOR.secondary, "bold");
    drawText(
      context,
      translateHud(locale, "routingKeyRequired"),
      308,
      108,
      24,
      COLOR.primary,
      "bold",
    );
    drawText(
      context,
      translateHud(locale, "routingConnect"),
      308,
      150,
      15,
      COLOR.secondary,
      "bold",
    );
    drawText(context, fixedHud(locale, "PHONE // COMPANION"), 308, 226, 10, COLOR.secondary, "bold");
    drawText(
      context,
      translateHud(locale, "routingConfigure"),
      308,
      246,
      15,
      COLOR.primary,
      "bold",
    );
    return;
  }

  if (routeState.status === "loading") {
    drawText(context, fixedHud(locale, "NAV // ROUTING"), 308, 82, 11, COLOR.secondary, "bold");
    drawText(context, translateHud(locale, "routingCalculating"), 308, 108, 24, COLOR.primary, "bold");
    drawText(context, translateHud(locale, "routingPreparing"), 308, 150, 14, COLOR.secondary, "bold");
    drawText(context, fixedHud(locale, "ORS // WORKING"), 308, 226, 10, COLOR.secondary, "bold");
    drawText(context, translateHud(locale, "routingWait"), 308, 246, 14, COLOR.primary, "bold");
    return;
  }

  const route = routeState.value;
  if (!route) {
    drawText(context, fixedHud(locale, "NAV // READY"), 308, 82, 11, COLOR.secondary, "bold");
    drawText(context, translateHud(locale, "destinationSelect"), 308, 108, 20, COLOR.primary, "bold");
    drawText(context, translateHud(locale, "destinationSearch"), 308, 150, 15, COLOR.secondary, "bold");
    drawText(context, fixedHud(locale, "PHONE // COMPANION"), 308, 226, 10, COLOR.secondary, "bold");
    drawText(context, translateHud(locale, "routingModes"), 308, 246, 13, COLOR.primary, "bold");
    return;
  }

  if (routeState.status === "stale") {
    const instruction = route.maneuvers[route.activeManeuverIndex]?.instruction;
    drawText(context, fixedHud(locale, "NAV // STALE"), 308, 82, 11, COLOR.secondary, "bold");
    drawText(context, translateHud(locale, "routingCheck"), 308, 108, 23, COLOR.primary, "bold");
    if (instruction) {
      drawText(
        context,
        truncateHudTitle(instruction, 22),
        308,
        154,
        15,
        COLOR.secondary,
        "bold",
      );
    }
    drawRouteDestination(context, route, locale);
    return;
  }

  const instruction = route.maneuvers[route.activeManeuverIndex]?.instruction
    ?? translateHud(locale, "arrived");
  drawText(context, fixedHud(locale, "NAV // ACTIVE"), 308, 82, 11, COLOR.secondary, "bold");
  drawText(
    context,
    formatRouteDistance(route.remainingDistance),
    308,
    104,
    28,
    COLOR.primary,
    "bold",
  );
  drawPath(context, [
    [330, 184],
    [330, 146],
    [408, 146],
  ], COLOR.secondary, 10);
  drawPath(context, [
    [330, 184],
    [330, 146],
    [408, 146],
  ], COLOR.primary, 4);
  drawPath(context, [
    [394, 132],
    [410, 146],
    [394, 160],
  ], COLOR.primary, 4);
  drawText(
    context,
    truncateHudTitle(instruction, 18),
    420,
    137,
    18,
    COLOR.primary,
    "bold",
  );
  drawRouteDestination(context, route, locale);
}
