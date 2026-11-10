import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
const origin='https://sandevistan-api.hmmhmmhm.workers.dev';
const output=process.argv.find(value=>value.startsWith('--report='))?.slice(9)??'output/public-release-prep-2026-11-09/work/api-after-refresh.json';
const rows=[];let failed=false,server;
const rateLimitRequested=process.argv.includes('--check-rate-limit');
async function request(path,options={}){
 let response;
 for(let attempt=0;attempt<2;attempt++){
  response=await fetch(origin+path,{...options,redirect:'manual',signal:AbortSignal.timeout(20000)});
  if(![502,504].includes(response.status)||attempt===1)return response;
  await response.arrayBuffer();
 }
 return response;
}
async function check(name,run){
 try{const details=await run();rows.push({name,ok:true,...details});console.log(name+' passed');}
 catch(error){failed=true;rows.push({name,ok:false,error:error.message});console.log(name+' failed: '+error.message);}
}
function require(condition,message){if(!condition)throw Error(message);}
try{
 server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom'});
 const {parseMapResponse}=await server.ssrLoadModule('/src/map.ts');
 await check('health',async()=>{const r=await request('/api/health');const value=await r.json();require(r.status===200&&value.ok===true&&value.version==='2026-11-09','Wrong health version or status');require(r.headers.get('access-control-allow-origin')==='*','Missing CORS');return{status:r.status,version:value.version};});
 await check('privacy',async()=>{const r=await request('/privacy');const text=await r.text();require(r.status===200&&text.includes('arasaka')&&text.includes('hmmhmhmmhmhmm@gmail.com'),'Missing updated public policy');require(r.headers.get('content-security-policy')?.includes("default-src 'none'"),'Missing privacy CSP');return{status:r.status,bytes:text.length};});
 await check('replacement-news',async()=>{const r=await request('/api/news?feed=ohmynews-latest');const text=await r.text();require(r.status===200&&/<(?:rss|feed)[\s>]/i.test(text),'Replacement RSS unavailable');return{status:r.status,bytes:text.length};});
 for(const [city,coordinate] of [['new-york',[40.758,-73.9855]],['london',[51.5098,-0.1337]]]){
  await check(city+'-map',async()=>{const r=await request(`/api/map?lat=${coordinate[0]}&lng=${coordinate[1]}`);require(r.status===200,'Map HTTP '+r.status);const map=parseMapResponse(await r.json());require(map.roads.length>0&&map.labels.length>0,'Empty map');return{status:r.status,roads:map.roads.length,labels:map.labels.length,validatedBy:'production client parseMapResponse'};});
 }
 await check('cors-preflight',async()=>{const r=await request('/api/route',{method:'OPTIONS',headers:{Origin:'https://example.com','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type,x-sandevistan-ors-key'}});require(r.status===204&&r.headers.get('access-control-allow-origin')==='*','Preflight failed');require(r.headers.get('access-control-allow-headers')?.includes('x-sandevistan-ors-key'),'Missing routing key header');return{status:r.status};});
 await check('optional-routing-without-key',async()=>{const r=await request('/api/routing-status');const status=await r.json();require(r.status===200&&typeof status.enabled==='boolean','Invalid routing status');if(status.enabled)return{status:r.status,serverKeyConfigured:true,upstreamRouteVerified:false};const search=await request('/api/geocode?q=Seoul');const body=await search.json();require(search.status===503&&body.error?.code==='ROUTING_DISABLED','Missing-key routing guard failed');return{status:r.status,serverKeyConfigured:false,missingKeyStatus:search.status,upstreamRouteVerified:false};});
 if(rateLimitRequested&&!failed){
  await check('native-rate-limit',async()=>{let limited=false,calls=0,retryAfter;const colos=new Set();for(;calls<150;calls++){const r=await request('/api/routing-status');const ray=r.headers.get('cf-ray');if(ray)colos.add(ray.split('-').at(-1));const body=await r.text();if(r.status===429){require(JSON.parse(body).error?.code==='RATE_LIMITED','429 was not the Worker limiter');limited=true;retryAfter=r.headers.get('retry-after');calls++;break;}require(r.status===200,'Unexpected rate probe status '+r.status);}require(limited&&retryAfter==='60','No expected 429 within bounded probes');return{calls,status:429,retryAfter,colos:[...colos],scope:'Approximate per-IP per-edge limiter; not a global budget'};});
 }
}catch(error){
 failed=true;rows.push({name:'verification-setup',ok:false,error:error.message});console.log('Verification setup failed: '+error.message);
}finally{
 if(!rows.some(row=>row.name==='native-rate-limit'))rows.push({name:'native-rate-limit',ok:null,skipped:true,reason:rateLimitRequested?'Earlier check failed':'Not requested'});
 try{await server?.close();}catch(error){failed=true;rows.push({name:'verification-cleanup',ok:false,error:error.message});}
 await mkdir('output/public-release-prep-2026-11-09/work',{recursive:true});await writeFile(output,JSON.stringify({capturedAt:new Date().toISOString(),origin,ok:!failed,rateLimitRequested,rateLimitVerified:rows.some(row=>row.name==='native-rate-limit'&&row.ok===true),checks:rows},null,2)+'\n');
}
if(failed)process.exitCode=1;
