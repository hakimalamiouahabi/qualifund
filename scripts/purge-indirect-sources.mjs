import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertDirectSources, filterDirectLibrary } from './lib/direct-sources.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=async(p,fallback)=>{try{return JSON.parse(await fs.readFile(p,'utf8'))}catch(e){if(e.code==='ENOENT')return fallback;throw e}};
const write=async(p,obj)=>{await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,JSON.stringify(obj,null,2)+'\n')};

export async function purgeIndirectSources(root=ROOT){
  const data=path.join(root,'site/data'),pub=path.join(root,'site/bibliotheque');
  const cfg=await read(path.join(root,'config/sources.json'),{});
  const lock=await read(path.join(root,'config/collection-lock.json'),{locked:false,allowedSourceIds:[]});
  assertDirectSources(cfg);

  const lib=await read(path.join(data,'library.json'),{meta:{},aaps:[]});
  const aaps=filterDirectLibrary(lib.aaps,cfg).map(a=>
    lib.meta?.sourcePolicy==='DIRECT_OFFICIAL_ONLY'
      ?a
      :{...a,verification:{...(a.verification||{}),status:'A_REVERIFIER'}}
  );
  const ids=new Set(aaps.map(a=>a.id));
  const active=aaps.filter(a=>a.lifecycleStatus!=='ARCHIVE');
  const migrated=lib.meta?.sourcePolicy==='DIRECT_OFFICIAL_ONLY';
  const beforeRecords=lib.aaps||[];
  const changed=!migrated||aaps.length!==beforeRecords.length||JSON.stringify(aaps)!==JSON.stringify(beforeRecords);
  const collectionLock={
    locked:Boolean(lock.locked),
    mode:lock.mode||null,
    name:lock.name||null,
    allowedSourceIds:Array.isArray(lock.allowedSourceIds)?lock.allowedSourceIds:[],
    next:lock.next||null,
    frozenUnselectedSha:lib.meta?.collectionLock?.frozenUnselectedSha||null
  };
  const meta={
    ...(migrated?lib.meta:{}),
    version:cfg.version,
    generatedAt:lib.meta?.generatedAt||null,
    sourcePolicy:'DIRECT_OFFICIAL_ONLY',
    libraryMode:'DIRECT_OFFICIAL_CATALOG',
    repositoryUrl:lib.meta?.repositoryUrl||null,
    count:aaps.length,
    libraryCount:aaps.length,
    rawLibraryCount:aaps.length,
    activeCount:active.length,
    archivedCount:aaps.filter(a=>a.lifecycleStatus==='ARCHIVE').length,
    sourceCount:cfg.sources.length,
    verifiedCount:active.filter(a=>a.verification?.status==='VERIFIE').length,
    coverageCertified:false,
    collectionLock
  };
  if(lib.meta?.sourcePolicy!=='DIRECT_OFFICIAL_ONLY')meta.sourcePolicyAppliedAt=new Date().toISOString();
  else if(lib.meta.sourcePolicyAppliedAt)meta.sourcePolicyAppliedAt=lib.meta.sourcePolicyAppliedAt;

  const clean={meta,aaps};
  await write(path.join(data,'library.json'),clean);
  await write(path.join(data,'manifest.json'),meta);

  const changes=(await read(path.join(data,'changes.json'),[])).filter(x=>ids.has(x.id));
  await write(path.join(data,'changes.json'),changes);
  const allowed=new Set(cfg.sources.map(s=>s.id));
  const coverage=(await read(path.join(data,'coverage.json'),[]))
    .filter(x=>allowed.has(x.id))
    .map(x=>({...x,message:String(x.message||'').replace(/Aides Entreprises/gi,'ancienne source retirée')}));
  await write(path.join(data,'coverage.json'),coverage);
  await write(path.join(data,'curated-aids.json'),{aaps:[]});

  // Les exports publics sont générés uniquement par sync-static-metadata à partir du
  // corpus certifié. La purge ne doit jamais republier le stock brut.
  await fs.rm(path.join(data,'bootstrap.js'),{force:true});
  await fs.rm(path.join(data,'library.previous.json'),{force:true});

  if(changed){
    for(const name of [
      'search-index.json','criteria-audit.json','remediation.json','source-health.json',
      'production-readiness.json','link-audit.json','certification-ledger.json','deep-audit.json'
    ])await fs.rm(path.join(data,name),{force:true});
    await fs.rm(path.join(pub,'rapports'),{recursive:true,force:true});
    await fs.rm(path.join(data,'library-parts'),{recursive:true,force:true});
    await fs.rm(path.join(data,'library-manifest.json'),{force:true});
    await fs.rm(path.join(root,'LEYTON-RADAR-v12.2.0-AUTONOME-LIVE.html'),{force:true});
  }

  console.log(JSON.stringify({
    sourcePolicy:cfg.sourcePolicy,
    before:lib.aaps?.length||0,
    retained:aaps.length,
    removed:(lib.aaps?.length||0)-aaps.length,
    coverageRows:coverage.length,
    contentSanitized:changed,
    lock:collectionLock.name
  }));
  return clean;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await purgeIndirectSources();
