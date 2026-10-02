import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertDirectSources, filterDirectLibrary } from './lib/direct-sources.mjs';
import { aidIsCertified, loadCertifiedSources } from './lib/certified-sources.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const SITE=path.join(ROOT,'site');
const DIST=path.join(ROOT,'dist');
const DATA=path.join(SITE,'data');
const MAX_ASSET=24*1024*1024;
const TARGET_PART=18*1024*1024;
const excluded=new Set([
  'data/bootstrap.js',
  'data/library.json',
  'data/library.previous.json',
  'data/criteria-audit.json',
  'data/remediation.json',
  'data/source-health.json',
  'bibliotheque/qualifund-library.json',
  'bibliotheque/radar-library.json',
  'bibliotheque/qualifund-library.csv'
]);

const cfg=JSON.parse(await fs.readFile(path.join(ROOT,'config','sources.json'),'utf8'));
assertDirectSources(cfg);
const library=JSON.parse(await fs.readFile(path.join(DATA,'library.json'),'utf8'));
const certified=await loadCertifiedSources(ROOT,cfg);
const certifiedIds=new Set(certified.ids);
const records=filterDirectLibrary(Array.isArray(library.aaps)?library.aaps:[],cfg)
  .filter(a=>a.lifecycleStatus==='ACTIVE'&&aidIsCertified(a,certifiedIds));
const visibleIds=new Set(records.map(a=>a.id));

const rel=p=>path.relative(SITE,p).split(path.sep).join('/');
await fs.rm(DIST,{recursive:true,force:true});
await fs.cp(SITE,DIST,{recursive:true,filter:src=>!excluded.has(rel(src))});

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
await fs.rm(partDir,{recursive:true,force:true});
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
  libraryMode:'CERTIFIED_OFFICIAL_ONLY',
  libraryCount:records.length,
  activeCount:records.length,
  archivedCount:0,
  count:records.length,
  certifiedSourceCount:certifiedIds.size,
  certifiedSourceIds:[...certifiedIds].sort(),
  certifiedGuichets:[...certified.guichets].sort((a,b)=>a.localeCompare(b,'fr'))
};
const manifest={
  version:library.meta?.version||cfg.version||null,
  generatedAt:library.meta?.generatedAt||null,
  count:records.length,
  meta:publicMeta,
  parts:partFiles
};
await fs.writeFile(path.join(DIST,'data','library-manifest.json'),JSON.stringify(manifest),'utf8');
await fs.writeFile(path.join(DIST,'data','manifest.json'),JSON.stringify(publicMeta,null,2)+'\n','utf8');

async function readJson(file,fallback){
  try{return JSON.parse(await fs.readFile(file,'utf8'))}catch{return fallback}
}

// Les artefacts publics dérivés ne doivent jamais exposer une source non certifiée.
const changes=await readJson(path.join(DATA,'changes.json'),[]);
await fs.writeFile(path.join(DIST,'data','changes.json'),JSON.stringify(changes.filter(x=>visibleIds.has(x.id))),'utf8');

const search=await readJson(path.join(DATA,'search-index.json'),null);
if(search?.rows){
  const rows=search.rows.filter(x=>visibleIds.has(x.id));
  await fs.writeFile(path.join(DIST,'data','search-index.json'),JSON.stringify({...search,count:rows.length,rows}),'utf8');
}

const sourcePayload={
  version:cfg.version,
  sourcePolicy:cfg.sourcePolicy,
  sources:(cfg.sources||[])
    .filter(s=>certifiedIds.has(s.id))
    .map(({id,name,scope,type,strategy,url,official,priority})=>({id,name,scope,type,strategy,url,official,priority}))
};
await fs.writeFile(path.join(DIST,'data','sources.json'),JSON.stringify(sourcePayload,null,2)+'\n','utf8');
await fs.writeFile(path.join(DIST,'data','certified-sources.json'),JSON.stringify({
  generatedAt:new Date().toISOString(),
  sourceIds:[...certifiedIds].sort(),
  guichets:[...certified.guichets].sort((a,b)=>a.localeCompare(b,'fr')),
  certificates:certified.certificates
},null,2)+'\n','utf8');

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
  internalRecords:Array.isArray(library.aaps)?library.aaps.length:0,
  publicCertifiedRecords:records.length,
  certifiedSources:[...certifiedIds].sort(),
  parts:partFiles.length,
  largestPart:Math.max(0,...await Promise.all(partFiles.map(async f=>(await fs.stat(path.join(DIST,'data',f))).size))),
  excluded:[...excluded]
},null,2));
