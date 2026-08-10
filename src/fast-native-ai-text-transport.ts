import {
  createBlankDisplayPage,
  createImageDisplayPage,
} from "./g2-display-hide";
import type { Tile } from "./g2-canvas";
import { diagnosticDuration, diagnosticNow } from "./diagnostic-timing";
import { logDiagnostic } from "./diagnostic-log";
import type {
  Bridge,
  FastCanvasNativeTextController,
} from "./fast-canvas-types";
import { createNativeAiTextModeController } from "./native-ai-text";
import { createNativeConversateMode } from "./native-conversate-text";

export type DisposableNativeTextController = FastCanvasNativeTextController & {
  dispose(): void;
};

export const NATIVE_AI_NEUTRAL_PAGE_SETTLE_MS = 1_000;
export const NATIVE_AI_IMAGE_PAGE_SETTLE_MS = 200;

export function createFastNativeAiTextController(options: {
  readonly bridge: Bridge;
  readonly tiles: readonly Tile[];
  readonly waitForImagePageReady?: (milliseconds: number) => Promise<void>;
  readonly invalidateImages: () => void;
  readonly restoreImages: () => Promise<void>;
  readonly onFailure: (operation: string) => void;
}): DisposableNativeTextController | undefined {
  const updateText = options.bridge.textContainerUpgrade;
  if (!updateText) return undefined;
  const mode = createNativeAiTextModeController({
    bridge: {
      rebuildPageContainer: options.bridge.rebuildPageContainer.bind(
        options.bridge,
      ),
      textContainerUpgrade: updateText.bind(options.bridge),
    },
    createImagePage: () => createImageDisplayPage(options.tiles),
    onFailure: options.onFailure,
  });
  const conversate = createNativeConversateMode({
    bridge: {
      rebuildPageContainer: options.bridge.rebuildPageContainer.bind(options.bridge),
      textContainerUpgrade: updateText.bind(options.bridge),
    },
    createImagePage: () => createImageDisplayPage(options.tiles),
  });
  let restoringImages = false;
  const waitForImagePageReady = options.waitForImagePageReady
    ?? ((milliseconds: number) => new Promise<void>((resolve) => {
      setTimeout(resolve, milliseconds);
    }));
  const trace = async (
    operation: string,
    action: () => Promise<boolean>,
  ) => {
    const startedAt = diagnosticNow();
    logDiagnostic("REFRESH", `${operation} start`);
    const succeeded = await action();
    logDiagnostic(
      "REFRESH",
      `${operation} ${succeeded ? "success" : "dropped"}`,
      diagnosticDuration(startedAt),
    );
    return succeeded;
  };
  return {
    active: () => mode.active() || conversate.active(),
    async enter(content) {
      if (restoringImages || conversate.active()) return false;
      const entered = await trace("native AI enter", () => mode.enter(content));
      if (entered) options.invalidateImages();
      return entered;
    },
    update: (content) => restoringImages
      ? Promise.resolve(false)
      : trace("native AI update", () => mode.update(content)),
    async enterConversate(content) {
      if (restoringImages || mode.active()) return false;
      const entered = await trace(
        "native Conversate enter",
        () => conversate.enter(content),
      );
      if (entered) options.invalidateImages();
      return entered;
    },
    updateConversate: (content, priority) => restoringImages
      ? Promise.resolve(false)
      : trace(
          "native Conversate update",
          () => conversate.update(content, priority),
        ),
    async restore() {
      if ((!mode.active() && !conversate.active()) || restoringImages) return false;
      restoringImages = true;
      try {
        if (conversate.active()) {
          const left = await trace("native Conversate leave", conversate.leave);
          if (!left) return false;
          await waitForImagePageReady(NATIVE_AI_IMAGE_PAGE_SETTLE_MS);
          logDiagnostic(
            "REFRESH",
            `native AI image page ready · ${NATIVE_AI_IMAGE_PAGE_SETTLE_MS}ms`,
          );
          options.invalidateImages();
          await options.restoreImages();
          return true;
        }
        const neutralized = await trace("native AI neutralize", async () => {
          try {
            const rebuilt = await options.bridge.rebuildPageContainer(
              createBlankDisplayPage(),
            );
            if (!rebuilt) options.onFailure("neutralize");
            return rebuilt;
          } catch {
            options.onFailure("neutralize");
            return false;
          }
        });
        if (!neutralized) return false;
        await waitForImagePageReady(NATIVE_AI_NEUTRAL_PAGE_SETTLE_MS);
        logDiagnostic(
          "REFRESH",
          `native AI neutral page ready · ${NATIVE_AI_NEUTRAL_PAGE_SETTLE_MS}ms`,
        );
        const left = await trace(
          "native AI leave",
          mode.leave,
        );
        if (!left) return false;
        await waitForImagePageReady(NATIVE_AI_IMAGE_PAGE_SETTLE_MS);
        logDiagnostic(
          "REFRESH",
          `native AI image page ready · ${NATIVE_AI_IMAGE_PAGE_SETTLE_MS}ms`,
        );
        options.invalidateImages();
        await options.restoreImages();
        return true;
      } finally {
        restoringImages = false;
      }
    },
    dispose() {
      mode.dispose();
      conversate.dispose();
    },
  };
}
