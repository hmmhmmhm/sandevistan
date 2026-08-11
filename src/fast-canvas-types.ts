import type {
  CreateStartUpPageContainer,
  DeviceInfo,
  DeviceStatus,
  EvenHubEvent,
  ImageRawDataUpdate,
  OsEventTypeList,
  RebuildPageContainer,
  TextContainerUpgrade,
} from "@evenrealities/even_hub_sdk";
import type { encodeCanvasTiles, Tile } from "./g2-canvas";
import type { G2TileImageFormat } from "./g2-tile-format";
import type { G2TilePaletteMode } from "./g2-tile-palette";
import type { ImageSendConcurrency } from "./image-send-concurrency";
import type { G2DisplayHideStrategy } from "./g2-display-hide";
import type {
  NativeConversateContent,
  NativeConversateUpdatePriority,
} from "./native-conversate-text";

export type Bridge = {
  createStartUpPageContainer: (
    page: CreateStartUpPageContainer,
  ) => Promise<unknown>;
  getDeviceInfo?: () => Promise<DeviceInfo | null>;
  onDeviceStatusChanged?: (
    listener: (status: DeviceStatus) => void,
  ) => () => void;
  rebuildPageContainer: (page: RebuildPageContainer) => Promise<boolean>;
  textContainerUpgrade?: (update: TextContainerUpgrade) => Promise<boolean>;
  updateImageRawData: (update: ImageRawDataUpdate) => Promise<unknown>;
  onEvenHubEvent: (listener: (event: EvenHubEvent) => void) => () => void;
  shutDownPageContainer: (exitMode: number) => Promise<unknown>;
};

export type TransportDependencies = {
  waitForBridge: () => Promise<Bridge>;
  waitForPageReady?: (milliseconds: number) => Promise<void>;
  encode: typeof encodeCanvasTiles;
};

export type DisplayToggle = {
  readonly beforeRestore?: () => void | Promise<void>;
  readonly createHiddenSource: () => HTMLCanvasElement;
};

export type ExternalRefresh = {
  readonly beforeExternalRefresh?: () => void | Promise<void>;
  readonly getFullRefreshTiles?: () => readonly Tile[];
  readonly onRefreshReady?: (request: FastCanvasRefreshRequest) => void;
  readonly onNativeTextReady?: (
    controller: FastCanvasNativeTextController,
  ) => void;
  readonly targetTiles: Readonly<
    Record<FastCanvasRefreshTarget, readonly Tile[]>
  >;
};

export type PageDirection = "next" | "previous";
export type FastCanvasInput =
  | "tap"
  | "double-tap"
  | "scroll-next"
  | "scroll-previous";
export type FastCanvasInputResult = "unhandled" | "consume" | "redraw";

export type FastCanvasRawEvent = {
  readonly count: number;
  readonly hidden: boolean;
  readonly sysEventType?: OsEventTypeList;
  readonly textEventType?: OsEventTypeList;
  readonly eventSource?: number;
};

export type FastCanvasBattery = {
  readonly label: "G1" | "G2" | "R1";
  readonly level?: number;
  readonly charging?: boolean;
};

export type FastCanvasRefreshTarget =
  | "left"
  | "right"
  | "right-top"
  | "all";
export type FastCanvasRefreshRequest = (
  target: FastCanvasRefreshTarget,
) => void;

export type FastCanvasNativeTextController = {
  active(): boolean;
  enter(content: string): Promise<boolean>;
  update(content: string): Promise<boolean>;
  enterConversate?(content: NativeConversateContent): Promise<boolean>;
  updateConversate?(
    content: NativeConversateContent,
    priority?: NativeConversateUpdatePriority,
  ): Promise<boolean>;
  restore(): Promise<boolean>;
};

export type FastCanvasOptions = {
  readonly beforeExternalRefresh?: () => void | Promise<void>;
  readonly beforeRestore?: () => void | Promise<void>;
  readonly createHiddenSource?: () => HTMLCanvasElement;
  readonly dependencies?: TransportDependencies;
  readonly displayHideStrategy?: G2DisplayHideStrategy;
  readonly imageSendConcurrency?: ImageSendConcurrency;
  readonly getFullRefreshTiles?: () => readonly Tile[];
  readonly tileImageFormat?: G2TileImageFormat;
  readonly tilePaletteMode?: G2TilePaletteMode;
  readonly now?: () => number;
  readonly onBattery?: (
    battery: FastCanvasBattery | undefined,
  ) => void;
  readonly onDisplayCommitted?: (minute: number) => void;
  readonly onDisplayVisibilityChange?: (visible: boolean) => void;
  readonly onInput?: (
    input: FastCanvasInput,
  ) => FastCanvasInputResult | Promise<FastCanvasInputResult>;
  readonly onRawEvent?: (event: FastCanvasRawEvent) => void;
  readonly onNativeTextReady?: (
    controller: FastCanvasNativeTextController,
  ) => void;
  readonly onRefreshReady?: (request: FastCanvasRefreshRequest) => void;
};
