import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isForbiddenAggregatorUrl } from './lib/direct-sources.mjs';
import { buildCertificationLedger, publicationReason, targetFunding, hasEnterpriseEvidence, hasGuichetEvidence, hasStatusEvidence, hasTargetInstrumentEvidence } from './lib/publication.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DATA=path.join(ROOT,'site','data');
const read=async(p,d)=>{try{return JSON.parse(await fs.readFile(p,'utf8'))}catch{return d}};
const cfg=await read(path.join(ROOT,'config','sources.json'),{sources:[],excludedSources:[]});
const lock=await read(path.join(ROOT,'config','collection-lock.json'),{});
const lib=await read(path.join(DATA,'library.json'),{meta:{},aaps:[]});
const coverage=await read(path.join(DATA,'coverage.json'),[]);
const manifest=await read(path.join(DATA,'manifest.json'),{});
const ledger=await buildCertificationLedger(DATA,cfg);

const rows=Array.isArray(lib.aaps)?lib.aaps:[];
const configured=new Set((cfg.sources||[]).map(s=>s.id));
const unlocked=new Set(ledger.unlockedSourceIds||[]);
const activeLifecycle=new Set(['ACTIVE','OPEN','OPEN_UNDATED','PERMANENT','']);
const generic=/^(?:accueil|home|aide|aides|dispositif|document|page|sans titre|nos aides|toutes nos aides|contact et aide)$/i;
const validCategories=new Set(['STARTUP','PME','ETI','GE']);
const dateRx=/^\d{4}-\d{2}-\d{2}$/;

