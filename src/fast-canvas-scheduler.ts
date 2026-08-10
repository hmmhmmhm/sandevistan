import { diagnosticDuration, diagnosticError, diagnosticNow } from "./diagnostic-timing";
import { logDiagnostic } from "./diagnostic-log";
import type { FastCanvasRefreshTarget } from "./fast-canvas-types";

type Operation = {
  readonly label: string;
  readonly run: () => void | Promise<void>;
};

const mergeTargets = (
  current: FastCanvasRefreshTarget | undefined,
  next: FastCanvasRefreshTarget,
): FastCanvasRefreshTarget => {
  if (!current || current === next) return next;
  if (
    (current === "right" && next === "right-top")
    || (current === "right-top" && next === "right")
  ) return "right";
  return "all";
};

export function createFastCanvasScheduler(options: {
  readonly externalDropReason: () => string | undefined;
  readonly onError: (message: string) => void;
  readonly performExternal: (target: FastCanvasRefreshTarget) => Promise<void>;
}) {
  let busy = false;
  let disposed = false;
  const pendingInputs: Operation[] = [];
  let pendingExternal: FastCanvasRefreshTarget | undefined;

  const start = (operation: Operation) => {
    if (disposed) return;
    busy = true;
    const startedAt = diagnosticNow();
    logDiagnostic("REFRESH", `${operation.label} accepted`);
    void (async () => operation.run())()
      .catch((error: unknown) => {
        const message = diagnosticError(error);
        logDiagnostic(
          "ERROR",
          `${operation.label} failed · ${message}`,
          diagnosticDuration(startedAt),
        );
        options.onError(message);
      })
      .finally(() => {
        busy = false;
        logDiagnostic(
          "REFRESH",
          `${operation.label} complete`,
          diagnosticDuration(startedAt),
        );
        drain();
      });
  };

  const enqueueExternal = (target: FastCanvasRefreshTarget) => {
    const reason = options.externalDropReason();
    if (reason) {
      logDiagnostic("REFRESH", `external ${target} dropped · ${reason}`);
      return;
    }
    if (busy) {
      pendingExternal = mergeTargets(pendingExternal, target);
      logDiagnostic(
        "REFRESH",
        `external ${target} coalesced · pending ${pendingExternal}`,
      );
      return;
    }
    start({
      label: `external ${target}`,
      run: () => options.performExternal(target),
    });
  };

  const drain = () => {
    if (busy || disposed) return;
    const input = pendingInputs.shift();
    if (input) {
      start(input);
      return;
    }
    if (pendingExternal) {
      const target = pendingExternal;
      pendingExternal = undefined;
      enqueueExternal(target);
    }
  };

  return {
    enqueueExternal,
    enqueueInput(operation: Operation) {
      if (disposed) return;
      if (busy) {
        pendingInputs.push(operation);
        logDiagnostic("REFRESH", `${operation.label} queued · busy`);
        return;
      }
      start(operation);
    },
    dispose() {
      disposed = true;
      pendingInputs.length = 0;
      pendingExternal = undefined;
    },
  };
}
