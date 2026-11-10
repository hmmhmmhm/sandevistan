import {build} from 'vite';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {createWriteStream} from 'node:fs';
import {createRequire} from 'node:module';
import {mkdir,writeFile,mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,extname} from 'node:path';
const root='output/store-hud-english-2026-11-09';await mkdir(root+'/renders',{recursive:true});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let server,simulator,fixtureRoot;const requests=[];
const names=['london-overview','london-news','new-york-overview','new-york-news'];
try{
 fixtureRoot=await mkdtemp(join(tmpdir(),'sandevistan-store-hud-'));
 await build({mode:'evenhub',build:{outDir:fixtureRoot,emptyOutDir:true,rollupOptions:{input:'tests/simulator/store-hud-preview.html'}}});
 server=createServer(async(req,res)=>{try{
  const pathname=new URL(req.url,'http://127.0.0.1').pathname;requests.push(pathname);
  if(pathname==='/__store_artifact'&&req.method==='POST'){
   let body='';for await(const chunk of req){body+=chunk;if(body.length>2_000_000)throw Error('Too large');}
   const payload=JSON.parse(body);if(!names.includes(payload.name)||!payload.png?.startsWith('data:image/png;base64,'))throw Error('Invalid artifact');
   await writeFile(`${root}/renders/${payload.name}-canvas.png`,Buffer.from(payload.png.split(',')[1],'base64'));
   const {png,...record}=payload;await writeFile(`${root}/renders/${payload.name}.json`,JSON.stringify(record,null,2));res.end('ok');return;
  }
  const dataFile=pathname.startsWith('/__store_data/')?pathname.slice('/__store_data/'.length):undefined;
  if(dataFile&&!/^[a-z-]+\.(?:json|xml)$/.test(dataFile))throw Error('Invalid source');
  const path=dataFile?resolve(root,'data',dataFile):resolve(fixtureRoot,'.'+pathname);
  if(!dataFile&&!path.startsWith(resolve(fixtureRoot)+'/'))throw Error('Invalid path');
  const bytes=await readFile(path);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.xml':'application/xml','.png':'image/png'})[extname(path)]??'application/octet-stream');res.end(bytes);
 }catch{res.statusCode=404;res.end('Unavailable');}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(4179,'127.0.0.1',resolve);});
 const binary=createRequire(import.meta.url).resolve(`@evenrealities/sim-${process.platform}-${process.arch}/bin/evenhub-simulator`);
 simulator=spawn(binary,['http://127.0.0.1:4179/tests/simulator/store-hud-preview.html','--automation-port','9898'],{stdio:['ignore','pipe','pipe']});
 const nativeLog=createWriteStream(root+'/native-process.log');simulator.stdout.pipe(nativeLog);simulator.stderr.pipe(nativeLog);
 for(let tries=0;tries<150;tries++){try{const log=await fetch('http://127.0.0.1:9898/api/console').then(r=>r.json());if(log.entries.some(e=>e.message==='STORE_HUD_READY'))break;}catch{}await delay(200);if(tries===149)throw Error('Store HUD did not start');}
 for(const [index,name] of names.entries()){
  if(index)await fetch('http://127.0.0.1:9898/api/input',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'click'})});
  await delay(1200);
  const response=await fetch('http://127.0.0.1:9898/api/screenshot/glasses');if(!response.ok)throw Error('Native screenshot failed');
  await writeFile(`${root}/renders/${name}-native-raw.png`,Buffer.from(await response.arrayBuffer()));
 }
 const log=await fetch('http://127.0.0.1:9898/api/console').then(r=>r.json());await writeFile(root+'/console.json',JSON.stringify(log,null,2));
 if(log.entries.some(e=>e.level==='error'))throw Error('Simulator console error');
 console.log('Rendered all four English native HUD cases.');
}finally{
 await writeFile(root+'/requests.json',JSON.stringify(requests,null,2));
 try{const log=await fetch('http://127.0.0.1:9898/api/console').then(r=>r.json());await writeFile(root+'/console.json',JSON.stringify(log,null,2));}catch{}
 if(simulator&&simulator.exitCode===null){const closed=new Promise(r=>simulator.once('exit',r));simulator.kill('SIGTERM');await closed;}
 if(server)await new Promise(resolve=>server.close(resolve));
 if(fixtureRoot)await rm(fixtureRoot,{recursive:true,force:true});
}