const counters={
  raw:rows.length,publishable:0,quarantined:0,
  orphanSource:0,duplicateOfficialUrl:0,missingOfficialUrl:0,invalidOfficialUrl:0,forbiddenAggregator:0,
  genericTitle:0,outOfTargetInstrument:0,staleOrInactive:0,expiredButActive:0,dateInversion:0,
  regionalWithoutRegion:0,invalidCompanyCategory:0,
  noEvidence:0,noGuichetEvidence:0,noStatusEvidence:0,noInstrumentEvidence:0,noEnterpriseEvidence:0,
  sourceLinksAggregator:0,sourceLinksDuplicate:0
};
const reasons={};
const reasonSamples={};
const publishedQuality={
  noEvidence:0,noGuichetEvidence:0,noStatusEvidence:0,noInstrumentEvidence:0,noEnterpriseEvidence:0,
  expiredButActive:0,invalidCompanyCategory:0,regionalWithoutRegion:0
};
const publishedQualitySamples={};
const sample={};
const put=(key,item)=>{counters[key]++;(sample[key]??=[]);if(sample[key].length<20)sample[key].push(item)};
const putPublished=(key,item)=>{publishedQuality[key]++;(publishedQualitySamples[key]??=[]);if(publishedQualitySamples[key].length<20)publishedQualitySamples[key].push(item)};
const officialSeen=new Map(),publishedOfficialSeen=new Map(),publishedIdSeen=new Set();
const publishedDuplicates=[];
const now=Date.now();
for(const a of rows){
  const id=a?.id||null,title=String(a?.title||''),sourceId=a?.sourceId||null,url=String(a?.officialPage||'');
  const ref={id,title,sourceId,officialPage:url||null};
  const reason=publicationReason(a,{configuredSourceIds:configured,unlockedSourceIds:unlocked});
  if(reason){
    counters.quarantined++;reasons[reason]=(reasons[reason]||0)+1;(reasonSamples[reason]??=[]);
    if(reasonSamples[reason].length<20)reasonSamples[reason].push(ref);
  }else{
    counters.publishable++;
    const pu=String(url||'').replace(/\/$/,'');
    if(id&&publishedIdSeen.has(id))publishedDuplicates.push({type:'ID',value:id});
    else if(id)publishedIdSeen.add(id);
    if(pu&&publishedOfficialSeen.has(pu))publishedDuplicates.push({type:'URL',value:pu,otherId:publishedOfficialSeen.get(pu),id});
    else if(pu)publishedOfficialSeen.set(pu,id);
  }

  if(!configured.has(sourceId))put('orphanSource',ref);
  if(!url)put('missingOfficialUrl',ref);
  else{
    try{new URL(url)}catch{put('invalidOfficialUrl',ref)}
    if(isForbiddenAggregatorUrl(url))put('forbiddenAggregator',ref);
    const k=url.replace(/\/$/,'');
    if(officialSeen.has(k))put('duplicateOfficialUrl',{...ref,otherId:officialSeen.get(k)});else officialSeen.set(k,id);
  }
  if(!title.trim()||title.trim().length<4||generic.test(title.trim()))put('genericTitle',ref);
  if(!targetFunding(a))put('outOfTargetInstrument',ref);
  const life=String(a?.lifecycleStatus||'').toUpperCase();
  if(!activeLifecycle.has(life)&&life!=='ARCHIVE')put('staleOrInactive',{...ref,lifecycleStatus:life});
  const end=String(a?.finalClosingDate||a?.closingDate||'');
  if(dateRx.test(end)&&Date.parse(end+'T23:59:59Z')<now-60*86400000&&life!=='ARCHIVE')put('expiredButActive',{...ref,closingDate:end,lifecycleStatus:life});
  const start=String(a?.openingDate||'');
  if(dateRx.test(start)&&dateRx.test(end)&&start>end)put('dateInversion',{...ref,openingDate:start,closingDate:end});
  if(a?.scope==='REGIONAL'&&(!Array.isArray(a?.regions)||!a.regions.length))put('regionalWithoutRegion',ref);
  const badCat=(Array.isArray(a?.companyCategories)?a.companyCategories:[]).find(x=>!validCategories.has(x));
  if(badCat)put('invalidCompanyCategory',{...ref,category:badCat});

  const ev=Array.isArray(a?.verification?.fieldEvidence)?a.verification.fieldEvidence:[];
  const noEvidence=!ev.length;
  const noGuichet=!hasGuichetEvidence(a);
  const noStatus=!hasStatusEvidence(a);
  const noInstrument=!hasTargetInstrumentEvidence(a);
  const noEnterprise=!hasEnterpriseEvidence(a);
  if(noEvidence)put('noEvidence',ref);
  if(noGuichet)put('noGuichetEvidence',ref);
  if(noStatus)put('noStatusEvidence',ref);
  if(noInstrument)put('noInstrumentEvidence',ref);
  if(noEnterprise)put('noEnterpriseEvidence',ref);
  if(!reason){
    if(noEvidence)putPublished('noEvidence',ref);
    if(noGuichet)putPublished('noGuichetEvidence',ref);
    if(noStatus)putPublished('noStatusEvidence',ref);
    if(noInstrument)putPublished('noInstrumentEvidence',ref);
    if(noEnterprise)putPublished('noEnterpriseEvidence',ref);
    if(dateRx.test(end)&&Date.parse(end+'T23:59:59Z')<now-60*86400000&&life!=='ARCHIVE')putPublished('expiredButActive',{...ref,closingDate:end,lifecycleStatus:life});
    if(a?.scope==='REGIONAL'&&(!Array.isArray(a?.regions)||!a.regions.length))putPublished('regionalWithoutRegion',ref);
    if(badCat)putPublished('invalidCompanyCategory',{...ref,category:badCat});
  }

  const links=[...(a?.sourceLinks||[]),...(a?.cdcLinks||[]),...(a?.regulationLinks||[]),...(a?.formLinks||[])];
  const seen=new Set();
  let duplicate=false,aggregator=false;
  for(const x of links){
    const u=typeof x==='string'?x:x?.url;
    if(!u)continue;
    if(isForbiddenAggregatorUrl(u))aggregator=true;
    const k=String(u).replace(/\/$/,'');
    if(seen.has(k))duplicate=true;else seen.add(k);
  }
  if(aggregator)put('sourceLinksAggregator',ref);
  if(duplicate)put('sourceLinksDuplicate',ref);
}

