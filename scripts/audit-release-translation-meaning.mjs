import {createInterface} from 'node:readline';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {translationSources,validateTranslationSource,root} from './release-translation-source.mjs';
import {selectOpenAiModels} from '../server/openai-auth.js';
const {jobs,baseline}=await translationSources();const rows=[];
for(const file of await readdir(root+'/translations')){if(!file.endsWith('.json'))continue;const row=JSON.parse(await readFile(root+'/translations/'+file,'utf8'));if(row.format==='keyed-v2')continue;validateTranslationSource(row,jobs,file);rows.push(row);}
const reader=createInterface({input:process.stdin});let key;for await(const line of reader){key=line.trim();break;}reader.close();process.stdin.pause();if(!key)throw Error('Authorized credential required');
const catalog=await fetch('https://api.openai.com/v1/models',{headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(15000)});if(!catalog.ok)throw Error('Catalog HTTP '+catalog.status);
const model=selectOpenAiModels((await catalog.json()).data.map(x=>x.id)).search;
const dir=root+'/meaning-audit';await mkdir(dir,{recursive:true});const reports=[];
try{
 for(let index=0;index<rows.length;index+=4){const batch=rows.slice(index,index+4),file=dir+'/'+index+'.json';const input=batch.map(row=>({locale:row.locale,language:baseline.localeNames[row.locale],pairs:row.entries.map(entry=>({id:entry.id,english:JSON.parse(row.source).find(x=>x.id===entry.id).text,translation:entry.text}))}));let report;
  try{const cached=JSON.parse(await readFile(file,'utf8'));if(cached.source===JSON.stringify(input))report=cached.report;}catch{}
  if(!report){
   for(let attempt=1;attempt<=3;attempt++){try{
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(120000),body:JSON.stringify({model,reasoning:{effort:'low'},max_output_tokens:8000,instructions:'Audit smart-glasses UI translations against each English source. These were emitted as ordered arrays and may contain shifted bindings. Flag only clear semantic mistranslations, source/translation swaps, merged messages, or sentences left in English. Ignore ordinary loanwords, brand names, established UI terminology and harmless style/synonym differences. Do not flag unsupported speculation about a rare language. For each target locale return requiresRegeneration=true only if you can cite at least one concrete clear error. Return at most three examples per locale. If confident there is no clear error, return false with an empty examples array. This is an automated audit, not a native-speaker certification.',input:JSON.stringify(input),text:{format:{type:'json_schema',name:'translation_audit',strict:true,schema:{type:'object',properties:{locales:{type:'array',items:{type:'object',properties:{locale:{type:'string',enum:batch.map(x=>x.locale)},requiresRegeneration:{type:'boolean'},examples:{type:'array',items:{type:'object',properties:{id:{type:'string'},reason:{type:'string'}},required:['id','reason'],additionalProperties:false}}},required:['locale','requiresRegeneration','examples'],additionalProperties:false}}},required:['locales'],additionalProperties:false}}}})});
    if(!response.ok)throw Error('Audit HTTP '+response.status);const result=await response.json();if(result.status!=='completed')throw Error('Incomplete audit');report=JSON.parse(result.output.flatMap(x=>x.content??[]).filter(x=>x.type==='output_text').map(x=>x.text).join(''));
    const expected=new Map(batch.map(x=>[x.locale,x])),seen=new Set();for(const item of report.locales){if(!expected.has(item.locale)||seen.has(item.locale)||item.examples.length>3)throw Error('Invalid audit locale');seen.add(item.locale);for(const example of item.examples)if(!expected.get(item.locale).entries.some(x=>x.id===example.id))throw Error('Invalid example id');if(item.requiresRegeneration&&!item.examples.length)throw Error('Missing reason');}if(seen.size!==expected.size)throw Error('Incomplete locale audit');
    await writeFile(file,JSON.stringify({source:JSON.stringify(input),report,model,usage:result.usage},null,2));break;
   }catch(error){if(attempt===3)throw Error('Meaning audit failed at batch '+index+' ('+error.name+')');}}
  }
  reports.push(...report.locales);console.log(JSON.stringify({audited:reports.length,total:rows.length,flagged:reports.filter(x=>x.requiresRegeneration).length}));
 }
 await writeFile(root+'/translation-meaning-audit.json',JSON.stringify({model,automated:true,nativeSpeakerCertification:false,locales:reports},null,2));
}finally{key=undefined;}
