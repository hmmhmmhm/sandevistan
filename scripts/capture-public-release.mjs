import {build,createServer} from 'vite';
import {spawn,execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const root='output/public-release-prep-2026-11-09/actual';await mkdir(root,{recursive:true});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let server,simulator,fixtureRoot,command={id:0};
async function input(action){await fetch('http://127.0.0.1:9898/api/input',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});await delay(650);}
async function capture(name,kind='glasses'){const response=await fetch('http://127.0.0.1:9898/api/screenshot/'+kind);if(!response.ok)throw Error('Screenshot failed');const bytes=Buffer.from(await response.arrayBuffer());await writeFile(`${root}/${name}.png`,bytes);
if(kind==='glasses')execFileSync('python3',['-c',`from PIL import Image
from pathlib import Path
p=Path(${JSON.stringify(root)})/(${JSON.stringify(name)}+'.png')
im=Image.open(p).convert('RGBA');p.rename(p.with_name(p.stem+'-raw.png'));bg=Image.new('RGBA',im.size,'black');bg.alpha_composite(im);bg.convert('RGB').save(p)`]);}
try{
 fixtureRoot=await mkdtemp(join(tmpdir(),'sandevistan-release-capture-'));
 await build({mode:'evenhub',build:{outDir:fixtureRoot,emptyOutDir:true,rollupOptions:{input:'tests/simulator/public-release.html'}}});
 server=await createServer({configFile:false,root:fixtureRoot,publicDir:false,plugins:[{name:'release-control',configureServer(vite){vite.middlewares.use('/__release_command',(_req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(command));});}}],server:{host:'127.0.0.1',port:4179,strictPort:true}});await server.listen();
 const binary=createRequire(import.meta.url).resolve(`@evenrealities/sim-${process.platform}-${process.arch}/bin/evenhub-simulator`);
 simulator=spawn(binary,['http://127.0.0.1:4179/tests/simulator/public-release.html','--automation-port','9898'],{stdio:'ignore'});
 for(let tries=0;tries<150;tries++){try{const log=await fetch('http://127.0.0.1:9898/api/console').then(r=>r.json());if(log.entries.some(e=>e.message.includes('RELEASE_PROFILE')))break;}catch{}await delay(200);if(tries===149)throw Error('App did not start');}
 await delay(6000);await capture('overview');await capture('phone-home','webview');
 await input('double_click');await capture('quick-menu-return');await input('up');await capture('quick-menu-exit');
 await input('up');await input('click');await capture('hidden');await input('double_click');await capture('restored');
 for(let i=0;i<4;i++)await input('down');await input('click');await capture('ask-ai-key-setup');await input('double_click');
 await input('down');await input('click');await delay(1000);await capture('conversate-key-setup');await input('double_click');
 for(const action of ['ai','back','navigation','back','conversate','back']){
  command={id:command.id+1,action};await delay(1100);if(action!=='back')await capture('phone-'+action+'-setup','webview');
 }
 await input('double_click');await input('up');await input('click');await delay(700);
 const consoleLog=await fetch('http://127.0.0.1:9898/api/console').then(r=>r.json());await writeFile(root+'/console.json',JSON.stringify(consoleLog,null,2));
 if(!consoleLog.entries.some(e=>e.message==='RELEASE_SYSTEM_EXIT 1'))throw Error('System exit not invoked');
 console.log('Actual app captures and system exit invocation verified; system dialog/hardware cancellation require physical verification.');
}finally{
 if(simulator&&simulator.exitCode===null){const closed=new Promise(r=>simulator.once('exit',r));simulator.kill('SIGTERM');await closed;}
 await server?.close();
 if(fixtureRoot)await rm(fixtureRoot,{recursive:true,force:true});
}
