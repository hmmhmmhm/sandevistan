import type { FastCanvasInput, FastCanvasInputResult } from "./fast-canvas-types";

type Operation = (label: string, action: () => void | Promise<void>) => Promise<void> | undefined;

export function createFastCanvasInputHandler(options: {
  readonly disposed: () => boolean;
  readonly hidden: () => boolean;
  readonly busy: () => boolean;
  readonly run: Operation;
  readonly bypassBusy?: (input: FastCanvasInput) => boolean;
  readonly input?: (input: FastCanvasInput) => FastCanvasInputResult | Promise<FastCanvasInputResult>;
  readonly refresh: () => Promise<void>;
  readonly toggle: () => Promise<void>;
  readonly exit?: () => Promise<void>;
  readonly log: (message: string) => void;
}) {
  let inputNeedsRedraw = false;
  const onIdle = () => {
    if (!inputNeedsRedraw || options.busy() || options.disposed() || options.hidden()) return;
    inputNeedsRedraw = false;
    void options.run("detail exit redraw", options.refresh);
  };
  return {
    onIdle,
    handle(input: FastCanvasInput, fallback?: () => void | Promise<void>) {
      if (options.disposed() || (options.hidden() && input !== "double-tap")) return;
      // Apply capture and exit immediately; repaint the latest state after the active image send.
      if (options.busy() && !options.hidden() && (input === "double-tap" || input === "hold-start" || input === "hold-end" || options.bypassBusy?.(input)) && options.input) {
        void Promise.resolve(options.input(input)).then(result => {
          if (result === "redraw") { inputNeedsRedraw = true; onIdle(); }
        }).catch(() => options.log("urgent input failed"));
        return;
      }
      void options.run(`input ${input}`, async () => {
        if (options.disposed()) return;
        if (options.hidden()) { if (input === "double-tap") await options.toggle(); return; }
        const result = await options.input?.(input) ?? "unhandled";
        options.log(`${input} result · ${result}`);
        if (options.disposed()) return;
        if (result === "redraw") await options.refresh();
        else if (result === "hide") await options.toggle();
        else if (result === "exit") {
          try { await options.refresh(); } catch { options.log("exit repaint failed"); }
          await options.exit?.();
        }
        else if (result === "unhandled") await fallback?.();
      });
    },
  };
}
