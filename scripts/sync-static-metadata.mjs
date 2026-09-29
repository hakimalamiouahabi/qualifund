import { purgeIndirectSources } from './purge-indirect-sources.mjs';
await purgeIndirectSources();
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DATA=path.join(ROOT,'site','data');
const PUB=path.join(ROOT,'site','bibliotheque');
const cfg=JSON.parse(await fs.readFile(path.join(ROOT,'config','sources.json'),'utf8'));
const version=cfg.version;
const libraryPath=path.join(DATA,'library.json');
const library=JSON.parse(await fs.readFile(libraryPath,'utf8'));
const actualCount=(library.aaps||[]).length;
const active=(library.aaps||[]).filter(a=>a.lifecycleStatus!=='ARCHIVE');
const meta={...(library.meta||{}),version,libraryCount:actualCount,activeCount:active.length,archivedCount:actualCount-active.length,sourceCount:(cfg.sources||[]).length};
// "count" était un ancien compteur ambigu. Il doit refléter le corpus réellement sérialisé.
meta.count=actualCount;
library.meta=meta;
const json=JSON.stringify(library,null,2)+'\n';
await fs.writeFile(libraryPath,json,'utf8');
await fs.writeFile(path.join(PUB,'radar-library.json'),json,'utf8');
await fs.writeFile(path.join(PUB,'qualifund-library.json'),json,'utf8');
// Régénérer aussi les exports CSV pour éviter un décalage avec library.json.
const arr=v=>Array.isArray(v)?v:[];
const csvEsc=v=>`"${String(v??'').replaceAll('\"','\"\"')}"`;
const csvRows=[['id','titre','type','portee','regions','financeurs','instruments','beneficiaires','assiette_min','assiette_max','aide_min','aide_max','taux_min','taux_max','cloture','permanent','page_officielle','cdc','statut_verification','completude','confiance'].join(',')];
for(const a of library.aaps||[]) csvRows.push([a.id,a.title,a.kind,a.scope,arr(a.regions).join(' | '),arr(a.funder).join(' | '),arr(a.aidTypes).join(' | '),arr(a.companyCategories).join(' | '),a.minimumProjectCost??'',a.maximumProjectCost??'',a.aidAmount?.min??'',a.aidAmount?.max??'',a.aidRate?.min??'',a.aidRate?.max??'',a.finalClosingDate||a.closingDate||'',a.permanent?'oui':'non',a.officialPage||'',arr(a.cdcLinks).map(x=>x.url).join(' | '),a.verification?.status||'',a.verification?.completeness??'',a.verification?.confidence??''].map(csvEsc).join(','));
await fs.writeFile(path.join(PUB,'radar-library.csv'),csvRows.join('\n'),'utf8');
await fs.writeFile(path.join(PUB,'qualifund-library.csv'),csvRows.join('\n'),'utf8');
await fs.writeFile(path.join(DATA,'manifest.json'),JSON.stringify(meta,null,2)+'\n','utf8');
const status={...meta,recommendationRule:'échéance >= J+1 ou permanent vérifié',relevanceRule:'pertinence projet >=85% ; éligibilité et confiance documentaire séparées',instruments:['SUBVENTION','AVANCE_REMBOURSABLE','PRET_TAUX_ZERO']};
await fs.writeFile(path.join(PUB,'status.json'),JSON.stringify(status,null,2)+'\n','utf8');
const publicSources={version,sources:(cfg.sources||[]).map(({id,name,scope,type,strategy,url,official,priority})=>({id,name,scope,type,strategy,url,official,priority}))};
await fs.writeFile(path.join(DATA,'sources.json'),JSON.stringify(publicSources,null,2)+'\n','utf8');
const bootstrap=`window.__LEYTON_RADAR_BOOTSTRAP__=${JSON.stringify({library,sources:publicSources})};\nwindow.__QUALIFUND_BOOTSTRAP__=window.__LEYTON_RADAR_BOOTSTRAP__;\n`;
await fs.writeFile(path.join(DATA,'bootstrap.js'),bootstrap,'utf8');
// Synchroniser également les artefacts de shell afin d'éviter toute dérive de version.
const runtimeConfig=`(()=>{
  const server=window.LEYTON_RADAR_SERVER_CONFIG||{};
  window.LEYTON_RADAR_CONFIG={
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
const sw=`const CACHE='leyton-radar-v${version}-shell';const SHELL=['./','./index.html','./styles.css','./app.js','./scoring-core.js','./manifest.webmanifest','./runtime-config.js'];self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)))});self.addEventListener('activate',e=>{e.waitUntil((async()=>{await Promise.all((await caches.keys()).filter(k=>k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim()})())});self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.pathname.includes('/data/')){e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request)));return}e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)))})
`;
await fs.writeFile(path.join(ROOT,'site','sw.js'),sw,'utf8');

console.log(JSON.stringify({version,libraryCount:actualCount,sourceCount:cfg.sources.length,generatedAt:meta.generatedAt},null,2));