const sourceUrlSeen=new Map(),sourceDuplicates=[];
for(const s of cfg.sources||[]){
  let k=String(s.url||'');
  try{const u=new URL(k);u.hash='';u.pathname=u.pathname.replace(/\/+$/,'')||'/';k=u.href.replace(/\/$/,'')}catch{}
  if(sourceUrlSeen.has(k))sourceDuplicates.push({url:k,a:sourceUrlSeen.get(k),b:s.id});else sourceUrlSeen.set(k,s.id);
}
const coverageIds=new Set((coverage||[]).map(x=>x.id));
const coverageOrphans=(coverage||[]).filter(x=>!configured.has(x.id)).map(x=>x.id);
const missingCurrentCoverage=(lock.allowedSourceIds||[]).filter(id=>!coverageIds.has(id));
const failedCoverage=(coverage||[]).filter(x=>x.success===false).map(x=>({id:x.id,message:x.message||'',discovered:x.discovered??null,imported:x.imported??null}));

const certFiles=['ademe-certification.json','bpifrance-certification.json'];
const historicalCertifications={};
for(const file of certFiles){
  const r=await read(path.join(DATA,file),null);
  historicalCertifications[file]=r?{status:r.status,generatedAt:r.generatedAt,problems:r.problems||[],libraryRecords:r.libraryRecords}:null;
}
const p0=[];
if(sourceDuplicates.length)p0.push(`${sourceDuplicates.length} URL(s) de source dupliquée(s)`);
if(coverageOrphans.length)p0.push(`${coverageOrphans.length} ligne(s) coverage pour des sources supprimées`);
if(manifest?.sourceCount!=null&&Number(manifest.sourceCount)!==(cfg.sources||[]).length)p0.push(`manifest.sourceCount=${manifest.sourceCount} ≠ config=${(cfg.sources||[]).length}`);
if(manifest?.collectionLock?.name&&manifest.collectionLock.name!==lock.name)p0.push(`manifest verrouillé sur "${manifest.collectionLock.name}" au lieu de "${lock.name}"`);
if(historicalCertifications['ademe-certification.json']?.status!=='PASS')p0.push('Certification ADEME non PASS');
if(historicalCertifications['bpifrance-certification.json']?.status!=='PASS')p0.push('Certification Bpifrance non PASS');
if(counters.forbiddenAggregator)p0.push(`${counters.forbiddenAggregator} page(s) officielle(s) pointent vers un agrégateur interdit`);
if(counters.orphanSource)p0.push(`${counters.orphanSource} fiche(s) rattachée(s) à une source absente du registre`);
if(publishedDuplicates.length)p0.push(`${publishedDuplicates.length} doublon(s) dans le corpus certifié publiable`);

const p1=[];
if(publishedQuality.expiredButActive)p1.push(`${publishedQuality.expiredButActive} fiche(s) publiable(s) ont une clôture ancienne malgré un statut actif`);
if(publishedQuality.noGuichetEvidence)p1.push(`${publishedQuality.noGuichetEvidence} fiche(s) publiable(s) sans preuve A/B de guichet`);
if(publishedQuality.noStatusEvidence)p1.push(`${publishedQuality.noStatusEvidence} fiche(s) publiable(s) sans preuve A/B de statut`);
if(publishedQuality.noEnterpriseEvidence)p1.push(`${publishedQuality.noEnterpriseEvidence} fiche(s) publiable(s) sans preuve A/B d’éligibilité entreprise`);
if(publishedQuality.regionalWithoutRegion)p1.push(`${publishedQuality.regionalWithoutRegion} fiche(s) régionale(s) publiable(s) sans région`);
if(publishedQuality.invalidCompanyCategory)p1.push(`${publishedQuality.invalidCompanyCategory} fiche(s) publiable(s) avec catégorie entreprise invalide`);

const p2=[];
if(counters.outOfTargetInstrument)p2.push(`${counters.outOfTargetInstrument} fiche(s) hors instrument cible conservées uniquement dans le stock brut`);
if(counters.expiredButActive)p2.push(`${counters.expiredButActive} fiche(s) brutes anciennes gardent un statut technique actif`);
if(counters.noStatusEvidence)p2.push(`${counters.noStatusEvidence} fiche(s) brutes sans preuve A/B de statut`);
if(counters.noInstrumentEvidence)p2.push(`${counters.noInstrumentEvidence} fiche(s) brutes sans preuve A/B d’instrument`);
if(counters.noEnterpriseEvidence)p2.push(`${counters.noEnterpriseEvidence} fiche(s) brutes sans preuve A/B d’éligibilité entreprise`);
if(failedCoverage.length)p2.push(`${failedCoverage.length} source(s) historiques en échec dans le coverage conservé`);
p2.push(`${counters.quarantined} fiche(s) brutes en quarantaine de publication`);

