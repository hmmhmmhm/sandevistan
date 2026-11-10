import { getReleaseCopy as t } from "./release-i18n";
import type { PhoneLocale } from "./phone-types";
import { drawAiDetailHeader, aiDetailLines } from "./fast-ai-detail-style";
import { drawFastCanvasText as text, drawFastCanvasOpenFrame as frame, FAST_CANVAS_COLOR as C } from "./fast-canvas-style";
import { translatePhone } from "./phone-i18n";
export function drawKeySetup(context: CanvasRenderingContext2D, locale: PhoneLocale, provider: "openai" | "ors", title?: string) {
  const ai = provider === "openai";
  drawAiDetailHeader(context, title ?? translatePhone(locale, ai ? "ai" : "navigation"), t(locale,"setupStatus"));
  aiDetailLines(context,t(locale,ai ? "openAiSetupTitle" : "orsSetupTitle"),26,528,2).forEach((line,i)=>text(context,line,24,45+i*27,26,C.primary,"bold"));
  frame(context,12,103,552,162);
  aiDetailLines(context,t(locale,"openPhoneApp"),18,528,2).forEach((line,i)=>text(context,line,24,108+i*20,18,C.primary,"bold"));
  aiDetailLines(context,t(locale,ai ? "openAiSetupPath" : "orsSetupPath"),18,528,2).forEach((line,i)=>text(context,line,24,153+i*20,18,C.primary,"bold"));
  aiDetailLines(context,t(locale,ai ? "openAiSetupHint" : "orsSetupHint"),14,528,2).forEach((line,i)=>text(context,line,24,195+i*15,14,C.secondary,"bold"));
  aiDetailLines(context,t(locale,ai ? "paidApiNotice" : "orsOptionalNotice"),13,528,2).forEach((line,i)=>text(context,line,24,232+i*14,13,C.secondary,"bold"));
  text(context,t(locale,"backHint"),16,275,11,C.secondary,"bold");
}
export function drawQuickMenu(context: CanvasRenderingContext2D, locale: PhoneLocale, selected: number) {
  context.fillStyle=C.background;context.fillRect(0,0,576,288);
  drawAiDetailHeader(context,t(locale,"quickMenu"),t(locale,"menuHint"));
  const keys=["hideDisplay","exitApp","returnToApp"] as const;
  keys.forEach((key,i)=>{context.fillStyle=i===selected?"#333":"#111";context.fillRect(16,50+i*57,544,48);frame(context,16,50+i*57,544,48,i===selected?C.primary:C.dim);text(context,`${i===selected ? "> " : ""}${t(locale,key)}`,36,61+i*57,22,C.primary,"bold");});
  aiDetailLines(context,t(locale,"systemExitHint"),13,528,2).forEach((line,i)=>text(context,line,24,235+i*14,13,C.secondary,"bold"));
  text(context,t(locale,"backHint"),16,274,11,C.secondary,"bold");
}
