import {readFile} from 'node:fs/promises';
import ts from 'typescript';
export const root='output/public-release-prep-2026-11-09';
export async function translationSources(){
 const baseline=JSON.parse(await readFile(root+'/translation-baseline.json','utf8'));
 const source=await readFile('src/release-copy-en.ts','utf8');
 const ast=ts.createSourceFile('release-copy-en.ts',source,ts.ScriptTarget.Latest,true);let release;
 function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='RELEASE_COPY_EN'){
  let value=node.initializer;while(ts.isAsExpression(value)||ts.isSatisfiesExpression(value))value=value.expression;
  if(!ts.isObjectLiteralExpression(value))throw Error('Release copy must be a literal');
  release=value.properties.map(p=>{if(!ts.isPropertyAssignment(p)||!ts.isStringLiteral(p.initializer))throw Error('Release copy must use string literals');return {id:'release.'+p.name.getText(ast).replace(/^['"]|['"]$/g,''),text:p.initializer.text};});
 }ts.forEachChild(node,visit);}visit(ast);if(!release)throw Error('Missing release copy');
 const jobs=new Map(baseline.all.map(row=>[row.locale,[...row.candidates.map(x=>({id:x.group+'.'+x.key,text:x.english})),...release]]));
 return {baseline,jobs};
}
export function validateTranslationSource(row,jobs,file){
 const expected=jobs.get(row.locale);
 if(!expected||file!==row.locale+'.json')throw Error('Unexpected locale file '+file);
 if(row.source!==JSON.stringify(expected))throw Error('Source changed; regenerate translation for '+row.locale);
 return expected;
}
