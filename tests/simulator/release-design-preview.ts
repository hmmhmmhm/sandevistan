import {waitForEvenAppBridge} from "@evenrealities/even_hub_sdk";
import {transmitFastCanvas} from "../../src/glasses";
import {encodeCanvasTiles} from "../../src/g2-canvas";
import {drawFastCanvasText as text,drawFastCanvasOpenFrame as frame,FAST_CANVAS_COLOR as C} from "../../src/fast-canvas-style";
import {drawAiDetailHeader} from "../../src/fast-ai-detail-style";
const paths=[
 '<path fill="white" d="M368 128H208L128 208V256H304V304H128V384H288L368 304V208H192V192H368Z"/>',
 '<path fill="none" stroke="white" stroke-width="24" d="M192 112H112V192M320 112H400V192M112 320V400H192M400 320V400H320"/><path fill="white" d="M192 232H320V256H192ZM224 280H288V304H224Z"/>',
 '<path fill="white" d="M128 144H336L384 192H176ZM128 232H296L344 280H176ZM128 320H256L304 368H176Z"/>',
];
const icons=document.querySelector<HTMLCanvasElement>("#icons"),canvas=document.querySelector<HTMLCanvasElement>("#hud");
if(!icons||!canvas)throw Error("Missing canvases");
const context=canvas.getContext("2d"),sheet=icons.getContext("2d");if(!context||!sheet)throw Error("Missing contexts");
async function save(name:string,source:HTMLCanvasElement){await fetch('/__release_artifacts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,png:source.toDataURL('image/png')})});}
sheet.fillStyle='#181818';sheet.fillRect(0,0,1152,480);
for(let index=0;index<paths.length;index++){
 const image=new Image();image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'+paths[index]+'</svg>');await image.decode();
 const asset=document.createElement('canvas');asset.width=asset.height=512;asset.getContext('2d')?.drawImage(image,0,0,512,512);await save(`icon-${index+1}.png`,asset);
 sheet.fillStyle='black';sheet.fillRect(index*384+48,32,288,288);sheet.drawImage(image,index*384+48,32,288,288);
 sheet.fillStyle='white';sheet.font='bold 20px system-ui';sheet.fillText(`${index+1}. ${['S 모노그램','주변 시야','신호 흐름'][index]}`,index*384+48,368);
 sheet.font='13px system-ui';sheet.fillStyle='#aaa';sheet.fillText(['기능을 묶는 간결한 S','비워 둔 중심과 HUD 모서리','빠르게 이어지는 정보'][index],index*384+48,399);
}
await save('icon-options.png',icons);
let index=0;const names=['setup-openai','setup-ors','root-menu'];
function draw(){
 if(!context||!canvas)return;context.fillStyle='black';context.fillRect(0,0,576,288);
 if(index<2){
  const ai=index===0;drawAiDetailHeader(context,ai?'AI에게 묻기':'길찾기','키 미등록');
  text(context,ai?'AI 기능 설정이 필요합니다':'길찾기 키가 필요합니다',24,49,26,C.primary,'bold');
  frame(context,12,93,552,148);
  text(context,'휴대폰의 SANDEVISTAN 웹앱을 여세요.',24,108,18,C.primary,'bold');
  text(context,ai?'AI에게 묻기 → 키 발급·등록':'길찾기 → 키 발급·등록',24,141,18,C.primary,'bold');
  text(context,ai?'OpenAI 계정에서 키를 발급한 뒤 등록해 주세요.':'OpenRouteService에서 키를 발급해 등록하세요.',24,184,14,C.secondary,'bold');
  text(context,ai?'사용 요금은 본인의 OpenAI 계정에 청구됩니다.':'지도와 날씨는 별도 길찾기 키 없이 사용할 수 있습니다.',24,211,13,C.secondary,'bold');
  text(context,'두 번 탭 // 뒤로',16,268,12,C.secondary,'bold');
 }else{
  drawAiDetailHeader(context,'빠른 메뉴','스크롤: 선택 · 클릭: 실행');
  ['화면 숨기기','앱 종료','돌아가기'].forEach((label,i)=>{context.fillStyle=i===2?'#333':'#111';context.fillRect(16,50+i*57,544,48);frame(context,16,50+i*57,544,48,i===2?C.primary:C.dim);text(context,label,36,61+i*57,22,C.primary,'bold');});
  text(context,'앱 종료를 선택하면 시스템 확인창이 열립니다.',24,237,13,C.secondary,'bold');text(context,'두 번 탭 // 돌아가기',16,268,12,C.secondary,'bold');
 }
 void save(names[index]+'.png',canvas);console.info('RELEASE_DESIGN_CASE '+names[index]);
}
draw();const bridge=await waitForEvenAppBridge();
await transmitFastCanvas(canvas,()=>{},async()=>{},{dependencies:{waitForBridge:async()=>bridge,encode:encodeCanvasTiles},imageSendConcurrency:4,tilePaletteMode:'hud-4',beforeExternalRefresh:draw,onInput:()=>{index=(index+1)%names.length;draw();return 'redraw';}});
console.info('RELEASE_DESIGN_READY');
