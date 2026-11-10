import { fixedHud } from "./fixed-hud-i18n";
import { translatePhone } from "./phone-i18n";
import type { PhoneLocale } from "./phone-types";
import {
  drawFastCanvasText as drawText,
  FAST_CANVAS_COLOR as COLOR,
} from "./fast-canvas-style";

export function drawFullscreenMapHeader(
  context: CanvasRenderingContext2D,
  source: string,
  layer: string,
  radiusMeters: number,
  locale: PhoneLocale = "en",
) {
  context.fillStyle = COLOR.background;
  context.fillRect(0, 0, 576, 31);
  context.fillStyle = COLOR.dim;
  context.fillRect(0, 30, 576, 1);
  drawText(
    context,
    `${translatePhone(locale, "location")} // ${source} · ${layer}`,
    14,
    8,
    12,
    COLOR.primary,
    "bold",
  );
  drawText(
    context,
    `Z // ${radiusMeters}m`,
    444,
    8,
    12,
    COLOR.secondary,
    "bold",
  );
}

export function drawFullscreenMapFooter(
  context: CanvasRenderingContext2D,
  tileSource?: "openmaptiles",
  locale: PhoneLocale = "en",
) {
  context.fillStyle = COLOR.background;
  context.fillRect(0, 254, 576, 34);
  context.fillStyle = COLOR.dim;
  context.fillRect(0, 253, 576, 1);
  drawText(
    context,
    tileSource === "openmaptiles" ? "© OPENMAPTILES · © OSM CONTRIBUTORS" : "© OSM CONTRIBUTORS",
    14,
    264,
    9,
    COLOR.secondary,
    "bold",
  );
  drawText(
    context,
    fixedHud(locale, "DOUBLE TAP // BACK"),
    400,
    264,
    9,
    COLOR.primary,
    "bold",
  );
}
