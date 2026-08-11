import type { MutableRefObject, RefObject } from "react";
import type { FastCanvasBattery } from "./glasses";
import type { createLiveDashboardSession } from "./live-dashboard";
import type { EvenStorage } from "./live-cache";
import type { LiveDashboardState, XHudPost } from "./live-state";
import type { PhonePreferences, SensorStatus } from "./phone-types";
import type { RoutingStatus } from "./routing";
import type { G2TilePaletteMode } from "./g2-tile-palette";
import type { G2TileImageFormat } from "./g2-tile-format";
import type { ImageSendConcurrency } from "./image-send-concurrency";
import type { G2DisplayHideStrategy } from "./g2-display-hide";
import type { AiHudSnapshot } from "./ai-hud-state";
import type { ConversateSettings, ConversateSnapshot } from "./conversate-state";

export type HudControllerModes = {
  readonly calibration: boolean;
  readonly canvas: boolean;
  readonly diagnostic: boolean;
  readonly fastCanvas: boolean;
  readonly hardwareBmp: boolean;
  readonly hybrid: boolean;
  readonly layeredHybrid: boolean;
  readonly legacyCanvas: boolean;
};

type LiveSession = ReturnType<typeof createLiveDashboardSession>;

export type UseHudControllerOptions = {
  readonly autoStart: boolean;
  readonly canvasRef: RefObject<HTMLCanvasElement | null>;
  readonly liveSessionRef: MutableRefObject<LiveSession | undefined>;
  readonly xHudPostsRef: MutableRefObject<readonly XHudPost[]>;
  readonly phonePreferencesRef: MutableRefObject<PhonePreferences>;
  readonly displayRefreshRef: MutableRefObject<(() => void) | undefined>;
  readonly companionOrsKeyRef: MutableRefObject<string | undefined>;
  readonly companionOpenAiKeyRef: MutableRefObject<string | undefined>;
  readonly companionSonioxKeyRef: MutableRefObject<string | undefined>;
  readonly aiSnapshotRef: MutableRefObject<AiHudSnapshot>;
  readonly conversateSettingsRef: MutableRefObject<ConversateSettings>;
  readonly conversateSnapshotRef: MutableRefObject<ConversateSnapshot>;
  readonly displayHideStrategy: G2DisplayHideStrategy;
  readonly imageSendConcurrency: ImageSendConcurrency;
  readonly tileImageFormat: G2TileImageFormat;
  readonly tilePaletteMode: G2TilePaletteMode;
  readonly modes: HudControllerModes;
  readonly setStatus: (value: string) => void;
  readonly setRoutingStatus: (value: RoutingStatus) => void;
  readonly setCompanionRoute: (value: LiveDashboardState["route"]) => void;
  readonly setCompanionLive: (value: LiveDashboardState) => void;
  readonly setCompanionBattery: (
    value: FastCanvasBattery | undefined,
  ) => void;
  readonly setCompanionStorage: (value: EvenStorage) => void;
  readonly setPhonePreferences: (value: PhonePreferences) => void;
  readonly setCompanionAiSnapshot: (value: AiHudSnapshot) => void;
  readonly setConversateSnapshot: (value: ConversateSnapshot) => void;
  readonly setCompanionDisplayVisible: (value: boolean) => void;
  readonly setCompanionSensors: (value: SensorStatus) => void;
};
