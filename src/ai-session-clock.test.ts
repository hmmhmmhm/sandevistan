import { expect, it, vi } from "vitest";
import { createRecordingClock, recordingClockLabel } from "./ai-session-clock";

it("counts microphone session time independently of wall-clock adjustments and cleans up ticks", () => {
  vi.useFakeTimers();
  let elapsed = 1000; const tick = vi.fn();
  const clock = createRecordingClock(tick, () => elapsed);
  try {
    expect(clock.get()).toBeUndefined(); clock.start(); elapsed += 204000;
    expect(recordingClockLabel(clock.get(), new Date(2026, 10, 8, 14, 32))).toBe("● 03:24 · 14:32");
    vi.advanceTimersByTime(1000); expect(tick).toHaveBeenCalledTimes(1);
    clock.stop(); elapsed += 3000; expect(clock.get()?.seconds).toBe(204);
    vi.advanceTimersByTime(2000); expect(tick).toHaveBeenCalledTimes(1);
    clock.reset(); expect(clock.get()).toBeUndefined(); clock.start(); expect(clock.get()?.seconds).toBe(0);
  } finally { clock.reset(); vi.useRealTimers(); }
});
it("formats an hour without wrapping and leaves connecting duration unset", () => {
  const now = new Date(2026, 10, 8, 9, 5);
  expect(recordingClockLabel({ seconds: 3661 }, now)).toBe("● 01:01:01 · 09:05");
  expect(recordingClockLabel(undefined, now)).toBe("--:-- · 09:05");
});
it("accumulates held recording time while the local clock keeps refreshing between holds", () => {
  vi.useFakeTimers(); let elapsed = 0; const tick = vi.fn(), clock = createRecordingClock(tick, () => elapsed);
  try {
    clock.watch(); vi.advanceTimersByTime(1000); expect(tick).toHaveBeenCalledTimes(1); expect(clock.get()).toBeUndefined();
    clock.resume(); elapsed = 2000; clock.pause(); elapsed = 10000;
    expect(clock.get()?.seconds).toBe(2); vi.advanceTimersByTime(1000); expect(tick).toHaveBeenCalledTimes(2);
    clock.resume(); elapsed = 13000; expect(clock.get()?.seconds).toBe(5);
  } finally { clock.reset(); vi.useRealTimers(); }
});
