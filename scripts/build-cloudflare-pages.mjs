import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const SITE=path.join(ROOT,'site');
const DIST=path.join(ROOT,'dist');
const MAX_ASSET=24*1024*1024;
const TARGET_PART=18*1024*1024;
const excluded=new Set([
  'data/bootstrap.js',
  'data/library.json',
  'bibliotheque/qualifund-library.json',
  'bibliotheque/radar-library.json'
]);

const rel=p=>path.relative(SITE,p).split(path.sep).join('/');
await fs.rm(DIST,{recursive:true,force:true});
await fs.cp(SITE,DIST,{
  recursive:true,
  filter:src=>!excluded.has(rel(src))
});

const library=JSON.parse(await fs.readFile(path.join(SITE,'data','library.json'),'utf8'));
const records=Array.isArray(library.aaps)?library.aaps:[];
const parts=[];
let current=[],bytes=2;

for(const record of records){
  const encoded=JSON.stringify(record);
  const size=Buffer.byteLength(encoded,'utf8')+(current.length?1:0);
  if(current.length && bytes+size>TARGET_PART){
    parts.push(current);
    current=[];
    bytes=2;
  }
  current.push(record);
  bytes+=size;
}
if(current.length)parts.push(current);

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

const manifest={
  version:library.meta?.version||null,
  generatedAt:library.meta?.generatedAt||null,
  count:records.length,
  meta:library.meta||{},
  parts:partFiles
};
await fs.writeFile(path.join(DIST,'data','library-manifest.json'),JSON.stringify(manifest),'utf8');

async function walk(dir){
  const out=[];
  for(const entry of await fs.readdir(dir,{withFileTypes:true})){
    const p=path.join(dir,entry.name);
    if(entry.isDirectory())out.push(...await walk(p));
    else out.push(p);
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
  records:records.length,
  parts:partFiles.length,
  largestPart:Math.max(0,...await Promise.all(partFiles.map(async f=>(await fs.stat(path.join(DIST,'data',f))).size))),
  excluded:[...excluded]
},null,2));
