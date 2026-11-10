import {createInterface} from 'node:readline';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
const lines=createInterface({input:process.stdin});let key;for await(const line of lines){key=line.trim();break;}lines.close();process.stdin.pause();if(!key)throw Error('Key required on stdin');
const baseline=process.argv.includes('--baseline');
const root='output/conversate-context-2026-11-08';await mkdir(root,{recursive:true});
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
const cases=[
 {name:'retention-reference',context:['We are reviewing net revenue retention, or NRR.','Our quarterly NRR is 110 percent.'],current:'What does that mean for us?',inform:/110|10%|10퍼센트/,cue:/retention|revenue|유지율|매출/i},
 {name:'availability-reference',context:['We are reviewing our service availability SLA.','The uptime target is 99.95 percent; the monthly downtime budget is 21.6 minutes.'],current:'What does that mean for us?',inform:/99\.95|21\.6|22/,cue:/uptime|availability|downtime|가용|중단/i},
 {name:'corrected-plan',context:['The launch review is Tuesday at three.','Correction: the review is Thursday at ten, and the budget is due Wednesday evening.'],current:'Please confirm that plan.',cue:/Thursday|목요일/i,extra:/Wednesday|수요일/i},
 {name:'older-terms',context:['The agreed contract is monthly billing for 120 seats with a 2400 dollar monthly cap.',...Array.from({length:10},(_,i)=>`We are collecting the attendee names, item ${i+1}.`)],current:'Please confirm the terms we already agreed.',cue:/120|2400|2,400/,extra:/monthly|월/i,requiredContext:'120 seats'},
 {name:'private-prep',context:['We could suggest annual prepayment.','The client is discussing options.'],current:'How should I respond?',goal:'I am the vendor and must respect the client cash-flow constraint.',prep:'Mina cannot prepay annually. Approved offer: monthly billing, 120 seats, maximum 2400 dollars per month.',cue:/monthly|월/i,extra:/120|2400|2,400/},
];
try {
 const {requestConversateAnalysis}=await server.ssrLoadModule('/src/conversate-analysis.ts');
 const {DEFAULT_CONVERSATE_SETTINGS}=await server.ssrLoadModule('/src/conversate-state.ts');
 const {resolveOpenAiModels}=await server.ssrLoadModule('/src/openai-models.ts');
 const models=await resolveOpenAiModels(key,fetch,AbortSignal.timeout(10000)),results=[];
 for(const scenario of cases){
  let sent;
  const result=await requestConversateAnalysis({key,locale:'ko',model:models.analysis,
   settings:{...DEFAULT_CONVERSATE_SETTINGS,translation:false,goal:scenario.goal??'',prepNoteText:scenario.prep??''},
   segments:[...scenario.context,scenario.current].map((text,i)=>({id:String(i),text,at:'2026-11-08T12:00:00Z'})),
   signal:AbortSignal.timeout(30000),fetchImpl:async(url,init)=>{sent=JSON.parse(init.body);return fetch(url,init);}});
  const replies=result.suggestions.map(s=>`${s.original} ${s.meaning}`).join(' ');
  const input=JSON.parse(sent.input[0].content);
  const checks={contextualReplies:scenario.cue.test(replies),extraConstraint:!scenario.extra||scenario.extra.test(replies),
   contextualInform:!scenario.inform||(typeof result.inform==='string'&&scenario.inform.test(result.inform)),
   contextPreserved:!scenario.requiredContext||input.previousContext.some(s=>s.includes(scenario.requiredContext)),
   primaryLanguage: (!result.inform || /[가-힣]/.test(result.inform)) && result.suggestions.every(s=>/[가-힣]/.test(s.meaning)),
   threeReplies:result.suggestions.length===3};
  results.push({name:scenario.name,checks,result,request:{model:sent.model,instructions:sent.instructions,input}});
  console.log(JSON.stringify({name:scenario.name,checks}));
 }
 const output={ok:results.every(r=>Object.values(r.checks).every(Boolean)),baseline,model:models.analysis,results};
 await writeFile(`${root}/${baseline?'baseline':'verified'}.json`,JSON.stringify(output,null,2).split(key).join('[REDACTED]'));
 console.log(JSON.stringify({ok:output.ok,output:`${root}/${baseline?'baseline':'verified'}.json`}));
} finally {key=undefined;await server.close();}
