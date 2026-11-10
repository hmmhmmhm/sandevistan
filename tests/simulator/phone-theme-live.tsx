import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { PhoneCompanion } from "../../src/phone/PhoneCompanion";
import { DEFAULT_PHONE_PREFERENCES } from "../../src/phone-preferences";
import { createInitialLiveDashboardState } from "../../src/live-state";
import type { FastCanvasBattery } from "../../src/glasses";
import type { EvenStorage } from "../../src/live-cache";
const storage: EvenStorage = { getLocalStorage: async key => localStorage.getItem(key) ?? (key.endsWith("phone-theme:v1") ? '"dark"' : ""), setLocalStorage: async (key,value) => { localStorage.setItem(key,value); return true; } };
function Hud() {
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{const img=new Image();img.onload=()=>ref.current?.getContext("2d")?.drawImage(img,0,0);img.src="/output/ask-ai-hold-exit-2026-11-08/exit-dashboard-canvas.png";},[]);
 return <div className="hud-frame"><canvas ref={ref} width="576" height="288"/></div>;
}
function Verify() {
 const [preferences,setPreferences]=useState({...DEFAULT_PHONE_PREFERENCES,locale:"ko" as const});
 const [battery,setBattery]=useState<FastCanvasBattery|undefined>({label:"G2",level:88,charging:false});
 return <><div style={{background:"#111",color:"white",padding:8,font:"10px system-ui"}}>검증용 예시 데이터 · 실제 기기 값 아님 <button onClick={()=>setBattery({label:"R1",level:64,charging:true})}>R1 예시</button><button onClick={()=>setBattery(undefined)}>정보 없음</button></div>
 <PhoneCompanion canvas={<Hud/>} status="Ready" battery={battery} live={createInitialLiveDashboardState()} routingStatus={{enabled:false}} preferences={preferences} storage={storage} onPreferencesChange={next=>setPreferences({...next,locale:"ko"})} onTodosChange={()=>{}} onWeatherRefresh={async()=>"accepted"} routeControls={<div/>}/></>;
}
createRoot(document.getElementById("root")!).render(<Verify/>);
