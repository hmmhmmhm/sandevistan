import {readFile,writeFile} from 'node:fs/promises';
const root='output/public-release-prep-2026-11-09/work';
const log=await readFile(root+'/api-rate-preview-upload.log','utf8');
const origin=log.match(/Version Preview URL: (https:\/\/[a-f0-9]+-sandevistan-api\.hmmhmmhm\.workers\.dev)/)?.[1];
if(!origin)throw Error('Expected immutable SANDEVISTAN preview URL missing');
const probes=[];let ok=false;const start=performance.now();
try{
 const health=await fetch(origin+'/api/health',{signal:AbortSignal.timeout(15000)});const state=await health.json();
 if(health.status!==200||state.service!=='sandevistan-api'||state.version!=='2026-11-09'||!state.ok)throw Error('Preview is not the expected API');
 for(let i=0;i<20;i++){
  const response=await fetch(origin+'/api/routing-status',{signal:AbortSignal.timeout(15000)});const text=await response.text();
  const row={status:response.status,colo:response.headers.get('cf-ray')?.split('-').at(-1),retryAfter:response.headers.get('retry-after')};probes.push(row);
  if(response.status===429){if(JSON.parse(text).error?.code!=='RATE_LIMITED'||row.retryAfter!=='60')throw Error('Unexpected limiter response');ok=true;break;}
  if(response.status!==200)throw Error('Unexpected preview HTTP '+response.status);
 }
 if(!ok)throw Error('No limiter response in bounded preview probes');
 console.log('Isolated preview returned Worker RATE_LIMITED429 with Retry-After60.');
}finally{
 await writeFile(root+'/api-rate-preview-result.json',JSON.stringify({origin,ok,configuredLimit:2,periodSeconds:60,productionLimitUnchanged:120,elapsedMs:Math.round(performance.now()-start),probes,scope:'Isolated preview namespace; production traffic not stress-tested; no claim of a strict global limit'},null,2)+'\n');
}
