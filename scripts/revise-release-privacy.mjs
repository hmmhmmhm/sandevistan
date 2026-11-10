import {createInterface} from 'node:readline';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {translationSources,validateTranslationSource,root} from './release-translation-source.mjs';
import {selectOpenAiModels} from '../server/openai-auth.js';
const before='AI sends your speech and text to OpenAI. Keys and saved history stay in local device storage.';
const after='AI sends your speech and conversation context to OpenAI. Keys and saved history are stored locally; your key is sent to the provider to authenticate requests.';
const locationHint='Allow location access for the Even app on your phone.';
const qualityNotice='Some interface translations are machine generated. Accuracy can vary by language.';
const revisionSource=JSON.stringify({notice:after,locationHint,qualityNotice});
const {baseline,jobs}=await translationSources();
const rows=[];for(const locale of jobs.keys()){const row=JSON.parse(await readFile(root+'/translations/'+locale+'.json','utf8'));const normalized=JSON.parse(row.source).map(x=>x.id==='release.aiDataNotice'&&(x.text===before||x.text===after)?{...x,text:jobs.get(locale).find(y=>y.id===x.id).text}:x);if(jobs.get(locale).some(x=>x.id==='release.locationSetupHint')&&!normalized.some(x=>x.id==='release.locationSetupHint'))normalized.push({id:'release.locationSetupHint',text:locationHint});if(jobs.get(locale).some(x=>x.id==='release.translationQualityNotice')&&!normalized.some(x=>x.id==='release.translationQualityNotice'))normalized.push({id:'release.translationQualityNotice',text:qualityNotice});validateTranslationSource({...row,source:JSON.stringify(normalized)},jobs,locale+'.json');rows.push(row);}
const reader=createInterface({input:process.stdin});let key;for await(const line of reader){key=line.trim();break;}reader.close();process.stdin.pause();if(!key)throw Error('Authorized credential required on stdin');
const catalog=await fetch('https://api.openai.com/v1/models',{headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(15000)});if(!catalog.ok)throw Error('Catalog HTTP '+catalog.status);
const model=selectOpenAiModels((await catalog.json()).data.map(x=>x.id)).analysis;
const directory=root+'/privacy-revision';await mkdir(directory,{recursive:true});const translated=new Map();
try{
 for(let index=0;index<rows.length;index+=30){
  const batch=rows.slice(index,index+30),file=directory+'/'+index+'.json';let values;
  try{const cached=JSON.parse(await readFile(file,'utf8'));if(cached.source===revisionSource&&JSON.stringify(cached.locales)===JSON.stringify(batch.map(x=>x.locale)))values=cached.values;}catch{}
  if(!values){
   for(let attempt=1;attempt<=3;attempt++){try{
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(120000),body:JSON.stringify({model,reasoning:{effort:'none'},max_output_tokens:16000,instructions:'Translate the messages accurately into each requested exact language/script. Return an object for each locale with aiDataNotice, locationSetupHint and translationQualityNotice. Preserve OpenAI. Distinguish storage on the device from transmission to the provider for authentication. Do not omit either point. No commentary or delimiter markers.',input:JSON.stringify({aiDataNotice:after,locationSetupHint:locationHint,translationQualityNotice:qualityNotice,targets:batch.map(x=>({locale:x.locale,language:baseline.localeNames[x.locale]}))}),text:{format:{type:'json_schema',name:'privacy_translations',strict:true,schema:{type:'object',properties:Object.fromEntries(batch.map(x=>[x.locale,{type:'object',properties:{aiDataNotice:{type:'string'},locationSetupHint:{type:'string'},translationQualityNotice:{type:'string'}},required:['aiDataNotice','locationSetupHint','translationQualityNotice'],additionalProperties:false}])),required:batch.map(x=>x.locale),additionalProperties:false}}}})});
    if(!response.ok)throw Error('Privacy translation HTTP '+response.status);const result=await response.json();if(result.status!=='completed')throw Error('Incomplete privacy translation');
    values=JSON.parse(result.output.flatMap(x=>x.content??[]).filter(x=>x.type==='output_text').map(x=>x.text).join(''));
    if(Object.keys(values).length!==batch.length||batch.some(x=>!values[x.locale]||['aiDataNotice','locationSetupHint','translationQualityNotice'].some(key=>typeof values[x.locale][key]!=='string'||!values[x.locale][key].trim()||values[x.locale][key].length>2000||values[x.locale][key].includes('|||')||/\{[^}]+\}/.test(values[x.locale][key]))))throw Error('Invalid privacy translations');
    await writeFile(file,JSON.stringify({source:revisionSource,locales:batch.map(x=>x.locale),values,model,usage:result.usage},null,2));break;
   }catch(error){if(attempt===3)throw Error('Privacy revision failed at batch '+index+' ('+error.name+')');}}
  }
  for(const row of batch)translated.set(row.locale,values[row.locale]);console.log(JSON.stringify({privacyLocales:translated.size,total:rows.length}));
 }
 translated.set('ko',{aiDataNotice:'음성과 대화 맥락은 OpenAI로 전송됩니다. 키와 저장된 기록은 기기에 보관하며, API 요청 인증을 위해 키를 OpenAI에 전송합니다.',locationSetupHint:'휴대폰의 Even 앱에서 위치 접근을 허용하세요.',translationQualityNotice:'일부 화면 문구는 자동 번역이며, 언어에 따라 정확도가 다를 수 있습니다.'});
 const path='src/release-copy-en.ts',source=await readFile(path,'utf8');if(!source.includes(JSON.stringify(before))&&!source.includes(JSON.stringify(after)))throw Error('Privacy source changed before revision');
 for(const row of rows){
  const entries=JSON.parse(row.source);const entry=entries.find(x=>x.id==='release.aiDataNotice');const result=row.entries.find(x=>x.id==='release.aiDataNotice');if(!entry||!result||![before,after].includes(entry.text))throw Error('Unexpected privacy source');
  entry.text=after;result.text=translated.get(row.locale).aiDataNotice;
  const locationSource=entries.find(x=>x.id==='release.locationSetupHint');if(locationSource)locationSource.text=locationHint;else entries.push({id:'release.locationSetupHint',text:locationHint});
  const locationCopy=row.entries.find(x=>x.id==='release.locationSetupHint');if(locationCopy)locationCopy.text=translated.get(row.locale).locationSetupHint;else row.entries.push({id:'release.locationSetupHint',text:translated.get(row.locale).locationSetupHint});
  const qualitySource=entries.find(x=>x.id==='release.translationQualityNotice');if(qualitySource)qualitySource.text=qualityNotice;else entries.push({id:'release.translationQualityNotice',text:qualityNotice});
  const qualityCopy=row.entries.find(x=>x.id==='release.translationQualityNotice');if(qualityCopy)qualityCopy.text=translated.get(row.locale).translationQualityNotice;else row.entries.push({id:'release.translationQualityNotice',text:translated.get(row.locale).translationQualityNotice});
  row.source=JSON.stringify(entries);row.privacyRevisionModel=model;
 }
 let updated=source.replace(JSON.stringify(before),JSON.stringify(after));if(!updated.includes('locationSetupHint:'))updated=updated.replace('} as const;','  locationSetupHint: '+JSON.stringify(locationHint)+',\n} as const;');
 if(!updated.includes('translationQualityNotice:'))updated=updated.replace('} as const;','  translationQualityNotice: '+JSON.stringify(qualityNotice)+',\n} as const;');
 await writeFile(path,updated);
 for(const row of rows)await writeFile(root+'/translations/'+row.locale+'.json',JSON.stringify(row,null,2));
 console.log(JSON.stringify({ok:true,privacyLocales:translated.size}));
}finally{key=undefined;}
