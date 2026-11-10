import {createServer} from 'vite';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
const root='output/public-release-prep-2026-11-09';await mkdir(root,{recursive:true});
let simulator,server;
try{
 const receive={name:'release-design-artifacts',configureServer(vite){vite.middlewares.use('/__release_artifacts',async(req,res)=>{if(req.method!=='POST'){res.statusCode=405;res.end();return;}try{let text='';for await(const chunk of req){text+=chunk;if(text.length>6_000_000)throw Error('Too large');}const {name,png}=JSON.parse(text);if(!/^(?:icon-[123]|icon-options|setup-openai|setup-ors|root-menu)\.png$/.test(name)||!png.startsWith('data:image/png;base64,'))throw Error('Invalid artifact');await writeFile(path.join(root,name),Buffer.from(png.split(',')[1],'base64'));res.end('ok');}catch{res.statusCode=400;res.end('invalid');}});}};
 server=await createServer({plugins:[receive],server:{host:'127.0.0.1',port:4179,strictPort:true}});await server.listen();
 const binary=createRequire(import.meta.url).resolve(`@evenrealities/sim-${process.platform}-${process.arch}/bin/evenhub-simulator`);
 simulator=spawn(binary,['http://127.0.0.1:4179/tests/simulator/release-design-preview.html','--automation-port','9898'],{stdio:'ignore'});
 const delay=ms=>new Promise(r=>setTimeout(r,ms));
 for(let tries=0;tries<150;tries++){try{const log=await fetch('http://127.0.0.1:9898/api/console').then(r=>r.json());if(log.entries.some(e=>e.message==='RELEASE_DESIGN_READY'))break;}catch{}await delay(200);if(tries===149)throw Error('Preview did not start');}
 for(const [i,name] of ['setup-openai','setup-ors','root-menu'].entries()){
  if(i){await fetch('http://127.0.0.1:9898/api/input',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'click'})});await delay(1000);}
  const response=await fetch('http://127.0.0.1:9898/api/screenshot/glasses');await writeFile(`${root}/${name}-native.png`,Buffer.from(await response.arrayBuffer()));
 }
 const phone=await fetch('http://127.0.0.1:9898/api/screenshot/webview');await writeFile(`${root}/design-webview.png`,Buffer.from(await phone.arrayBuffer()));
 await writeFile(`${root}/design-console.json`,JSON.stringify(await fetch('http://127.0.0.1:9898/api/console').then(r=>r.json()),null,2));
 console.log('Design previews and original icon assets saved to '+root);
}finally{
 if(simulator&&simulator.exitCode===null){const closed=new Promise(r=>simulator.once('exit',r));simulator.kill('SIGTERM');await closed;}
 await server?.close();
}
