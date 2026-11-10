import { waitForEvenAppBridge } from "@evenrealities/even_hub_sdk";
import { createRoot } from "react-dom/client";
import { DEFAULT_PHONE_PREFERENCES } from "../../src/phone-preferences";
import { translatePhone } from "../../src/phone-i18n";
import "../../src/styles.css";
async function main() {
const bridge=await waitForEvenAppBridge();
const storage=new Map<string,string>([["sandevistan:phone-preferences:v1",JSON.stringify({...DEFAULT_PHONE_PREFERENCES,locale:"ko"})]]);
bridge.getLocalStorage=async key=>storage.get(key)??"";
bridge.setLocalStorage=async(key,value)=>{storage.set(key,value);return true;};
const realExit=bridge.shutDownPageContainer.bind(bridge);
bridge.shutDownPageContainer=async mode=>{console.info("RELEASE_SYSTEM_EXIT "+mode);return realExit(mode);};
history.replaceState(null,"","/hud-canvas-fast");
const {App}=await import("../../src/App");
const root=document.getElementById("root");if(!root)throw Error("Missing root");createRoot(root).render(<App/>);
console.info("RELEASE_PROFILE keyless-in-memory; locale=ko; telemetry=simulator");
let lastCommand=0;
setInterval(()=>{void(async()=>{
 const command=await fetch('/__release_command').then(r=>r.json());if(!command.id||command.id===lastCommand)return;lastCommand=command.id;
 if(command.action==='back')document.querySelector<HTMLButtonElement>('.phone-detail-header__breadcrumb')?.click();
 else if(command.action==='dark')document.querySelector<HTMLButtonElement>('[data-theme-option="dark"]')?.click();
 else {
  const label=translatePhone('ko',command.action==='ai'?'ai':command.action==='navigation'?'navigation':'conversate');
  const button=[...document.querySelectorAll<HTMLButtonElement>('.phone-home__grid button')].find(x=>x.textContent?.includes(label));
  if(!button)throw Error('Phone target unavailable '+label);button.click();
 }
 console.info('RELEASE_COMMAND '+command.id);
})().catch(error=>console.error(String(error)));},200);

}
void main().catch(error => console.error(String(error)));
