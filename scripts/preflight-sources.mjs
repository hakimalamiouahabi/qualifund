import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cfg=JSON.parse(await fs.readFile(path.join(ROOT,'config','sources.json'),'utf8'));
const OUT=path.join(ROOT,'site','data','source-health.json');
const timeoutMs=Number(process.env.RADAR_PREFLIGHT_TIMEOUT_MS||12000), concurrency=Number(process.env.RADAR_PREFLIGHT_CONCURRENCY||16);
const deriveUrl=s=>s.healthUrl||s.api||s.url||(s.strategy==='data-gouv-query'&&s.query?`https://www.data.gouv.fr/api/1/datasets/?q=${encodeURIComponent(s.query)}`:null);
const sources=(cfg.sources||[]).map(s=>({id:s.id,name:s.name,scope:s.scope,url:deriveUrl(s),official:!!s.official,priority:s.priority??1,strategy:s.strategy,role:s.strategy==='control-only'?'CONTROL':'INGESTION'}));
let cursor=0;const results=[];
async function timedFetch(url,init={}){const ac=new AbortController();const t=setTimeout(()=>ac.abort(),timeoutMs);try{return await fetch(url,{redirect:'follow',...init,signal:ac.signal,headers:{'user-agent':`LEYTON-RADAR/${cfg.version} source-health`,'accept':'text/html,application/json,*/*','connection':'close',...(init.headers||{})}})}finally{clearTimeout(t)}}
async function check(s){const started=Date.now();if(!s.url)return{...s,ok:false,probeState:'UNPROBED',durationMs:0,checkedAt:new Date().toISOString(),error:'NO_HEALTH_URL'};try{let r=null;try{r=await timedFetch(s.url,{method:'HEAD'})}catch{}
if(!r||[400,403,405,429].includes(r.status)){try{r=await timedFetch(s.url,{method:'GET',headers:{range:'bytes=0-2048'}})}catch(e){if(!r)throw e}}
const protectedStatus=[401,403,429].includes(r.status);return{...s,ok:r.ok||protectedStatus,probeState:protectedStatus?'PROTECTED':(r.ok?'OK':'HTTP_ERROR'),httpStatus:r.status,finalUrl:r.url||s.url,contentType:r.headers.get('content-type'),durationMs:Date.now()-started,checkedAt:new Date().toISOString(),note:protectedStatus?'Source protégée/anti-bot/quota : collecteur navigateur ou stratégie spécialisée requise.':null}}catch(e){return{...s,ok:false,probeState:e?.name==='AbortError'?'TIMEOUT':'NETWORK_ERROR',httpStatus:null,finalUrl:s.url,contentType:null,durationMs:Date.now()-started,checkedAt:new Date().toISOString(),error:e?.name==='AbortError'?'TIMEOUT':String(e?.message||e)}}}
await Promise.all(Array.from({length:concurrency},async()=>{while(true){const i=cursor++;if(i>=sources.length)return;results.push(await check(sources[i]))}}));
results.sort((a,b)=>a.id.localeCompare(b.id));
const networkErrors=results.filter(x=>x.probeState==='NETWORK_ERROR'||x.probeState==='TIMEOUT').length;const okCount=results.filter(x=>x.ok).length;const ingestion=results.filter(x=>x.role==='INGESTION'),controls=results.filter(x=>x.role==='CONTROL');const unprobed=results.filter(x=>x.probeState==='UNPROBED').length,probed=results.length-unprobed,conclusive=results.filter(x=>['OK','PROTECTED','HTTP_ERROR'].includes(x.probeState)).length;const summary={generatedAt:new Date().toISOString(),version:cfg.version,total:results.length,probed,conclusive,ok:okCount,failed:results.filter(x=>!x.ok&&x.probeState!=='UNPROBED').length,protected:results.filter(x=>x.probeState==='PROTECTED').length,unprobed,timeouts:results.filter(x=>x.probeState==='TIMEOUT').length,networkErrors,ingestion:{total:ingestion.length,ok:ingestion.filter(x=>x.ok).length},controls:{total:controls.length,ok:controls.filter(x=>x.ok).length},environmentSuspect:results.length>20&&okCount===0&&networkErrors/results.length>.8,liveCycleExecuted:false};
await fs.mkdir(path.dirname(OUT),{recursive:true});await fs.writeFile(OUT,JSON.stringify({summary,results},null,2),'utf8');console.log(JSON.stringify(summary));
setTimeout(()=>process.exit(summary.unprobed?2:0),20);
