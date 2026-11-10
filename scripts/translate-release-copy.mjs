import {createInterface} from 'node:readline';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {translationSources,root} from './release-translation-source.mjs';
import {selectOpenAiModels} from '../server/openai-auth.js';
const reader=createInterface({input:process.stdin});let key;for await(const line of reader){key=line.trim();break;}reader.close();process.stdin.pause();if(!key)throw Error('Authorized credential required on stdin');
const {baseline,jobs}=await translationSources(),directory=root+'/translations',partials=root+'/translations-pending';await mkdir(directory,{recursive:true});await mkdir(partials,{recursive:true});
const catalog=await fetch('https://api.openai.com/v1/models',{headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(15000)});if(!catalog.ok)throw Error('Model catalog HTTP '+catalog.status);
const model=selectOpenAiModels((await catalog.json()).data.map(x=>x.id)).analysis;
let completed=0,observedTokens=0;
const placeholders=value=>[...value.matchAll(/\{[^}]+\}/g)].map(x=>x[0]).sort().join('|');
const instructions='Translate smart-glasses UI into the exact requested language and script. Each id is separate; never combine messages or add numbering, explanations or delimiter markers. Return a translations object keyed by each exact requested id. Preserve OpenAI, OpenRouteService, SANDEVISTAN, G2/R1, MCP, SDK, Inform, Copilot, Conversate, Prep Note, Open-Meteo and OSM. Preserve every placeholder in braces, units, URLs and numbers. Translate surrounding UI words naturally and concisely. Rare languages must use their own language/script, never silently substitute English or a related language. Keep enabled/disabled and presence/absence distinct.';
try{
 for(const [locale,entries] of jobs){
  const source=JSON.stringify(entries),file=directory+'/'+locale+'.json';let existing,partial;try{existing=JSON.parse(await readFile(file,'utf8'));}catch{}try{partial=JSON.parse(await readFile(partials+'/'+locale+'.json','utf8'));}catch{}
  if(existing?.source===source&&existing.entries.length===entries.length){completed++;continue;}
  const expected=new Map(entries.map(x=>[x.id,x.text])),oldSource=new Map(existing?JSON.parse(existing.source).map(x=>[x.id,x.text]):[]),oldEntries=new Map(existing?.entries.map(x=>[x.id,x.text])??[]);
  const preserved=new Map(entries.filter(x=>oldSource.get(x.id)===x.text&&oldEntries.has(x.id)).map(x=>[x.id,oldEntries.get(x.id)]));
  if(partial?.source===source)for(const entry of partial.entries){if(expected.has(entry.id)&&typeof entry.text==='string'&&entry.text.trim()&&!entry.text.includes('|||')&&placeholders(entry.text)===placeholders(expected.get(entry.id)))preserved.set(entry.id,entry.text);}
  const pending=entries.filter(x=>!preserved.has(x.id));const chunkSize=pending.length>180?60:pending.length;let lastUsage;
  for(let index=0;index<pending.length;index+=chunkSize){const chunk=pending.slice(index,index+chunkSize);
   for(let attempt=1;attempt<=3;attempt++){try{
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(120000),body:JSON.stringify({model,reasoning:{effort:'none'},max_output_tokens:16000,instructions,input:JSON.stringify({targetLocale:locale,targetLanguage:baseline.localeNames[locale],entries:chunk}),text:{format:{type:'json_schema',name:'ui_translations',strict:true,schema:{type:'object',properties:{locale:{type:'string',enum:[locale]},translations:{type:'object',properties:Object.fromEntries(chunk.map(x=>[x.id,{type:'string'}])),required:chunk.map(x=>x.id),additionalProperties:false}},required:['locale','translations'],additionalProperties:false}}}})});
    if(!response.ok)throw Error('Translation HTTP '+response.status);const result=await response.json();observedTokens+=result.usage?.total_tokens??0;if(result.status!=='completed')throw Error('Incomplete translation: '+(result.incomplete_details?.reason??result.status));
    const parsed=JSON.parse(result.output.flatMap(x=>x.content??[]).filter(x=>x.type==='output_text').map(x=>x.text).join(''));if(parsed.locale!==locale||!parsed.translations||typeof parsed.translations!=='object')throw Error('Invalid locale response');
    const translated=Object.entries(parsed.translations),wanted=new Map(chunk.map(x=>[x.id,x.text]));if(translated.length!==chunk.length)throw Error('Wrong entry count');
    for(const [id,text] of translated){if(!wanted.has(id)||typeof text!=='string'||!text.trim()||text.length>3000||text.includes('|||')||placeholders(text)!==placeholders(wanted.get(id)))throw Error('Invalid entry '+id);}
    for(const [id,text] of translated)preserved.set(id,text);lastUsage=result.usage;
    await writeFile(partials+'/'+locale+'.json',JSON.stringify({source,entries:[...preserved].map(([id,text])=>({id,text})),model},null,2));
    console.log(JSON.stringify({locale,translatedEntries:preserved.size,totalEntries:entries.length,observedTokensThisRun:observedTokens}));break;
   }catch(error){const detail=error.name==='SyntaxError'?'invalid JSON':error.message.slice(0,160);if(attempt===3||/HTTP (401|403)/.test(detail))throw Error('Translation failed for '+locale+': '+detail);console.warn(JSON.stringify({locale,retry:attempt,detail}));}}
  }
  const merged=entries.map(entry=>({id:entry.id,text:preserved.get(entry.id)}));if(merged.some(x=>typeof x.text!=='string'))throw Error('Missing translated entries');
  await writeFile(file,JSON.stringify({...existing,locale,name:baseline.localeNames[locale],model,source,entries:merged,format:'keyed-v2',usage:lastUsage},null,2));completed++;console.log(JSON.stringify({locale,completed,total:jobs.size,entries:merged.length}));
 }
 console.log(JSON.stringify({ok:true,completed,model,observedTokensThisRun:observedTokens}));
}finally{key=undefined;}
