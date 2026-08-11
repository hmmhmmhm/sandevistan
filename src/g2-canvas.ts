import {
  CreateStartUpPageContainer,
  ImageContainerProperty,
  TextContainerProperty,
} from "@evenrealities/even_hub_sdk";
import { HYBRID_TEXT_CONSOLE } from "./hybrid-hud";
import {
  rgbaToMonochromeMask,
  type G2TileImageFormat,
} from "./g2-tile-format";
import {
  quantizeHudFourLevelPixels,
  type G2TilePaletteMode,
} from "./g2-tile-palette";

export type CanvasFactory = () => HTMLCanvasElement;
export type ImageLoader = (url: string) => Promise<CanvasImageSource>;
export type Tile = {
  readonly id: number;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly sourceX?: number;
  readonly sourceY?: number;
};
export type CanvasTileEncodingOptions = {
  readonly format?: G2TileImageFormat;
  readonly paletteMode?: G2TilePaletteMode;
};
type ZOrderedContainer = {
  zOrderIndex?: number;
};
type EventLayerGeometry = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

const FULLSCREEN_EVENT_LAYER: EventLayerGeometry = {
  x: 0,
  y: 0,
  width: 576,
  height: 288,
};

export const G2_TILES = [
  { id: 2, name: "sandevistanTL", x: 0, y: 0, width: 288, height: 144 },
  { id: 3, name: "sandevistanTR", x: 288, y: 0, width: 288, height: 144 },
  { id: 4, name: "sandevistanBL", x: 0, y: 144, width: 288, height: 144 },
  { id: 5, name: "sandevistanBR", x: 288, y: 144, width: 288, height: 144 },
] as const;
export const G2_FAST_TILES = [
  G2_TILES[1],
  G2_TILES[3],
  G2_TILES[0],
  G2_TILES[2],
] as const;
export const G2_TEXT_FIRST_TILES = [
  G2_TILES[0],
  G2_TILES[1],
  G2_TILES[2],
  G2_TILES[3],
] as const;
export const G2_LEFT_TILES = [G2_TILES[0], G2_TILES[2]] as const;
export const G2_RIGHT_TILES = [G2_TILES[1], G2_TILES[3]] as const;
export const G2_RIGHT_TOP_TILES = [G2_TILES[1]] as const;

export const DIAGNOSTIC_TILES = [
  {
    id: 2,
    name: "frame",
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    sourceX: 0,
    sourceY: 0,
  },
] as const;

async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}

export function createBlackCanvas(
  canvasFactory: CanvasFactory = () => document.createElement("canvas"),
) {
  const canvas = canvasFactory();
  canvas.width = 576;
  canvas.height = 288;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("검정 Canvas를 만들 수 없습니다.");
  context.fillStyle = "#000000";
  context.fillRect(0, 0, 576, 288);
  return canvas;
}

export function quantizeForG2Pixels(source: Uint8ClampedArray) {
  const output = new Uint8ClampedArray(source.length);
  for (let index = 0; index < source.length; index += 4) {
    const red = source[index];
    const green = source[index + 1];
    const blue = source[index + 2];
    const isHudSignal = green >= 24 && green - Math.max(red, blue) >= 5;
    const level = isHudSignal
      ? Math.max(17, Math.min(255, Math.round(green / 17) * 17))
      : 0;
    output[index] = level;
    output[index + 1] = level;
    output[index + 2] = level;
    output[index + 3] = 255;
  }
  return output;
}

export async function drawHudReference(
  canvas: HTMLCanvasElement,
  sourceUrl: string,
  imageLoader: ImageLoader = loadImage,
) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D Canvas를 사용할 수 없습니다.");

  canvas.width = 576;
  canvas.height = 288;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#000";
  context.fillRect(0, 0, 576, 288);
  context.drawImage(await imageLoader(sourceUrl), 0, 0, 576, 288);
  const frame = context.getImageData(0, 0, 576, 288);
  frame.data.set(quantizeForG2Pixels(frame.data));
  context.putImageData(frame, 0, 0);
}

export function createContainerObjects(
  tiles: readonly Tile[],
  eventPadding = 0,
  explicitZOrder = false,
  geometry: EventLayerGeometry = FULLSCREEN_EVENT_LAYER,
) {
  const eventLayer = new TextContainerProperty({
    xPosition: geometry.x,
    yPosition: geometry.y,
    width: geometry.width,
    height: geometry.height,
    borderWidth: 0,
    borderColor: 0,
    paddingLength: eventPadding,
    containerID: 1,
    containerName: "eventLayer",
    content: " ",
    isEventCapture: 1,
  });
  const imageObject = tiles.map((tile) => new ImageContainerProperty({
    xPosition: tile.x,
    yPosition: tile.y,
    width: tile.width,
    height: tile.height,
    containerID: tile.id,
    containerName: tile.name,
  }));
  if (explicitZOrder) {
    imageObject.forEach((image, index) => {
      (image as ImageContainerProperty & ZOrderedContainer).zOrderIndex =
        index + 1;
    });
    (eventLayer as TextContainerProperty & ZOrderedContainer).zOrderIndex =
      imageObject.length + 1;
  }
  return { eventLayer, imageObject };
}

