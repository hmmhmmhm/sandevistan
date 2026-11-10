import {translationSources,validateTranslationSource} from './release-translation-source.mjs';
import {readFile,readdir,writeFile} from 'node:fs/promises';
const root='output/public-release-prep-2026-11-09';
const files=(await readdir(root+'/translations')).filter(x=>x.endsWith('.json'));
const {jobs}=await translationSources();
const complete=files.length===jobs.size&&[...jobs.keys()].every(locale=>files.includes(locale+'.json'));
const anomalies=[];let count=0;
for(const file of files){
 const row=JSON.parse(await readFile(root+'/translations/'+file,'utf8'));
 const expected=new Map(validateTranslationSource(row,jobs,file).map(x=>[x.id,x.text]));const seen=new Set();
 for(const entry of row.entries){
  const english=expected.get(entry.id);if(!english||seen.has(entry.id))throw Error('Unexpected or duplicate entry '+row.locale+'/'+entry.id);
  seen.add(entry.id);
  const placeholders=x=>[...x.matchAll(/\{[^}]+\}/g)].map(x=>x[0]).sort().join('|');
  if(!entry.text.trim()||entry.text.includes('|||')||placeholders(english)!==placeholders(entry.text))throw Error('Invalid translation '+row.locale+'/'+entry.id);
  if(entry.text===english&&/[a-z]{3}/i.test(english))anomalies.push({locale:row.locale,id:entry.id,text:english});
  count++;
 }
 if(seen.size!==expected.size)throw Error('Missing entries '+row.locale);
}
await writeFile(root+'/translation-validation.json',JSON.stringify({complete,locales:files.length,entries:count,unchangedEntriesForReview:anomalies},null,2));
console.log(JSON.stringify({complete,locales:files.length,entries:count,unchangedEntriesForReview:anomalies.length}));
