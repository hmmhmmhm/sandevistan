import {createInterface} from 'node:readline';
import {createServer} from 'vite';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const reader=createInterface({input:process.stdin});let key;for await(const line of reader){key=line.trim();break;}reader.close();process.stdin.pause();if(!key)throw Error('Authorized credential required');
const root='output/public-release-prep-2026-11-09/key-setup-live';await mkdir(root,{recursive:true});let server,simulator,run=false,used=false,result;const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
 const middleware={name:'key-setup-verifier',configureServer(vite){vite.middlewares.use(async(req,res,next)=>{
  if(req.url==='/__release_key_command'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({run}));return;}
  if(req.url==='/__release_authorized_key'){if(used||req.headers['x-sandevistan-key-test']!=='memory-only'||req.headers.origin&&req.headers.origin!=='http://127.0.0.1:4179'){res.statusCode=403;res.end();return;}used=true;res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.end(JSON.stringify({key}));return;}
  if(!['/__release_key_capture','/__release_key_result'].includes(req.url)){next();return;}
  try{let body='';for await(const chunk of req){body+=chunk;if(body.length>100000)throw Error('Too large');}const value=JSON.parse(body);
   if(req.url==='/__release_key_result'){result=value;await writeFile(root+'/result.json',JSON.stringify(value,null,2).split(key).join('[REDACTED]'));}
   else {if(!/^[a-z-]+$/.test(value.label))throw Error('Invalid capture');const response=await fetch('http://127.0.0.1:9898/api/screenshot/glasses');await writeFile(root+'/'+value.label+'.png',Buffer.from(await response.arrayBuffer()));}
   res.end('ok');
  }catch{res.statusCode=400;res.end('invalid');}
 });}};
 server=await createServer({plugins:[middleware],server:{host:'127.0.0.1',port:4179,strictPort:true}});await server.listen();
 const binary=createRequire(import.meta.url).resolve(`@evenrealities/sim-${process.platform}-${process.arch}/bin/evenhub-simulator`);simulator=spawn(binary,['http://127.0.0.1:4179/tests/simulator/key-setup-live.html','--automation-port','9898'],{stdio:'ignore'});
 for(let tries=0;tries<150;tries++){try{const log=await fetch('http://127.0.0.1:9898/api/console').then(r=>r.json());if(log.entries.some(x=>x.message==='KEY_SETUP_PROFILE_READY'))break;}catch{}await delay(200);if(tries===149)throw Error('App did not start');}
 await delay(6000);for(const action of ['down','down','down','down','click']){await fetch('http://127.0.0.1:9898/api/input',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});await delay(650);}run=true;
 const deadline=Date.now()+90000;while(!result&&Date.now()<deadline)await delay(200);if(!result)throw Error('Verification timed out');
 await writeFile(root+'/console.json',JSON.stringify(await fetch('http://127.0.0.1:9898/api/console').then(r=>r.json()),null,2).split(key).join('[REDACTED]'));
 console.log(JSON.stringify(result));if(!result.ok)process.exitCode=1;
}finally{
 key=undefined;if(simulator&&simulator.exitCode===null){const closed=new Promise(resolve=>simulator.once('exit',resolve));simulator.kill('SIGTERM');await closed;}await server?.close();
}
