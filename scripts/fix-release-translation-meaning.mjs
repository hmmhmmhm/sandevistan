import {createInterface} from 'node:readline';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import ts from 'typescript';
import {root,translationSources,validateTranslationSource} from './release-translation-source.mjs';
import {selectOpenAiModels} from '../server/openai-auth.js';
const all=process.argv.includes('--all-audit');
const audit=JSON.parse(await readFile(root+(all?'/translation-meaning-audit-all.json':'/translation-meaning-audit.json'),'utf8'));
const {baseline,jobs}=await translationSources();const rows=new Map(),targets=[];
for(const item of audit.locales.filter(x=>x.requiresRegeneration)){
 const row=JSON.parse(await readFile(root+'/translations/'+item.locale+'.json','utf8'));validateTranslationSource(row,jobs,item.locale+'.json');rows.set(item.locale,row);
 for(const example of item.examples){const entry=row.entries.find(x=>x.id===example.id),source=JSON.parse(row.source).find(x=>x.id===example.id);targets.push({key:item.locale+'|'+example.id,locale:item.locale,language:baseline.localeNames[item.locale],id:example.id,english:source.text,before:entry.text,reason:example.reason});}
}
const reader=createInterface({input:process.stdin});let key;for await(const line of reader){key=line.trim();break;}reader.close();process.stdin.pause();if(!key)throw Error('Authorized credential required');
const catalog=await fetch('https://api.openai.com/v1/models',{headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(15000)});if(!catalog.ok)throw Error('Catalog HTTP '+catalog.status);
const model=selectOpenAiModels((await catalog.json()).data.map(x=>x.id)).search;
let fixes;try{
 for(let attempt=1;attempt<=3;attempt++){try{
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(120000),body:JSON.stringify({model,reasoning:{effort:'low'},max_output_tokens:8000,instructions:'Correct the supplied UI translations in each exact target language and script. The reason identifies a semantic error; correct against the English source. Return only the corrected translation per composite key. Preserve product names and every placeholder in braces. Enabled and disabled, absence and presence, timeouts and quick responses must remain distinct. For short HUD labels use concise clear words, not literal romantic-partner translations of companion app.',input:JSON.stringify(targets),text:{format:{type:'json_schema',name:'translation_corrections',strict:true,schema:{type:'object',properties:Object.fromEntries(targets.map(x=>[x.key,{type:'string'}])),required:targets.map(x=>x.key),additionalProperties:false}}}})});
  if(!response.ok)throw Error('Correction HTTP '+response.status);const result=await response.json();if(result.status!=='completed')throw Error('Incomplete corrections');fixes=JSON.parse(result.output.flatMap(x=>x.content??[]).filter(x=>x.type==='output_text').map(x=>x.text).join(''));
  const placeholders=x=>[...x.matchAll(/\{[^}]+\}/g)].map(x=>x[0]).sort().join('|');if(Object.keys(fixes).length!==targets.length||targets.some(x=>typeof fixes[x.key]!=='string'||!fixes[x.key].trim()||fixes[x.key].length>3000||fixes[x.key].includes('|||')||placeholders(fixes[x.key])!==placeholders(x.english)))throw Error('Invalid correction');break;
 }catch(error){if(attempt===3)throw Error('Correction failed ('+error.name+')');}}
}finally{key=undefined;}
fixes['ko|release.hudFixed18']='휴대폰 // 앱';fixes['ko|release.hudFixed42']='둘러보기';fixes['ja|locale.phone.todo']='タスク';
const backup=root+(all?'/meaning-corrections-all':'/meaning-corrections');await mkdir(backup,{recursive:true});
for(const [locale,row] of rows){
 await writeFile(backup+'/'+locale+'-before.json',JSON.stringify(row,null,2),{flag:'wx'});
 const localeTargets=targets.filter(x=>x.locale===locale),localeFile='src/i18n/locales/'+locale+'.ts',source=await readFile(localeFile,'utf8');const ast=ts.createSourceFile(localeFile,source,ts.ScriptTarget.Latest,true),leaves=new Map();
 function visit(node,path=[]){if(ts.isPropertyAssignment(node)){visit(node.initializer,[...path,node.name.getText(ast).replace(/^['"]|['"]$/g,'')]);return;}if(ts.isStringLiteral(node)){leaves.set(path.join('.'),node);return;}if(ts.isArrayLiteralExpression(node)){node.elements.forEach((x,i)=>visit(x,[...path,String(i)]));return;}ts.forEachChild(node,x=>visit(x,path));}visit(ast);
 const edits=[];
 for(const target of localeTargets){
  const after=fixes[target.key];if(target.id.startsWith('locale.')){const path=target.id.slice(7),node=leaves.get(path),original=baseline.all.find(x=>x.locale===locale).candidates.find(x=>x.group==='locale'&&x.key===path)?.value;if(!node||![target.before,after,original].includes(node.text))throw Error('Locale source changed '+target.key);if(node.text!==after)edits.push({start:node.getStart(ast),end:node.end,text:JSON.stringify(after)});}
  row.entries.find(x=>x.id===target.id).text=after;
 }
 let output=source;for(const edit of edits.sort((a,b)=>b.start-a.start))output=output.slice(0,edit.start)+edit.text+output.slice(edit.end);if(output!==source)await writeFile(localeFile,output);
 row.semanticCorrectionModel=model;await writeFile(root+'/translations/'+locale+'.json',JSON.stringify(row,null,2));
}
await writeFile(root+(all?'/translation-meaning-corrections-all.json':'/translation-meaning-corrections.json'),JSON.stringify({model,automated:true,nativeSpeakerCertification:false,corrections:targets.map(x=>({...x,after:fixes[x.key]}))},null,2));
console.log(JSON.stringify({correctedMessages:targets.length,locales:rows.size}));
