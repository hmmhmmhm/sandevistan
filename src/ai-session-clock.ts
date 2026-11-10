export type RecordingTime = { readonly seconds: number; readonly active?: boolean };

export function recordingClockLabel(recording: RecordingTime | undefined, now = new Date()) {
  const local = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  if (!recording) return `--:-- · ${local}`;
  const seconds = Math.max(0, Math.floor(recording.seconds));
  const minutes = Math.floor(seconds / 60);
  const elapsed = minutes >= 60
    ? `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return `${recording.active === false ? "○" : "●"} ${elapsed} · ${local}`;
}

export function createRecordingClock(tick: () => void, now = () => performance.now()) {
  let started: number | undefined, frozen: RecordingTime | undefined;
  let accumulated = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  const get = (): RecordingTime | undefined => started === undefined ? frozen : { seconds: accumulated + Math.max(0, (now() - started) / 1000), active: true };
  const pause = () => { const value = get(); frozen = value ? { seconds: value.seconds, active: false } : undefined; started = undefined; };
  const stop = () => { pause(); clearInterval(timer); timer = undefined; };
  const watch = () => { timer ??= setInterval(tick, 1_000); };
  return {
    get, stop, pause, watch,
    resume() { if (started !== undefined) return; accumulated = frozen?.seconds ?? 0; started = now(); watch(); },
    reset() { stop(); frozen = undefined; },
    start() { stop(); frozen = undefined; accumulated = 0; started = now(); watch(); },
  };
}
