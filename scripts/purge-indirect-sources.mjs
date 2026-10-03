import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertDirectSources, filterDirectLibrary } from './lib/direct-sources.mjs';
import { buildCertificationLedger } from './lib/publication.mjs';
import { isActiveAtJPlusOne, jPlusOneDate } from './lib/jplus1.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=async(p,fallback)=>{try{return JSON.parse(await fs.readFile(p,'utf8'))}catch(e){if(e.code==='ENOENT')return fallback;throw e}};
const write=async(p,obj)=>{await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,JSON.stringify(obj,null,2)+'\n')};

export async function purgeIndirectSources(root=ROOT){
  const data=path.join(root,'site/data'),pub=path.join(root,'site/bibliotheque');
  const cfg=await read(path.join(root,'config/sources.json'),{});
  const lock=await read(path.join(root,'config/collection-lock.json'),{locked:false,allowedSourceIds:[]});
  assertDirectSources(cfg);

  const lib=await read(path.join(data,'library.json'),{meta:{},aaps:[]});
  const ledger=await buildCertificationLedger(data,cfg);
  const retainedSourceIds=new Set([
    ...(ledger.unlockedSourceIds||[]),
    ...(lock.locked&&Array.isArray(lock.allowedSourceIds)?lock.allowedSourceIds:[])
  ]);
  const direct=filterDirectLibrary(lib.aaps,cfg);
  const aaps=direct
    .filter(a=>retainedSourceIds.has(a?.sourceId))
    .map(a=>lib.meta?.sourcePolicy==='DIRECT_OFFICIAL_ONLY'
      ?a
      :{...a,verification:{...(a.verification||{}),status:'A_REVERIFIER'}}
    );
  const ids=new Set(aaps.map(a=>a.id));
  const active=aaps.filter(a=>String(a.lifecycleStatus||'').toUpperCase()==='ACTIVE');
  const activeJPlusOne=active.filter(a=>isActiveAtJPlusOne(a));
  const archived=aaps.filter(a=>String(a.lifecycleStatus||'').toUpperCase()==='ARCHIVE');
  const recommendationInstruments=['SUBVENTION','AVANCE_REMBOURSABLE','PRET_TAUX_ZERO'];
  const libraryInstruments=[...new Set(active.flatMap(a=>Array.isArray(a.aidTypes)?a.aidTypes:[]))].sort();
  const categoryCounts=Object.fromEntries(['STARTUP','PME','ETI','GE'].map(c=>[c,active.filter(a=>(a.companyCategories||[]).includes(c)).length]));
  const scopeCounts={NATIONAL:active.filter(a=>a.scope==='NATIONAL').length,REGIONAL:active.filter(a=>a.scope==='REGIONAL').length};
  const instrumentCounts=Object.fromEntries(libraryInstruments.map(t=>[t,active.filter(a=>(a.aidTypes||[]).includes(t)).length]));
  const targetInstrumentCount=active.filter(a=>(a.aidTypes||[]).some(x=>recommendationInstruments.includes(x))).length;
  const directLinkCount=active.filter(a=>/^https:\/\//i.test(String(a.officialPage||''))).length;
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
    version:cfg.version,
    generatedAt:lib.meta?.generatedAt||null,
    purgedAt:changed?new Date().toISOString():(lib.meta?.purgedAt||null),
    repositoryUrl:lib.meta?.repositoryUrl||null,
    sourcePolicy:'DIRECT_OFFICIAL_ONLY',
    libraryMode:'DIRECT_OFFICIAL_CATALOG',
    count:aaps.length,
    libraryCount:aaps.length,
    rawLibraryCount:aaps.length,
    activeCount:active.length,
    jPlusOneDate:jPlusOneDate(),
    jPlusOneActiveCount:activeJPlusOne.length,
    archivedCount:archived.length,
    staleCount:0,
    aapCount:activeJPlusOne.filter(a=>String(a.kind||'').includes('AAP')||String(a.kind||'').includes('AMI')).length,
    verifiedCount:activeJPlusOne.filter(a=>a.verification?.status==='VERIFIE').length,
    withCdc:activeJPlusOne.filter(a=>(a.cdcLinks||[]).length).length,
    withDeadline:activeJPlusOne.filter(a=>a.permanent||a.closingDate||a.finalClosingDate||(a.deadlines||[]).length).length,
    sourceCount:cfg.sources.length,
    activeCollectionSourceCount:Array.isArray(lock.allowedSourceIds)?lock.allowedSourceIds.length:0,
    libraryInstruments,
    recommendationInstruments,
    targetInstrumentCount,
    directLinkCount,
    missingDirectLinkCount:active.length-directLinkCount,
    categoryCounts,
    scopeCounts,
    instrumentCounts,
    targetRule:'ACTIVE_SANS_ECHEANCE_OU_PERMANENT_OU_CLOTURE_GTE_J_PLUS_1',
    targetCount:null,
    targetReached:null,
    coverageGap:null,
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
  const coverage=(await read(path.join(data,'coverage.json'),[]))
    .filter(x=>retainedSourceIds.has(x.id))
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
    certifiedSources:(ledger.unlockedSourceIds||[]).length,
    retainedSources:retainedSourceIds.size,
    contentSanitized:changed,
    lock:collectionLock.name
  }));
  return clean;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await purgeIndirectSources();
