import {expect,it,vi} from "vitest";
import {createAiKeyLifecycle} from "./ai-key-lifecycle";
import type {FastHudViewMode} from "./fast-hud-view";
function setup(){
 let key:string|undefined='old',mode:FastHudViewMode='ai';let release=()=>{};
 const closing=new Promise<void>(resolve=>{release=resolve;});
 const ai={stop:vi.fn(()=>closing),start:vi.fn(async()=>true)},conversate={stop:vi.fn(async()=>{}),start:vi.fn(async()=>true)},onError=vi.fn();
 const lifecycle=createAiKeyLifecycle({getKey:()=>key,getMode:()=>mode,ai,conversate,onError});
 return {ai,conversate,lifecycle,onError,release,setKey:(value:string|undefined)=>{key=value;},setMode:(value:FastHudViewMode)=>{mode=value;}};
}
it('stops both old owners before activating the selected mode with a replacement key',async()=>{
 const x=setup();x.setKey('new');x.lifecycle.changed();expect(x.ai.stop).toHaveBeenCalledOnce();expect(x.conversate.stop).toHaveBeenCalledOnce();expect(x.ai.start).not.toHaveBeenCalled();x.release();await vi.waitFor(()=>expect(x.ai.start).toHaveBeenCalledOnce());
});
it('reconciles deletion through the selected owner to show its missing-key state',async()=>{
 const x=setup();x.setMode('conversate');x.setKey(undefined);x.lifecycle.changed();x.release();await vi.waitFor(()=>expect(x.conversate.start).toHaveBeenCalledOnce());expect(x.ai.start).not.toHaveBeenCalled();
});
it('does not reopen capture after the user leaves or the controller is disposed',async()=>{
 const x=setup();x.setKey('new');x.lifecycle.changed();x.setMode('dashboard');x.release();await Promise.resolve();await Promise.resolve();expect(x.ai.start).not.toHaveBeenCalled();
 const y=setup();y.setKey('new');y.lifecycle.changed();y.lifecycle.dispose();y.release();await Promise.resolve();await Promise.resolve();expect(y.ai.start).not.toHaveBeenCalled();
});
it('handles rapid key changes once and reports failed stops without restarting',async()=>{
 const x=setup();x.ai.stop.mockImplementationOnce(()=>new Promise<void>(resolve=>{x.release=resolve;}));x.ai.stop.mockResolvedValueOnce(undefined);x.setKey('second');x.lifecycle.changed();x.setKey('third');x.lifecycle.changed();await new Promise(resolve=>setTimeout(resolve,0));expect(x.ai.start).not.toHaveBeenCalled();x.release();await vi.waitFor(()=>expect(x.ai.start).toHaveBeenCalledOnce());
 const y=setup();y.ai.stop.mockRejectedValueOnce(Error('mic stop failed'));y.setKey('new');y.lifecycle.changed();await vi.waitFor(()=>expect(y.onError).toHaveBeenCalledOnce());expect(y.ai.start).not.toHaveBeenCalled();
});
it('starts an already selected mode when runtimes become ready, leaving the dashboard idle',()=>{
 const x=setup();x.lifecycle.ready();expect(x.ai.start).toHaveBeenCalledOnce();const y=setup();y.setMode('dashboard');y.lifecycle.ready();expect(y.ai.start).not.toHaveBeenCalled();expect(y.conversate.start).not.toHaveBeenCalled();
});