export function createLayeredContainerObjects(tiles: readonly Tile[]) {
  return createContainerObjects(
    tiles,
    HYBRID_TEXT_CONSOLE.padding,
    true,
    HYBRID_TEXT_CONSOLE,
  );
}

export function createGlassesPage(
  tiles: readonly Tile[] = G2_TILES,
  eventPadding = 0,
) {
  const { eventLayer, imageObject } = createContainerObjects(
    tiles,
    eventPadding,
  );
  return new CreateStartUpPageContainer({
    containerTotalNum: tiles.length + 1,
    textObject: [eventLayer],
    imageObject,
  });
}

export function createLayeredGlassesPage(
  tiles: readonly Tile[] = G2_TILES,
) {
  const { eventLayer, imageObject } = createLayeredContainerObjects(tiles);
  return new CreateStartUpPageContainer({
    containerTotalNum: tiles.length + 1,
    textObject: [eventLayer],
    imageObject,
  });
}

export function createOfficialDiagnosticPage() {
  const eventLayer = new TextContainerProperty({
    xPosition: 0,
    yPosition: 0,
    width: 576,
    height: 288,
    borderWidth: 0,
    borderColor: 0,
    paddingLength: 0,
    containerID: 1,
    containerName: "eventLayer",
    content: " ",
    isEventCapture: 1,
  });
  const status = new TextContainerProperty({
    xPosition: 0,
    yPosition: 220,
    width: 576,
    height: 40,
    borderWidth: 0,
    borderColor: 5,
    paddingLength: 4,
    containerID: 2,
    containerName: "status",
    content: "Loading...",
    isEventCapture: 0,
  });
  const image = new ImageContainerProperty({
    xPosition: 188,
    yPosition: 40,
    width: 200,
    height: 100,
    containerID: 3,
    containerName: "frame",
  });
  return new CreateStartUpPageContainer({
    containerTotalNum: 3,
    textObject: [eventLayer, status],
    imageObject: [image],
  });
}

export async function encodeCanvasTiles(
  source: HTMLCanvasElement,
  canvasFactory: CanvasFactory = () => document.createElement("canvas"),
  tiles: readonly Tile[] = G2_TILES,
  options: CanvasTileEncodingOptions = {},
) {
  return Promise.all(tiles.map(async (tile) => {
    const canvas = canvasFactory();
    canvas.width = tile.width;
    canvas.height = tile.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("타일 Canvas를 만들 수 없습니다.");
    context.drawImage(
      source,
      tile.sourceX ?? tile.x,
      tile.sourceY ?? tile.y,
      tile.width,
      tile.height,
      0,
      0,
      tile.width,
      tile.height,
    );
    const format = options.format ?? "png";
    let image: ImageData | undefined;
    if (options.paletteMode === "hud-4" || format === "bmp-1") {
      image = context.getImageData(0, 0, tile.width, tile.height);
    }
    if (options.paletteMode === "hud-4" && image) {
      image.data.set(quantizeHudFourLevelPixels(image.data));
      if (format === "png") context.putImageData(image, 0, 0);
    }
    if (format === "bmp-1" && image) {
      return encode1BitBmp(
        tile.width,
        tile.height,
        rgbaToMonochromeMask(image.data),
      );
    }
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => value
          ? resolve(value)
          : reject(new Error("PNG 인코딩에 실패했습니다.")),
        "image/png",
      );
    });
    return new Uint8Array(await blob.arrayBuffer());
  }));
}

export async function sendTilesSequentially(
  tiles: Uint8Array[],
  send: (bytes: Uint8Array, index: number) => Promise<void>,
) {
  for (let index = 0; index < tiles.length; index += 1) {
    await send(tiles[index], index);
  }
}

export function encode1BitBmp(
  width: number,
  height: number,
  pixels: Uint8Array,
) {
  const rowBytes = Math.ceil(width / 8);
  const stride = (rowBytes + 3) & ~3;
  const pixelOffset = 62;
  const bmp = new Uint8Array(pixelOffset + stride * height);
  const view = new DataView(bmp.buffer);
  bmp.set([0x42, 0x4d]);
  view.setUint32(2, bmp.byteLength, true);
  view.setUint32(10, pixelOffset, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 1, true);
  view.setUint32(34, stride * height, true);
  view.setUint32(46, 2, true);
  view.setUint32(50, 2, true);
  bmp.set([255, 255, 255, 0], 58);

  for (let y = 0; y < height; y += 1) {
    const destination = pixelOffset + (height - 1 - y) * stride;
    for (let x = 0; x < width; x += 1) {
      if (pixels[y * width + x]) {
        bmp[destination + Math.floor(x / 8)] |= 1 << (7 - (x % 8));
      }
    }
  }
  return bmp;
}
