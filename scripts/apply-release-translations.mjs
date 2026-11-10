import {readFile,writeFile,mkdir,copyFile,readdir} from 'node:fs/promises';
import ts from 'typescript';
import {translationSources,validateTranslationSource} from './release-translation-source.mjs';
const root='output/public-release-prep-2026-11-09';
const {baseline,jobs}=await translationSources();
const files=(await readdir(root+'/translations')).filter(x=>x.endsWith('.json'));
if(!process.argv.includes('--partial')&&(files.length!==jobs.size||[...jobs.keys()].some(locale=>!files.includes(locale+'.json'))))throw Error('All 179 translations must be complete');
const partial=process.argv.includes('--partial');
const data={};let changed=0, applied=0;
if(partial){try{const previous=await readFile('src/i18n/release-translations.ts','utf8');for(const match of previous.matchAll(/^  "([^"]+)": (.*),$/gm))data[match[1]]=JSON.parse(match[2]);}catch(error){if(error.code!=='ENOENT')throw error;}}
for(const file of files){
 const row=JSON.parse(await readFile(root+'/translations/'+file,'utf8'));
 if(partial&&row.source!==JSON.stringify(jobs.get(row.locale)))continue;
 validateTranslationSource(row,jobs,file); applied++;
 const expected=baseline.all.find(x=>x.locale===row.locale);if(!expected)throw Error('Unknown locale');
 const byId=new Map(row.entries.map(x=>[x.id,x.text]));
 const localeFile='src/i18n/locales/'+row.locale+'.ts';
 const source=await readFile(localeFile,'utf8');
 const ast=ts.createSourceFile(localeFile,source,ts.ScriptTarget.Latest,true);
 const leaves=new Map();
 function visit(node,path=[]){
  if(ts.isPropertyAssignment(node)){const name=node.name.getText(ast).replace(/^['"]|['"]$/g,'');visit(node.initializer,[...path,name]);return;}
  if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)){leaves.set(path.join('.'),node);return;}
  if(ts.isArrayLiteralExpression(node)){node.elements.forEach((x,i)=>visit(x,[...path,String(i)]));return;}
  ts.forEachChild(node,child=>visit(child,path));
 }
 visit(ast);
 const edits=[];
 for(const candidate of expected.candidates.filter(x=>x.group==='locale')){
  const text=byId.get('locale.'+candidate.key),node=leaves.get(candidate.key);
  if(typeof text!=='string'||!node)throw Error('Missing locale leaf '+row.locale+'/'+candidate.key);
  if(node.text===text)continue;
  if(node.text!==candidate.value)throw Error('Source changed since audit '+row.locale+'/'+candidate.key);
  edits.push({start:node.getStart(ast),end:node.end,text:JSON.stringify(text)});
 }
 if(edits.length){
  const backup=root+'/work/translation-source-backup';await mkdir(backup,{recursive:true});
  try{await copyFile(localeFile,backup+'/'+file.replace('.json','.ts'),1);}catch(error){if(error.code!=='EEXIST')throw error;}
  let output=source;for(const edit of edits.sort((a,b)=>b.start-a.start))output=output.slice(0,edit.start)+edit.text+output.slice(edit.end);
  await writeFile(localeFile,output);changed+=edits.length;
 }
 const groups={};for(const {id,text} of row.entries){const split=id.indexOf('.'),group=id.slice(0,split),key=id.slice(split+1);if(group==='locale')continue;(groups[group]??={})[key]=text;}
 data[row.locale]=groups;
}
const output='import type { SupportedLocale } from "./locale-registry";\nexport const RELEASE_TRANSLATIONS: Partial<Record<SupportedLocale, Readonly<Record<string, Readonly<Record<string, string>>>>>> = {\n'+Object.entries(data).map(([locale,groups])=>'  '+JSON.stringify(locale)+': '+JSON.stringify(groups)+',').join('\n')+'\n};\n';
await writeFile('src/i18n/release-translations.ts',output);
console.log(JSON.stringify({locales:applied,changedLocaleLeaves:changed}));
