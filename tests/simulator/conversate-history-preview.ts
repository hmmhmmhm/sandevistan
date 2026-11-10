import { drawFastCanvasOpenFrame as frame, drawFastCanvasText as text, FAST_CANVAS_COLOR as C } from "../../src/fast-canvas-style";
import { drawAiDetailHeader } from "../../src/fast-ai-detail-style";
import { drawFastAiDetail } from "../../src/fast-ai-detail";
import { createAiHudSnapshot } from "../../src/ai-hud-state";
for (const id of ["live", "directory", "ask"]) {
  const canvas = document.getElementById(id);
  if (!(canvas instanceof HTMLCanvasElement)) continue;
  const ctx = canvas.getContext("2d"); if (!ctx) continue;
  ctx.fillStyle = "black"; ctx.fillRect(0, 0, 576, 288);
  if (id === "ask") { drawFastAiDetail(ctx, { ...createAiHudSnapshot(true), phase: "listening", captureState: "waiting" }, 0, "ko"); continue; }
  drawAiDetailHeader(ctx, "Conversate", "● 03:24 · 20:45");
  frame(ctx, 12, 34, 552, 92, C.dim);
  text(ctx, "Inform · 7초 후 숨김", 24, 39, 10, C.secondary, "bold");
  ["순매출 유지율 110%는 기존 고객의 매출이", "확장·축소·이탈을 반영한 뒤 10% 증가했다는 뜻입니다."].forEach((s,i)=>text(ctx,s,24,55+i*18,15,C.primary,"bold"));
  text(ctx,"대화 · 최신 · 스크롤로 한 줄씩 이전 보기",16,129,9,C.secondary,"bold");
  ["회의는 다음 주 목요일 오전 10시로 하겠습니다.","→ The meeting is next Thursday at 10 a.m.","예산안은 수요일 저녁까지 보내 주세요.","→ Please send the budget by Wednesday evening."].forEach((s,i)=>text(ctx,s,24,143+i*18,s.startsWith("→")?16:17,s.startsWith("→")?C.secondary:C.primary,"bold"));
  frame(ctx,12,220,552,60,C.dim);
  if (id === "live") {
    text(ctx,"Copilot · 1/3 · 9초 후 숨김 · 클릭: 기록",24,225,10,C.secondary,"bold");
    text(ctx,"That works. I’ll send the budget by Wednesday.",24,241,16,C.primary,"bold");
    text(ctx,"좋습니다. 수요일까지 예산안을 보내겠습니다.",24,264,12,C.secondary,"bold");
  } else {
    text(ctx,"기록 2/8 · 스크롤: 선택 · 클릭: 열기",24,225,10,C.secondary,"bold");
    text(ctx,"> Inform  20:43  순매출 유지율 110%",24,242,15,C.primary,"bold");
    text(ctx,"  Copilot 20:42  회의 일정에 답하기",24,263,12,C.secondary,"bold");
  }
}
const selected = new URL(location.href).searchParams.get("mode");
if (selected) {
  for (const item of document.querySelectorAll("h2,canvas")) {
    if (item instanceof HTMLElement) item.style.display = item.id === selected ? "block" : "none";
  }
}