const report={
  generatedAt:new Date().toISOString(),
  version:cfg.version||null,
  currentLock:{name:lock.name||null,mode:lock.mode||null,allowedSourceIds:lock.allowedSourceIds||[]},
  publication:{policy:'CERTIFIED_SOURCE_ONLY',certifiedSourceIds:ledger.unlockedSourceIds||[],certifiedGuichets:ledger.guichets||[],reasons,reasonSamples},
  library:counters,
  publicationDuplicates:publishedDuplicates.slice(0,50),
  sourceRegistry:{
    configured:(cfg.sources||[]).length,
    duplicateUrls:sourceDuplicates,
    excludedStillConfigured:(cfg.sources||[]).filter(s=>(cfg.excludedSources||[]).includes(s.id)).map(s=>s.id)
  },
  coverage:{rows:(coverage||[]).length,orphans:coverageOrphans,missingCurrentCoverage,failedCount:failedCoverage.length,failed:failedCoverage.slice(0,80)},
  metadata:{
    manifestGeneratedAt:manifest?.generatedAt||null,
    manifestSourceCount:manifest?.sourceCount??null,
    manifestLock:manifest?.collectionLock||null
  },
  historicalCertifications,
  publishedQuality,
  severity:{p0,p1,p2},
  samples:{raw:sample,published:publishedQualitySamples}
};
await fs.writeFile(path.join(DATA,'deep-audit.json'),JSON.stringify(report,null,2)+'\n','utf8');
const md=[
  '# FUNDING RADAR — Audit approfondi de qualité des données','',
  `Généré : ${report.generatedAt}`,'',
  `- Stock brut : **${counters.raw}**`,
  `- Corpus publiable certifié : **${counters.publishable}**`,
  `- Quarantaine : **${counters.quarantined}**`,
  `- Sources configurées : **${report.sourceRegistry.configured}**`,
  `- Sources certifiées publiables : **${ledger.unlockedSourceIds.length}**`,'',
  '## P0 — incohérences bloquantes','',
  ...(p0.length?p0.map(x=>'- '+x):['- Aucune']),
  '','## P1 — dette de qualité à remédier','',
  ...(p1.length?p1.map(x=>'- '+x):['- Aucune']),
  '','## P2 — dette historique en quarantaine','',
  ...(p2.length?p2.map(x=>'- '+x):['- Aucune']),
  '','## Quarantaine par motif','',
  ...Object.entries(reasons).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`- ${k}: ${v}`)
].join('\n');
await fs.writeFile(path.join(ROOT,'DATA_QUALITY_AUDIT.md'),md+'\n','utf8');
console.log(JSON.stringify({
  generatedAt:report.generatedAt,
  raw:counters.raw,publishable:counters.publishable,quarantined:counters.quarantined,
  p0,p1,p2,
  publishedQuality,
  reasons,
  keyCounters:{
    orphanSource:counters.orphanSource,duplicateOfficialUrl:counters.duplicateOfficialUrl,
    forbiddenAggregator:counters.forbiddenAggregator,outOfTargetInstrument:counters.outOfTargetInstrument,
    expiredButActive:counters.expiredButActive,noStatusEvidence:counters.noStatusEvidence,
    noInstrumentEvidence:counters.noInstrumentEvidence,noEnterpriseEvidence:counters.noEnterpriseEvidence
  },
  samples:{
    outOfTargetCertified:reasonSamples.OUT_OF_TARGET_INSTRUMENT||[],
    inactiveCertified:reasonSamples.INACTIVE_OR_STALE||[],
    expiredButActive:sample.expiredButActive||[],
    published:publishedQualitySamples
  }
},null,2));
if(process.argv.includes('--strict')&&p0.length)process.exitCode=1;
