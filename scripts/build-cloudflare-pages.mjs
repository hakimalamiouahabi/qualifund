import { purgeIndirectSources } from './purge-indirect-sources.mjs';
await purgeIndirectSources();

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCertificationLedger, isPublishableAid } from './lib/publication.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const SITE=path.join(ROOT,'site');
const DATA=path.join(SITE,'data');
const DIST=path.join(ROOT,'dist');
const MAX_ASSET=24*1024*1024;
const TARGET_PART=18*1024*1024;
const excluded=new Set([
  'data/bootstrap.js',
  'data/library.json',
  'data/library.previous.json',
  'bibliotheque/qualifund-library.json',
  'bibliotheque/radar-library.json'
]);

const rel=p=>path.relative(SITE,p).split(path.sep).join('/');
await fs.rm(DIST,{recursive:true,force:true});
await fs.cp(SITE,DIST,{recursive:true,filter:src=>!excluded.has(rel(src))});

const library=JSON.parse(await fs.readFile(path.join(DATA,'library.json'),'utf8'));
const cfg=JSON.parse(await fs.readFile(path.join(ROOT,'config','sources.json'),'utf8'));
let ledger;
try{ledger=JSON.parse(await fs.readFile(path.join(DATA,'certification-ledger.json'),'utf8'))}
catch{ledger=await buildCertificationLedger(DATA,cfg)}
const configuredSourceIds=new Set((cfg.sources||[]).map(s=>s.id));
const unlockedSourceIds=new Set(ledger.unlockedSourceIds||[]);
const records=(Array.isArray(library.aaps)?library.aaps:[])
  .filter(a=>isPublishableAid(a,{configuredSourceIds,unlockedSourceIds}));

const distData=path.join(DIST,'data');
await fs.mkdir(distData,{recursive:true});
await fs.writeFile(path.join(distData,'certification-ledger.json'),JSON.stringify(ledger,null,2),'utf8');
const publicSources={
  version:cfg.version||null,
  sourcePolicy:'CERTIFIED_SOURCE_ONLY',
  sources:(cfg.sources||[]).filter(s=>unlockedSourceIds.has(s.id))
    .map(({id,name,scope,type,strategy,url,official,priority})=>({id,name,scope,type,strategy,url,official,priority}))
};
await fs.writeFile(path.join(distData,'sources.json'),JSON.stringify(publicSources,null,2),'utf8');
try{
  const coverage=JSON.parse(await fs.readFile(path.join(DATA,'coverage.json'),'utf8'));
  await fs.writeFile(path.join(distData,'coverage.json'),JSON.stringify((coverage||[]).filter(x=>unlockedSourceIds.has(x.id)),null,2),'utf8');
}catch{}

// Réécrire les exports téléchargeables dans dist à partir du corpus certifié uniquement.
const pubDir=path.join(DIST,'bibliotheque');
await fs.mkdir(pubDir,{recursive:true});
const arr=v=>Array.isArray(v)?v:[];
const csvEsc=v=>`"${String(v??'').replaceAll('"','""')}"`;
const csvRows=[['id','titre','type','portee','regions','financeurs','instruments','beneficiaires','cloture','permanent','page_officielle'].join(',')];
for(const a of records)csvRows.push([
  a.id,a.title,a.kind,a.scope,arr(a.regions).join(' | '),arr(a.funder).join(' | '),arr(a.aidTypes).join(' | '),
  arr(a.companyCategories).join(' | '),a.finalClosingDate||a.closingDate||'',a.permanent?'oui':'non',a.officialPage||''
].map(csvEsc).join(','));
for(const name of ['radar-library.csv','qualifund-library.csv'])await fs.writeFile(path.join(pubDir,name),csvRows.join('\n'),'utf8');
await fs.writeFile(path.join(pubDir,'status.json'),JSON.stringify({
  version:cfg.version||null,
  publicationPolicy:'CERTIFIED_SOURCE_ONLY',
  publishedCount:records.length,
  certifiedSources:[...unlockedSourceIds].sort(),
  generatedAt:library.meta?.generatedAt||null
},null,2),'utf8');

const changesPath=path.join(DIST,'data','changes.json');
try{
  const changes=JSON.parse(await fs.readFile(changesPath,'utf8'));
  const ids=new Set(records.map(a=>a.id));
  await fs.writeFile(changesPath,JSON.stringify((changes||[]).filter(x=>ids.has(x.id))),'utf8');
}catch{}

const parts=[];
let current=[],bytes=2;
for(const record of records){
  const encoded=JSON.stringify(record);
  const size=Buffer.byteLength(encoded,'utf8')+(current.length?1:0);
  if(current.length&&bytes+size>TARGET_PART){parts.push(current);current=[];bytes=2}
  current.push(record);bytes+=size;
}
if(current.length||!parts.length)parts.push(current);

const partDir=path.join(DIST,'data','library-parts');
await fs.mkdir(partDir,{recursive:true});
const partFiles=[];
for(let i=0;i<parts.length;i++){
  const name=`part-${String(i+1).padStart(3,'0')}.json`;
  const payload=JSON.stringify(parts[i]);
  const size=Buffer.byteLength(payload,'utf8');
  if(size>MAX_ASSET)throw new Error(`Fragment ${name} trop volumineux: ${size} octets`);
  await fs.writeFile(path.join(partDir,name),payload,'utf8');
  partFiles.push(`library-parts/${name}`);
}
const publicMeta={
  ...(library.meta||{}),
  publicationPolicy:'CERTIFIED_SOURCE_ONLY',
  rawLibraryCount:(library.aaps||[]).length,
  publishedCount:records.length,
  count:records.length,
  libraryCount:records.length,
  certifiedSourceCount:unlockedSourceIds.size,
  certifiedSources:[...unlockedSourceIds].sort()
};
const manifest={
  version:library.meta?.version||null,
  generatedAt:library.meta?.generatedAt||null,
  count:records.length,
  meta:publicMeta,
  parts:partFiles
};
await fs.writeFile(path.join(DIST,'data','library-manifest.json'),JSON.stringify(manifest),'utf8');
await fs.writeFile(path.join(DIST,'data','manifest.json'),JSON.stringify(publicMeta,null,2),'utf8');

async function walk(dir){
  const out=[];
  for(const entry of await fs.readdir(dir,{withFileTypes:true})){
    const p=path.join(dir,entry.name);
    if(entry.isDirectory())out.push(...await walk(p));else out.push(p);
  }
  return out;
}
const tooBig=[];
for(const p of await walk(DIST)){
  const st=await fs.stat(p);
  if(st.size>MAX_ASSET)tooBig.push({file:path.relative(DIST,p),size:st.size});
}
if(tooBig.length)throw new Error('Assets Cloudflare > 24 MiB: '+JSON.stringify(tooBig));

console.log(JSON.stringify({
  output:'dist',
  rawRecords:(library.aaps||[]).length,
  publishedRecords:records.length,
  quarantined:(library.aaps||[]).length-records.length,
  certifiedSources:[...unlockedSourceIds],
  parts:partFiles.length,
  largestPart:Math.max(0,...await Promise.all(partFiles.map(async x=>(await fs.stat(path.join(DIST,'data',x))).size))),
  excluded:[...excluded]
},null,2));
