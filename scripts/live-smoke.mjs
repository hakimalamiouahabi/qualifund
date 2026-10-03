import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cfg=JSON.parse(await fs.readFile(path.join(ROOT,'config','sources.json'),'utf8'));
const VERSION=cfg.version||'unknown';
const args=new Set(process.argv.slice(2));
const strictCompany=args.has('--strict-company');
const strictPublic=args.has('--strict-public');
const timeoutMs=Number(process.env.RADAR_SMOKE_TIMEOUT_MS||20000);

async function probe(url,{expectJson=false,contains=null,containsAll=[]}={}){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const r=await fetch(url,{headers:{Accept:expectJson?'application/json':'text/html,application/json;q=0.9,*/*;q=0.8','User-Agent':`LEYTON-RADAR/${VERSION} production-smoke`},signal:controller.signal,cache:'no-store'});
    const text=await r.text();let json=null;if(expectJson){try{json=JSON.parse(text)}catch{}}
    const allMarkers=Array.isArray(containsAll)?containsAll.filter(Boolean):[];
    return {ok:r.ok&&(!contains||text.includes(contains))&&allMarkers.every(marker=>text.includes(marker))&&(!expectJson||json!=null),status:r.status,url,bytes:text.length,json,error:null};
  }catch(e){return{ok:false,status:null,url,bytes:0,json:null,error:e.name==='AbortError'?'timeout':String(e.message||e)}}finally{clearTimeout(timer)}
}

const companyUrl='https://recherche-entreprises.api.gouv.fr/search?q=751500851&per_page=1';
const company=await probe(companyUrl,{expectJson:true});
const companyResult=company.json?.results?.[0]||null;
company.ok=Boolean(company.ok&&companyResult&&String(companyResult.siren||'').replace(/\D/g,'')==='751500851');
company.sampleSiren='751500851';
delete company.json;

const publicBase=String(process.env.RADAR_PUBLIC_URL||'').trim().replace(/\/$/,'');
let publicSite={ok:false,skipped:!publicBase,url:publicBase||null,index:null,readiness:null};
if(publicBase){
  const index=await probe(publicBase+'/',{containsAll:['FUNDING RADAR','id="app"','app.js']});
  const readiness=await probe(publicBase+'/data/production-readiness.json',{expectJson:true});
  publicSite={ok:Boolean(index.ok&&readiness.ok),skipped:false,url:publicBase,index:{ok:index.ok,status:index.status,bytes:index.bytes,error:index.error},readiness:{ok:readiness.ok,status:readiness.status,bytes:readiness.bytes,error:readiness.error}};
}

const output={version:VERSION,generatedAt:new Date().toISOString(),companyApi:{ok:company.ok,status:company.status,url:company.url,bytes:company.bytes,error:company.error,sampleSiren:company.sampleSiren},publicSite};
await fs.mkdir(path.join(ROOT,'site','data'),{recursive:true});
await fs.writeFile(path.join(ROOT,'site','data','live-smoke.json'),JSON.stringify(output,null,2),'utf8');
console.log(JSON.stringify(output,null,2));
if((strictCompany&&!company.ok)||(strictPublic&&!publicSite.ok))process.exitCode=1;
