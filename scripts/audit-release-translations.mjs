import {readFile,writeFile,mkdir} from 'node:fs/promises';
import ts from 'typescript';
import {createServer} from 'vite';
const root='output/public-release-prep-2026-11-09';await mkdir(root,{recursive:true});
async function keysInObject(path,name){const source=ts.createSourceFile(path,await readFile(path,'utf8'),ts.ScriptTarget.Latest,true);for(const statement of source.statements){if(!ts.isVariableStatement(statement))continue;for(const declaration of statement.declarationList.declarations){if(declaration.name.getText(source)!==name)continue;let node=declaration.initializer;while(node&&(ts.isAsExpression(node)||ts.isSatisfiesExpression(node)||ts.isParenthesizedExpression(node)))node=node.expression;if(node&&ts.isObjectLiteralExpression(node))return node.properties.map(p=>p.name?.getText(source).replace(/^['"]|['"]$/g,'')).filter(Boolean);}}throw Error('Object keys not found: '+name);}
const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom'});
try{
 const reg=await server.ssrLoadModule('/src/i18n/locale-registry.ts');
 const phone=await server.ssrLoadModule('/src/phone-i18n.ts');
 const hud=await server.ssrLoadModule('/src/ai-hud-i18n.ts');
 const ai=await server.ssrLoadModule('/src/ai-i18n.ts');
 const conv=await server.ssrLoadModule('/src/conversate-i18n.ts');
 const mcp=await server.ssrLoadModule('/src/mcp-i18n.ts');
 const walk=(value,prefix='')=>Object.entries(value).flatMap(([key,item])=>{const full=prefix?prefix+'.'+key:key;return typeof item==='string'?[full]:item&&typeof item==='object'?walk(item,full):[];});
 const localeKeys=walk(reg.LOCALE_REGISTRY.en).filter(key=>!['code','nativeName','direction','browserTags'].includes(key.split('.')[0]));
 const at=(value,key)=>key.split('.').reduce((node,part)=>node?.[part],value);
 const mcpKeys=['mcpServers','mcpHelp','mcpServerName','mcpServerUrl','mcpBearerToken','mcpAllowedTools','noMcpServers'];
 const groups={locale:{keys:localeKeys,get:(locale,key)=>at(reg.LOCALE_REGISTRY[locale],key)},mcp:{keys:mcpKeys,get:mcp.translateMcpPhone},hud:{keys:[...Object.keys(hud.AI_HUD_TRANSLATIONS.en),...Object.keys(hud.AI_HUD_ACTIVITY_TRANSLATIONS.en)],get:hud.translateAiHud},approval:{keys:Object.keys(hud.translateAiApproval('en')),get:(locale,key)=>hud.translateAiApproval(locale)[key]},aiPhone:{keys:[...await keysInObject('src/ai-i18n.ts','english'),...Object.keys(ai.AI_PHONE_CONTROL_TRANSLATIONS.en)],get:ai.translateAiPhone},conversate:{keys:await keysInObject('src/conversate-i18n.ts','EN'),get:conv.translateConversate}};
 const brand=new Set(['AI','OpenAI','MCP','RSS','API','SDK','G2','R1','Conversate','Inform','Copilot','Prep Note','Sandevistan','SANDEVISTAN','Even Hub SDK']);
 const locales=reg.SUPPORTED_LOCALES,report=[];
 for(const locale of locales){if(locale==='en')continue;const candidates=[];for(const [group,{keys,get}] of Object.entries(groups)){for(const key of keys){const value=get(locale,key),english=get('en',key);if(!value||/\|\|\|/.test(value)||value===english&&!brand.has(value)&&/[a-z]{3}/i.test(value))candidates.push({group,key,english,value});}}report.push({locale,candidates});}
 const declared=['en','de','fr','es','it','zh-Hans','zh-Hant','ja','ko'];
 const result={localeCount:locales.length,localeNames:Object.fromEntries(locales.map(locale=>[locale,reg.LOCALE_REGISTRY[locale].nativeName])),declared:report.filter(r=>declared.includes(r.locale)),all:report,groupKeys:Object.fromEntries(Object.entries(groups).map(([name,g])=>[name,g.keys]))};
 const reportName=process.argv.find(x=>x.startsWith('--report='))?.slice('--report='.length) ?? 'translation-baseline.json';
 if(!/^[a-z0-9-]+\.json$/.test(reportName))throw Error('Invalid report filename');
 await writeFile(root+'/'+reportName,JSON.stringify(result,null,2));
 console.log(JSON.stringify({localeCount:locales.length,declared:result.declared.map(r=>({locale:r.locale,candidates:r.candidates.length})),allCandidates:report.reduce((n,r)=>n+r.candidates.length,0)}));
}finally{await server.close();}
