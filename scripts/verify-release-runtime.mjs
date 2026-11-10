import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {root,translationSources,validateTranslationSource} from './release-translation-source.mjs';
const {jobs}=await translationSources();
const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom'});
try{
 const registry=await server.ssrLoadModule('/src/i18n/locale-registry.ts');
 const hud=await server.ssrLoadModule('/src/ai-hud-i18n.ts');
 const ai=await server.ssrLoadModule('/src/ai-i18n.ts');
 const conv=await server.ssrLoadModule('/src/conversate-i18n.ts');
 const mcp=await server.ssrLoadModule('/src/mcp-i18n.ts');
 const release=await server.ssrLoadModule('/src/release-i18n.ts');
 const at=(value,key)=>key.split('.').reduce((node,part)=>node?.[part],value);
 const lookup={locale:(locale,key)=>at(registry.LOCALE_REGISTRY[locale],key),hud:hud.translateAiHud,aiPhone:ai.translateAiPhone,conversate:conv.translateConversate,mcp:mcp.translateMcpPhone,approval:(locale,key)=>hud.translateAiApproval(locale)[key],release:release.getReleaseCopy};
 const files=(await readdir(root+'/translations')).filter(x=>x.endsWith('.json'));let checked=0,locales=0;
 for(const file of files){
  const row=JSON.parse(await readFile(root+'/translations/'+file,'utf8'));if(process.argv.includes('--partial')&&row.source!==JSON.stringify(jobs.get(row.locale)))continue;validateTranslationSource(row,jobs,file);locales++;
  for(const {id,text} of row.entries){const split=id.indexOf('.'),group=id.slice(0,split),key=id.slice(split+1);if(!lookup[group]||lookup[group](row.locale,key)!==text)throw Error('Runtime translation mismatch '+row.locale+'/'+id);checked++;}
 }
 const result={locales,entries:checked,allExpectedLocales:locales===jobs.size,scope:'Audited dictionary candidates and release copy; not proof of every rendered UI string or native-language quality'};
 await writeFile(root+'/translation-runtime-validation.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await server.close();}
