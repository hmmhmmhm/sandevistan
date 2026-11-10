import {waitForEvenAppBridge} from "@evenrealities/even_hub_sdk";
import {createRoot} from "react-dom/client";
import {DEFAULT_PHONE_PREFERENCES} from "../../src/phone-preferences";
import {translatePhone} from "../../src/phone-i18n";
import {getReleaseCopy} from "../../src/release-i18n";
import "../../src/styles.css";
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const bridge=await waitForEvenAppBridge();
const memory=new Map<string,string>([["sandevistan:phone-preferences:v1",JSON.stringify({...DEFAULT_PHONE_PREFERENCES,locale:"ko"})]]);
bridge.getLocalStorage=async key=>memory.get(key)??"";bridge.setLocalStorage=async(key,value)=>{memory.set(key,value);return true;};
let microphoneOpenCalls=0,stage="initial",readyDrawn=false,setupDrawn=false;
const originalAudio=bridge.audioControl.bind(bridge);bridge.audioControl=async(open,...rest)=>{if(open){microphoneOpenCalls++;throw Error("Key setup must not open the microphone");}return originalAudio(open,...rest);};
const socketEvents:string[]=[];
const sockets:WebSocket[]=[],configured=new Set<WebSocket>(),closed=new Set<WebSocket>();
const NativeSocket=window.WebSocket;
class TrackedSocket extends NativeSocket {
 constructor(url:string|URL,protocols?:string|string[]){super(url,protocols);if(String(url).startsWith("wss://api.openai.com/")){sockets.push(this);this.addEventListener('close',()=>closed.add(this));this.addEventListener('message',event=>{try{const value=JSON.parse(String(event.data));if(socketEvents.length<40)socketEvents.push(String(value.type)+(value.error ? ":"+String(value.error.code??value.error.type??"unknown") : ""));if(value.type==="session.updated"||value.type==="transcription_session.updated")configured.add(this);}catch{}});}}
}
window.WebSocket=TrackedSocket;
const fill=CanvasRenderingContext2D.prototype.fillText;
CanvasRenderingContext2D.prototype.fillText=function(value,x,y,maxWidth){if(stage==='saving'&&value===getReleaseCopy('ko','holdWaiting'))readyDrawn=true;if(stage==='deleting'&&value===getReleaseCopy('ko','openAiSetupTitle'))setupDrawn=true;return maxWidth===undefined?fill.call(this,value,x,y):fill.call(this,value,x,y,maxWidth);};
history.replaceState(null,"","/hud-canvas-fast");const {App}=await import('../../src/App');const root=document.getElementById('root');if(!root)throw Error('No root');createRoot(root).render(<App/>);console.info('KEY_SETUP_PROFILE_READY');
async function waitFor(test:()=>boolean){const end=Date.now()+60000;while(!test()){if(Date.now()>end)throw Error('Key setup verification timed out');await delay(50);}}
async function capture(label:string){await delay(600);await fetch('/__release_key_capture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({label})});}
async function verify(){
 await waitFor(()=>Boolean(document.querySelector('.phone-home__grid')));
 const home=[...document.querySelectorAll<HTMLButtonElement>('.phone-home__grid button')].find(x=>x.textContent?.includes(translatePhone('ko','ai')));if(!home)throw Error('AI settings unavailable');home.click();
 await waitFor(()=>Boolean(document.querySelector('form.phone-panel input[type=password]')));
 const response=await fetch('/__release_authorized_key',{headers:{'x-sandevistan-key-test':'memory-only'}});const payload:unknown=await response.json();if(!payload||typeof payload!=='object'||!('key' in payload)||typeof payload.key!=='string')throw Error('Authorized key unavailable');
 const input=document.querySelector<HTMLInputElement>('form.phone-panel input[type=password]');if(!input)throw Error('Key input unavailable');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;if(!setter)throw Error('Input setter unavailable');
 stage='saving';setter.call(input,payload.key);input.dispatchEvent(new Event('input',{bubbles:true}));await delay(50);input.form?.requestSubmit();
 await waitFor(()=>configured.size>=2&&readyDrawn);await capture('ready-after-key-registration');
 const remove=[...document.querySelectorAll<HTMLButtonElement>('button')].find(x=>x.textContent?.trim()===translatePhone('ko','deleteKey'));if(!remove)throw Error('Delete key unavailable');stage='deleting';remove.click();
 await waitFor(()=>!memory.get('sandevistan:openai-key:v1')&&closed.size===sockets.length&&setupDrawn);await capture('setup-after-key-deletion');
 if(microphoneOpenCalls!==0)throw Error('Microphone unexpectedly opened');
 await fetch('/__release_key_result',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:true,configuredSockets:configured.size,closedSockets:closed.size,microphoneOpenCalls,readyAfterSave:readyDrawn,setupAfterDelete:setupDrawn,keyRemovedFromEphemeralStorage:!memory.get('sandevistan:openai-key:v1')})});
}
let started=false;setInterval(()=>{void(async()=>{const command=await fetch('/__release_key_command').then(r=>r.json());if(!command.run||started)return;started=true;await verify();})().catch(async error=>{if(started)await fetch('/__release_key_result',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:false,error:String(error),stage,keySaved:Boolean(memory.get('sandevistan:openai-key:v1')),socketCount:sockets.length,socketEvents,configuredSockets:configured.size,closedSockets:closed.size,microphoneOpenCalls})});});},200);
