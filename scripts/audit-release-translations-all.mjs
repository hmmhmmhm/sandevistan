import {createInterface} from 'node:readline';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {translationSources,validateTranslationSource,root} from './release-translation-source.mjs';
import {selectOpenAiModels} from '../server/openai-auth.js';
const {jobs,baseline}=await translationSources(),dir=root+'/meaning-audit-all';await mkdir(dir,{recursive:true});const rows=[],reports=[];
for(const file of await readdir(root+'/translations')){
 if(!file.endsWith('.json'))continue;const row=JSON.parse(await readFile(root+'/translations/'+file,'utf8'));validateTranslationSource(row,jobs,file);
 const source=new Map(JSON.parse(row.source).map(x=>[x.id,x.text]));const input={locale:row.locale,language:baseline.localeNames[row.locale],pairs:row.entries.filter(x=>!['release.aiDataNotice','release.locationSetupHint'].includes(x.id)).map(entry=>({id:entry.id,english:source.get(entry.id),translation:entry.text}))};
 let cached;try{cached=JSON.parse(await readFile(dir+'/'+row.locale+'.json','utf8'));}catch{}
 if(cached?.source===JSON.stringify(input))reports.push(cached.report);else rows.push(input);
}
const reader=createInterface({input:process.stdin});let key;for await(const line of reader){key=line.trim();break;}reader.close();process.stdin.pause();if(!key)throw Error('Authorized credential required');
const catalog=await fetch('https://api.openai.com/v1/models',{headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(15000)});if(!catalog.ok)throw Error('Catalog HTTP '+catalog.status);
const model=selectOpenAiModels((await catalog.json()).data.map(x=>x.id)).search;
try{
 for(let index=0;index<rows.length;index+=4){const batch=rows.slice(index,index+4);let report;
  for(let attempt=1;attempt<=3;attempt++){try{
   const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(120000),body:JSON.stringify({model,reasoning:{effort:'low'},max_output_tokens:8000,instructions:'Audit each smart-glasses UI translation against its English source. Flag only clear semantic mistranslations, reversed states, merged messages or sentences left in English. Ignore ordinary loanwords, brand names, established UI terms, and harmless contextual phrasing or synonym differences. Do not speculate about a rare language you cannot confidently assess. For each locale return requiresRegeneration=true only with concrete clear errors. Give at most three examples per locale. Otherwise return false and empty examples. This is an automated audit, not native-speaker certification.',input:JSON.stringify(batch),text:{format:{type:'json_schema',name:'translation_audit',strict:true,schema:{type:'object',properties:{locales:{type:'array',minItems:batch.length,maxItems:batch.length,items:{type:'object',properties:{locale:{type:'string',enum:batch.map(x=>x.locale)},requiresRegeneration:{type:'boolean'},examples:{type:'array',maxItems:3,items:{type:'object',properties:{id:{type:'string'},reason:{type:'string'}},required:['id','reason'],additionalProperties:false}}},required:['locale','requiresRegeneration','examples'],additionalProperties:false}}},required:['locales'],additionalProperties:false}}}})});
   if(!response.ok)throw Error('Audit HTTP '+response.status);const result=await response.json();if(result.status!=='completed')throw Error('Incomplete audit');report=JSON.parse(result.output.flatMap(x=>x.content??[]).filter(x=>x.type==='output_text').map(x=>x.text).join(''));
   const expected=new Map(batch.map(x=>[x.locale,x])),seen=new Set();for(const item of report.locales){if(!expected.has(item.locale)||seen.has(item.locale)||item.examples.length>3)throw Error('Invalid audit locale');seen.add(item.locale);for(const example of item.examples)if(!expected.get(item.locale).pairs.some(x=>x.id===example.id))throw Error('Invalid example id');if(item.requiresRegeneration&&!item.examples.length)throw Error('Missing reason');}if(seen.size!==expected.size)throw Error('Incomplete locale audit');break;
  }catch(error){if(attempt===3)throw Error('Meaning audit failed at batch '+index+' ('+error.name+')');}}
  for(const item of report.locales)await writeFile(dir+'/'+item.locale+'.json',JSON.stringify({source:JSON.stringify(batch.find(x=>x.locale===item.locale)),report:item,model},null,2));
  reports.push(...report.locales);console.log(JSON.stringify({audited:reports.length,generatedAtStart:rows.length+reports.length-index-batch.length,flagged:reports.filter(x=>x.requiresRegeneration).length}));
 }
 await writeFile(root+'/translation-meaning-audit-all.json',JSON.stringify({model,automated:true,nativeSpeakerCertification:false,expectedLocaleCount:jobs.size,auditedLocaleCount:reports.length,locales:reports},null,2));
}finally{key=undefined;}
