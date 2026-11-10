export function createRealtimeConfigurationGate<T>() {
  const acknowledged = new Set<T>();
  const listeners = new Set<() => void>();
  return {
    acknowledge(socket: T) { acknowledged.add(socket); for (const notify of listeners) notify(); },
    wait(sockets: readonly T[], signal: AbortSignal) {
      return new Promise<void>((resolve, reject) => {
        const finish = (error?: Error) => {
          clearTimeout(timer); signal.removeEventListener("abort", cancel); listeners.delete(check);
          if (error) reject(error); else resolve();
        };
        const cancel = () => finish(new Error("Transcription configuration cancelled"));
        const check = () => { if (sockets.every(socket => acknowledged.has(socket))) finish(); };
        const timer = setTimeout(() => finish(new Error("Transcription configuration timed out")), 10_000);
        listeners.add(check); signal.addEventListener("abort", cancel, { once: true });
        if (signal.aborted) cancel(); else check();
      });
    },
  };
}
