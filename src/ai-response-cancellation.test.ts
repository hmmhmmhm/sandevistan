import { expect,it } from "vitest";
import { createAiResponseCancellation } from "./ai-response-cancellation";
it("recognizes only a no-active-response error for its own cancel request",()=>{
 const sent: unknown[]=[]; const cancel=createAiResponseCancellation(e=>sent.push(e));
 cancel.cancel("r1");const event=sent[0];
 if (!event || typeof event!=="object" || !("event_id" in event)) throw Error("Missing cancel event");
 expect(cancel.consumeExpectedError({type:"error",error:{code:"response_cancel_not_active",event_id:"unrelated"}})).toBe(false);
 expect(cancel.consumeExpectedError({type:"error",error:{code:"invalid_request",event_id:event.event_id}})).toBe(false);
 expect(cancel.consumeExpectedError({type:"error",error:{code:"response_cancel_not_active",event_id:event.event_id}})).toBe(true);
 expect(cancel.consumeExpectedError({type:"error",error:{code:"response_cancel_not_active",event_id:event.event_id}})).toBe(false);
});
