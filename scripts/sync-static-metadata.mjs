import { purgeIndirectSources } from './purge-indirect-sources.mjs';
await purgeIndirectSources();

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCertificationLedger, isPublishableAid, sourceConfigFingerprint, certificationBasisFingerprint } from './lib/publication.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DATA=path.join(ROOT,'site','data');
const PUB=path.join(ROOT,'site','bibliotheque');
const cfg=JSON.parse(await fs.readFile(path.join(ROOT,'config','sources.json'),'utf8'));
const lock=JSON.parse(await fs.readFile(path.join(ROOT,'config','collection-lock.json'),'utf8'));
const version=cfg.version;
const libraryPath=path.join(DATA,'library.json');
const library=JSON.parse(await fs.readFile(libraryPath,'utf8'));
const all=Array.isArray(library.aaps)?library.aaps:[];
const configuredSourceIds=new Set((cfg.sources||[]).map(s=>s.id));

const ledger=await buildCertificationLedger(DATA,cfg,{root:ROOT});
await fs.writeFile(path.join(DATA,'certification-ledger.json'),JSON.stringify(ledger,null,2)+'\n','utf8');
const unlockedSourceIds=new Set(ledger.unlockedSourceIds);
const published=all.filter(a=>isPublishableAid(a,{configuredSourceIds,unlockedSourceIds}));

const rawActive=all.filter(a=>a.lifecycleStatus==='ACTIVE');
const rawStale=all.filter(a=>a.lifecycleStatus==='STALE');
const publishedActive=published.filter(a=>a.lifecycleStatus==='ACTIVE');
const priorFrozen=library.meta?.collectionLock?.frozenUnselectedSha||null;
const collectionLock={
  locked:Boolean(lock.locked),
  mode:lock.mode||null,
  name:lock.name||null,
  allowedSourceIds:Array.isArray(lock.allowedSourceIds)?lock.allowedSourceIds:[],
  next:lock.next||null,
  frozenUnselectedSha:priorFrozen
};

const currentIds=new Set(collectionLock.allowedSourceIds);
const matchingCert=(ledger.certifications||[])
  .filter(c=>c?.status==='PASS'&&c?.sourceIds?.length&&c.sourceIds.every(id=>currentIds.has(id))&&currentIds.size===c.sourceIds.length)
  .sort((a,b)=>Date.parse(b.generatedAt||0)-Date.parse(a.generatedAt||0))[0]||null;
let activeCertification;
if(matchingCert){
  try{activeCertification=JSON.parse(await fs.readFile(path.join(DATA,matchingCert.file),'utf8'))}
  catch{activeCertification=null}
}
if(!activeCertification){
  const coverage=JSON.parse(await fs.readFile(path.join(DATA,'coverage.json'),'utf8').catch(()=> '[]'));
  const bySource={};
  for(const id of collectionLock.allowedSourceIds){
    const row=(coverage||[]).find(x=>x.id===id);
    if(row)bySource[id]={
      discovered:Number(row.discovered||0),imported:Number(row.imported||0),
      retained:Number(row.imported||0),errors:Number(row.audit?.errors?.length||0),
      excluded:Number(row.audit?.excluded?.length||0),
      rss:Number(row.audit?.channels?.rss||0),
      catalogue:Number(row.audit?.channels?.catalogue||row.audit?.channels?.enterpriseCatalogue||row.audit?.channels?.catalogueSection||row.audit?.channels?.listing||0)
    };
  }
  activeCertification={
    generatedAt:new Date().toISOString(),
    status:'PENDING',
    lock:collectionLock,
    configuredSources:collectionLock.allowedSourceIds,
    sourceConfigFingerprint:sourceConfigFingerprint(cfg,collectionLock.allowedSourceIds),
    certificationBasisFingerprint:await certificationBasisFingerprint(ROOT,cfg,collectionLock.allowedSourceIds),
    libraryRecords:0,
    bySource,
    duplicates:[],
    problems:['Certification du cycle courant non acquise. Les données de ce guichet/région restent hors publication tant que le statut PASS n’est pas généré.']
  };
}
await fs.writeFile(path.join(DATA,'active-source-certification.json'),JSON.stringify(activeCertification,null,2)+'\n','utf8');
const meta={
  ...(library.meta||{}),
  version,
  sourcePolicy:'DIRECT_OFFICIAL_ONLY',
  libraryMode:'DIRECT_OFFICIAL_CATALOG',
  libraryCount:all.length,
  rawLibraryCount:all.length,
  activeCount:rawActive.length,
  archivedCount:all.filter(a=>a.lifecycleStatus==='ARCHIVE').length,
  staleCount:rawStale.length,
  publishedCount:published.length,
  publishedActiveCount:publishedActive.length,
  quarantinedCount:all.length-published.length,
  certifiedSourceCount:ledger.unlockedSourceIds.length,
  certifiedSources:ledger.unlockedSourceIds,
  sourceCount:(cfg.sources||[]).length,
  collectionLock
};
meta.count=all.length;
library.meta=meta;
await fs.writeFile(libraryPath,JSON.stringify(library,null,2)+'\n','utf8');

