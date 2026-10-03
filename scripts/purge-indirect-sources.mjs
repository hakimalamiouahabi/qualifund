import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertDirectSources, filterDirectLibrary } from './lib/direct-sources.mjs';
import { buildCertificationLedger, targetFunding, publicationReason, sourceConfigFingerprint, certificationBasisFingerprint, sourceDataFingerprint } from './lib/publication.mjs';
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
  const ledger=await buildCertificationLedger(data,cfg,{root});
  const historicalRejectedSourceIds=(ledger.rejectedCertifications||[]).flatMap(x=>x.sourceIds||[]);
  const retainedSourceIds=new Set([
    ...(ledger.unlockedSourceIds||[]),
    ...historicalRejectedSourceIds,
    ...(lock.locked&&Array.isArray(lock.allowedSourceIds)?lock.allowedSourceIds:[])
  ]);
  const beforeRecords=Array.isArray(lib.aaps)?lib.aaps:[];
  const direct=filterDirectLibrary(beforeRecords,cfg);
  const normalizeOperationalAid=a=>{
    const kind=String(a?.kind||'').toUpperCase();
    const isAap=kind.includes('AAP')||kind.includes('AMI');
    const allowed=new Set(['SUBVENTION','AVANCE_REMBOURSABLE','PRET_TAUX_ZERO','APPEL_A_PROJET']);
    const aidTypes=(Array.isArray(a?.aidTypes)?a.aidTypes:[]).filter(x=>allowed.has(x));
    if(isAap&&!aidTypes.includes('APPEL_A_PROJET'))aidTypes.push('APPEL_A_PROJET');
    return {...a,aidTypes:[...new Set(aidTypes)]};
  };
  const scoped=direct.filter(a=>retainedSourceIds.has(a?.sourceId));
  const outOfTarget=scoped.filter(a=>!targetFunding(a));
  const configuredSourceIds=new Set((cfg.sources||[]).map(s=>s.id));
  const certifiedSourceIds=new Set(ledger.unlockedSourceIds||[]);
  const currentLockIds=new Set(lock.locked&&Array.isArray(lock.allowedSourceIds)?lock.allowedSourceIds:[]);
  const targetScoped=scoped.filter(targetFunding).map(normalizeOperationalAid);
  const certifiedQuarantine=targetScoped.filter(a=>
    certifiedSourceIds.has(a?.sourceId)
    && !currentLockIds.has(a?.sourceId)
    && publicationReason(a,{configuredSourceIds,unlockedSourceIds:certifiedSourceIds})!==null
  );
  const aaps=targetScoped
    .filter(a=>
      currentLockIds.has(a?.sourceId)
      || !certifiedSourceIds.has(a?.sourceId)
      || publicationReason(a,{configuredSourceIds,unlockedSourceIds:certifiedSourceIds})===null
    )
    .map(a=>a)
    .map(a=>lib.meta?.sourcePolicy==='DIRECT_OFFICIAL_ONLY'
      ?a
      :{...a,verification:{...(a.verification||{}),status:'A_REVERIFIER'}}
    );
  const ids=new Set(aaps.map(a=>a.id));
  const active=aaps.filter(a=>String(a.lifecycleStatus||'').toUpperCase()==='ACTIVE');
  const activeJPlusOne=active.filter(a=>isActiveAtJPlusOne(a));
  const archived=aaps.filter(a=>String(a.lifecycleStatus||'').toUpperCase()==='ARCHIVE');
  const recommendationInstruments=['SUBVENTION','AVANCE_REMBOURSABLE','PRET_TAUX_ZERO','APPEL_A_PROJET'];
  const libraryInstruments=[...new Set(active.flatMap(a=>Array.isArray(a.aidTypes)?a.aidTypes:[]))].sort();
  const categoryCounts=Object.fromEntries(['STARTUP','PME','ETI','GE'].map(c=>[c,active.filter(a=>(a.companyCategories||[]).includes(c)).length]));
  const scopeCounts={NATIONAL:active.filter(a=>a.scope==='NATIONAL').length,REGIONAL:active.filter(a=>a.scope==='REGIONAL').length};
  const instrumentCounts=Object.fromEntries(libraryInstruments.map(t=>[t,active.filter(a=>(a.aidTypes||[]).includes(t)).length]));
  const targetInstrumentCount=active.filter(targetFunding).length;
  const directLinkCount=active.filter(a=>/^https:\/\//i.test(String(a.officialPage||''))).length;
  const migrated=lib.meta?.sourcePolicy==='DIRECT_OFFICIAL_ONLY';
  const changed=!migrated||aaps.length!==beforeRecords.length||JSON.stringify(aaps)!==JSON.stringify(beforeRecords);
  const currentPurgeStats={
    input:beforeRecords.length,
    afterDirectSanitization:direct.length,
    afterCertifiedScope:scoped.length,
    removedOutOfTarget:outOfTarget.length,
    removedCertifiedQuarantine:certifiedQuarantine.length,
    retainedOperational:aaps.length
  };
  const purgeStats=changed?currentPurgeStats:(lib.meta?.purgeStats||currentPurgeStats);
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
    purgeStats,
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
      'production-readiness.json','link-audit.json','deep-audit.json'
    ])await fs.rm(path.join(data,name),{force:true});
    for(const name of ['PRODUCTION_READINESS.md','REMEDIATION_REPORT.md','DATA_QUALITY_AUDIT.md']){
      await fs.rm(path.join(root,name),{force:true});
    }
    await fs.rm(path.join(pub,'rapports'),{recursive:true,force:true});
    await fs.rm(path.join(data,'library-parts'),{recursive:true,force:true});
    await fs.rm(path.join(data,'library-manifest.json'),{force:true});
    await fs.rm(path.join(root,'LEYTON-RADAR-v12.2.0-AUTONOME-LIVE.html'),{force:true});
  }

  // Le ledger est toujours reconstruit depuis les certificats + la configuration + le code
  // courant : aucun artefact de déverrouillage périmé ne survit à une purge sans changement de données.
  await write(path.join(data,'certification-ledger.json'),ledger);

  const activePath=path.join(data,'active-source-certification.json');
  const active=await read(activePath,null);
  const currentIds=Array.isArray(lock.allowedSourceIds)?[...lock.allowedSourceIds].sort():[];
  const activeIds=Array.isArray(active?.configuredSources)?[...active.configuredSources].sort():[];
  const sameIds=currentIds.length===activeIds.length&&currentIds.every((x,i)=>x===activeIds[i]);
  const currentSourceFingerprint=sourceConfigFingerprint(cfg,currentIds);
  const currentBasisFingerprint=await certificationBasisFingerprint(root,cfg,currentIds);
  const currentDataFingerprint=sourceDataFingerprint(aaps,currentIds);
  const activeIsCurrent=Boolean(
    lock.locked
    && active?.status==='PASS'
    && active?.lock?.name===lock.name
    && sameIds
    && active?.sourceConfigFingerprint===currentSourceFingerprint
    && active?.certificationBasisFingerprint===currentBasisFingerprint
    && active?.certifiedDataFingerprint===currentDataFingerprint
  );
  if(!activeIsCurrent){
    await write(activePath,{
      generatedAt:new Date().toISOString(),
      status:'PENDING',
      lock,
      configuredSources:currentIds,
      sourceConfigFingerprint:currentSourceFingerprint,
      certificationBasisFingerprint:currentBasisFingerprint,
      certifiedDataFingerprint:currentDataFingerprint,
      libraryRecords:aaps.filter(a=>currentLockIds.has(a?.sourceId)).length,
      problems:['Recertification requise sur la configuration et le code courants avant déverrouillage de publication.']
    });
  }

  console.log(JSON.stringify({
    sourcePolicy:cfg.sourcePolicy,
    before:lib.aaps?.length||0,
    retained:aaps.length,
    removed:beforeRecords.length-aaps.length,
    removedOutOfTarget:outOfTarget.length,
    removedCertifiedQuarantine:certifiedQuarantine.length,
    coverageRows:coverage.length,
    certifiedSources:(ledger.unlockedSourceIds||[]).length,
    retainedSources:retainedSourceIds.size,
    contentSanitized:changed,
    lock:collectionLock.name
  }));
  return clean;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await purgeIndirectSources();
