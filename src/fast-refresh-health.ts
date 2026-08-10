import { logDiagnostic } from "./diagnostic-log";

export function createFastRefreshHealth() {
  let attempts = 0;
  let failures = 0;
  let consecutiveFailures = 0;
  let degraded = false;

  return {
    degraded: () => degraded,
    async run(action: () => Promise<void>) {
      attempts += 1;
      try {
        await action();
        consecutiveFailures = 0;
        if (degraded) {
          degraded = false;
          logDiagnostic("REFRESH", "transport recovered");
        }
      } catch (error) {
        failures += 1;
        consecutiveFailures += 1;
        if (!degraded && consecutiveFailures >= 3) {
          degraded = true;
          logDiagnostic(
            "ERROR",
            `transport degraded · ${consecutiveFailures} consecutive failures`,
          );
        }
        throw error;
      } finally {
        if (attempts % 10 === 0) {
          logDiagnostic(
            "REFRESH",
            `transport summary · refresh ${attempts} · failures ${failures}`,
          );
        }
      }
    },
  };
}