await fs.mkdir(PUB,{recursive:true});

const arr=v=>Array.isArray(v)?v:[];
const csvEsc=v=>`"${String(v??'').replaceAll('"','""')}"`;
const csvRows=[['id','titre','type','portee','regions','financeurs','instruments','beneficiaires','assiette_min','assiette_max','aide_min','aide_max','taux_min','taux_max','cloture','permanent','page_officielle','cdc','statut_verification','completude','confiance'].join(',')];
for(const a of published)csvRows.push([
  a.id,a.title,a.kind,a.scope,arr(a.regions).join(' | '),arr(a.funder).join(' | '),arr(a.aidTypes).join(' | '),
  arr(a.companyCategories).join(' | '),a.minimumProjectCost??'',a.maximumProjectCost??'',a.aidAmount?.min??'',a.aidAmount?.max??'',
  a.aidRate?.min??'',a.aidRate?.max??'',a.finalClosingDate||a.closingDate||'',a.permanent?'oui':'non',a.officialPage||'',
  arr(a.cdcLinks).map(x=>x.url).join(' | '),a.verification?.status||'',a.verification?.completeness??'',a.verification?.confidence??''
].map(csvEsc).join(','));
await fs.writeFile(path.join(PUB,'radar-library.csv'),csvRows.join('\n'),'utf8');

await fs.writeFile(path.join(DATA,'manifest.json'),JSON.stringify(meta,null,2)+'\n','utf8');
const status={
  version,
  generatedAt:meta.generatedAt||null,
  publishedCount:published.length,
  publishedActiveCount:publishedActive.length,
  certifiedSourceCount:ledger.unlockedSourceIds.length,
  certifiedSources:ledger.unlockedSourceIds,
  sourcePolicy:'DIRECT_OFFICIAL_ONLY',
  publicationPolicy:'CERTIFIED_SOURCE_ONLY',
  instruments:['SUBVENTION','AVANCE_REMBOURSABLE','PRET_TAUX_ZERO','APPEL_A_PROJET'],
  qualificationRule:'éligibilité, critères et preuves officielles séparés',
  collectionLock
};
await fs.writeFile(path.join(PUB,'status.json'),JSON.stringify(status,null,2)+'\n','utf8');

const publicSources={
  version,
  generatedAt:ledger.generatedAt,
  sourcePolicy:'CERTIFIED_SOURCE_ONLY',
  sources:(cfg.sources||[])
    .filter(s=>unlockedSourceIds.has(s.id))
    .map(({id,name,scope,type,strategy,url,official,priority})=>({id,name,scope,type,strategy,url,official,priority}))
};
await fs.writeFile(path.join(DATA,'sources.json'),JSON.stringify(publicSources,null,2)+'\n','utf8');

// Le bootstrap historique embarquait ~50 Mo de données mais n'est plus chargé par index.html
// et est exclu du build Cloudflare. On le supprime pour éviter le poids et la dérive de cache.
await fs.rm(path.join(DATA,'bootstrap.js'),{force:true});

const runtimeConfig=`(()=>{
  const server=window.FUNDING_RADAR_SERVER_CONFIG||{};
  window.FUNDING_RADAR_CONFIG={
    refreshEndpoint:server.refreshEndpoint||null,
    repositoryUrl:server.repositoryUrl||null,
    sirenApi:'https://recherche-entreprises.api.gouv.fr/search',
    companyEndpoint:server.companyEndpoint||null,
    minRelevance:85,
    version:'${version}'
  };
})();
`;
await fs.writeFile(path.join(ROOT,'site','runtime-config.js'),runtimeConfig,'utf8');
const sw=`const CACHE='funding-radar-v${version}-shell';const SHELL=['./','./index.html','./styles.css','./app.js','./scoring-core.js','./manifest.webmanifest','./runtime-config.js'];self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)))});self.addEventListener('activate',e=>{e.waitUntil((async()=>{await Promise.all((await caches.keys()).filter(k=>k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim()})())});self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.pathname.includes('/data/')){e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request)));return}e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)))})
`;
await fs.writeFile(path.join(ROOT,'site','sw.js'),sw,'utf8');

console.log(JSON.stringify({
  version,
  rawLibraryCount:all.length,
  publishedCount:published.length,
  quarantinedCount:all.length-published.length,
  sourceCount:cfg.sources.length,
  certifiedSources:ledger.unlockedSourceIds,
  currentLock:collectionLock,
  generatedAt:meta.generatedAt
},null,2));
