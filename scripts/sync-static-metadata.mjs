import { purgeIndirectSources } from './purge-indirect-sources.mjs';
await purgeIndirectSources();

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aidIsCertified, writeCertifiedSourcesArtifact } from './lib/certified-sources.mjs';
import { filterDirectLibrary } from './lib/direct-sources.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DATA=path.join(ROOT,'site','data');
const PUB=path.join(ROOT,'site','bibliotheque');
const cfg=JSON.parse(await fs.readFile(path.join(ROOT,'config','sources.json'),'utf8'));
const version=cfg.version;
const libraryPath=path.join(DATA,'library.json');
const library=JSON.parse(await fs.readFile(libraryPath,'utf8'));
const all=Array.isArray(library.aaps)?library.aaps:[];
const active=all.filter(a=>a.lifecycleStatus==='ACTIVE');

const meta={
  ...(library.meta||{}),
  version,
  libraryCount:all.length,
  activeCount:active.length,
  archivedCount:all.filter(a=>a.lifecycleStatus==='ARCHIVE').length,
  sourceCount:(cfg.sources||[]).length,
  count:all.length
};
library.meta=meta;
await fs.writeFile(libraryPath,JSON.stringify(library),'utf8');
await fs.writeFile(path.join(DATA,'manifest.json'),JSON.stringify(meta,null,2)+'\n','utf8');

const certified=await writeCertifiedSourcesArtifact(ROOT,cfg);
const certifiedIds=new Set(certified.sourceIds);
const publicAids=filterDirectLibrary(active,cfg).filter(a=>aidIsCertified(a,certifiedIds));
const publicSources=(cfg.sources||[]).filter(s=>certifiedIds.has(s.id));
const publicMeta={
  version,
  generatedAt:meta.generatedAt||null,
  sourcePolicy:cfg.sourcePolicy,
  libraryMode:'CERTIFIED_OFFICIAL_ONLY',
  libraryCount:publicAids.length,
  activeCount:publicAids.length,
  archivedCount:0,
  sourceCount:publicSources.length,
  certifiedSourceCount:certifiedIds.size,
  certifiedGuichets:certified.guichets,
  count:publicAids.length
};

const arr=v=>Array.isArray(v)?v:[];
const csvEsc=v=>`"${String(v??'').replaceAll('"','""')}"`;
const csvRows=[['id','titre','type','portee','regions','financeurs','instruments','beneficiaires','assiette_min','assiette_max','aide_min','aide_max','taux_min','taux_max','cloture','permanent','page_officielle','cdc','statut_verification','completude','confiance'].join(',')];
for(const a of publicAids)csvRows.push([
  a.id,a.title,a.kind,a.scope,arr(a.regions).join(' | '),arr(a.funder).join(' | '),arr(a.aidTypes).join(' | '),
  arr(a.companyCategories).join(' | '),a.minimumProjectCost??'',a.maximumProjectCost??'',a.aidAmount?.min??'',
  a.aidAmount?.max??'',a.aidRate?.min??'',a.aidRate?.max??'',a.finalClosingDate||a.closingDate||'',
  a.permanent?'oui':'non',a.officialPage||'',arr(a.cdcLinks).map(x=>x.url).join(' | '),a.verification?.status||'',
  a.verification?.completeness??'',a.verification?.confidence??''
].map(csvEsc).join(','));
await fs.mkdir(PUB,{recursive:true});
await fs.writeFile(path.join(PUB,'radar-library.csv'),csvRows.join('\n'),'utf8');
await fs.writeFile(path.join(PUB,'status.json'),JSON.stringify({
  ...publicMeta,
  recommendationRule:'échéance >= J+1 ou permanent vérifié',
  instruments:['SUBVENTION','AVANCE_REMBOURSABLE','PRET_TAUX_ZERO']
},null,2)+'\n','utf8');

const publicSourcePayload={
  version,
  sourcePolicy:cfg.sourcePolicy,
  sources:publicSources.map(({id,name,scope,type,strategy,url,official,priority})=>({id,name,scope,type,strategy,url,official,priority}))
};
await fs.writeFile(path.join(DATA,'sources.json'),JSON.stringify(publicSourcePayload,null,2)+'\n','utf8');

// Supprimer définitivement les anciens artefacts lourds/dupliqués : le site charge les fragments certifiés.
for(const obsolete of [
  path.join(PUB,'radar-library.json'),
  path.join(PUB,'qualifund-library.json'),
  path.join(PUB,'qualifund-library.csv'),
  path.join(DATA,'bootstrap.js')
])await fs.rm(obsolete,{force:true});

const runtimeConfig=`(()=>{
  const server=window.FUNDING_RADAR_SERVER_CONFIG||window.LEYTON_RADAR_SERVER_CONFIG||{};
  const config={
    refreshEndpoint:server.refreshEndpoint||null,
    repositoryUrl:server.repositoryUrl||null,
    sirenApi:'https://recherche-entreprises.api.gouv.fr/search',
    companyEndpoint:server.companyEndpoint||null,
    version:'${version}'
  };
  window.FUNDING_RADAR_CONFIG=config;
  window.LEYTON_RADAR_CONFIG=config;
})();\n`;
await fs.writeFile(path.join(ROOT,'site','runtime-config.js'),runtimeConfig,'utf8');

const sw=`const CACHE='funding-radar-v${version}-shell';const SHELL=['./','./index.html','./styles.css','./app.js','./scoring-core.js','./manifest.webmanifest','./runtime-config.js'];self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)))});self.addEventListener('activate',e=>{e.waitUntil((async()=>{await Promise.all((await caches.keys()).filter(k=>k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim()})())});self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.pathname.includes('/data/')){e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request)));return}e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)))})\n`;
await fs.writeFile(path.join(ROOT,'site','sw.js'),sw,'utf8');

console.log(JSON.stringify({
  version,
  internalLibraryCount:all.length,
  publicCertifiedCount:publicAids.length,
  certifiedSources:certified.sourceIds,
  certifiedGuichets:certified.guichets
},null,2));
