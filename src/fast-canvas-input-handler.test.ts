import { expect, it, vi } from "vitest";
import type { FastCanvasInput } from "./fast-canvas-types";
import { createFastCanvasInputHandler } from "./fast-canvas-input-handler";
it("delivers both hold edges during an image send and paints only the latest state when idle", async () => {
  let busy = true;
  const input = vi.fn((_input: FastCanvasInput) => "redraw" as const), refresh = vi.fn(async () => {});
  const run = vi.fn((_label: string, action: () => void | Promise<void>) => { if (busy) return; return Promise.resolve(action()); });
  const handler = createFastCanvasInputHandler({ disposed: () => false, hidden: () => false, busy: () => busy,
    run, input, refresh, toggle: async () => {}, log: () => {} });
  handler.handle("hold-start"); handler.handle("hold-end");
  expect(input.mock.calls.map(c => c[0])).toEqual(["hold-start", "hold-end"]);
  await Promise.resolve(); expect(refresh).not.toHaveBeenCalled();
  busy = false; handler.onIdle(); await Promise.resolve(); expect(refresh).toHaveBeenCalledTimes(1);
});
it("preserves every approved conversation scroll step during image transmission",async()=>{
 let busy=true,line=20;const refresh=vi.fn(async()=>{});
 const handler=createFastCanvasInputHandler({disposed:()=>false,hidden:()=>false,busy:()=>busy,
   bypassBusy:input=>input==="scroll-previous"||input==="scroll-next",
   input:input=>{if(input==="scroll-previous")line--;else if(input==="scroll-next")line++;return "redraw";},
   run:(_label,action)=>busy?undefined:Promise.resolve(action()),refresh,toggle:async()=>{},log:()=>{} });
 for(let i=0;i<9;i++)handler.handle("scroll-previous");
 expect(line).toBe(11);await Promise.resolve();expect(refresh).not.toHaveBeenCalled();
 busy=false;handler.onIdle();await Promise.resolve();expect(refresh).toHaveBeenCalledTimes(1);
});

it("paints the dashboard before requesting system exit, and keeps hide separate", async () => {
 const calls:string[]=[];let result:"exit"|"hide"="exit";
 const handler=createFastCanvasInputHandler({disposed:()=>false,hidden:()=>false,busy:()=>false,
  run:async(_label,action)=>{await action();}, input:()=>result,
  refresh:async()=>{calls.push("refresh");},exit:async()=>{calls.push("system-exit");},
  toggle:async()=>{calls.push("hide");},log:()=>{} });
 handler.handle("tap");await vi.waitFor(()=>expect(calls).toEqual(["refresh","system-exit"]));
 result="hide";handler.handle("tap");await vi.waitFor(()=>expect(calls).toEqual(["refresh","system-exit","hide"]));
});

it("requests system exit even when the dashboard repaint fails", async()=>{
 const exit=vi.fn(async()=>{});
 const handler=createFastCanvasInputHandler({disposed:()=>false,hidden:()=>false,busy:()=>false,
  run:async(_label,action)=>{await action();},input:()=>"exit",refresh:async()=>{throw Error("image transfer failed");},exit,toggle:async()=>{},log:()=>{} });
 handler.handle("tap");await vi.waitFor(()=>expect(exit).toHaveBeenCalledTimes(1));
});
