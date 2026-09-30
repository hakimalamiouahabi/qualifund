import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCollectionLock, validateCollectionLock } from './lib/collection-lock.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DATA=path.join(ROOT,'site','data');
const cfg=JSON.parse(await fs.readFile(path.join(ROOT,'config','sources.json'),'utf8'));
const lock=await loadCollectionLock(ROOT);
validateCollectionLock(cfg,lock);
if(!lock?.locked)throw new Error('Aucun guichet/région n’est verrouillé.');

const coverage=JSON.parse(await fs.readFile(path.join(DATA,'coverage.json'),'utf8'));
const lib=JSON.parse(await fs.readFile(path.join(DATA,'library.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(DATA,'manifest.json'),'utf8'));
const allowed=new Set(lock.allowedSourceIds||[]);
const cert=lock.certification||{};
const problems=[];
const generic=/^(document officiel|r[eè]glement|cahier des charges|annexe|formulaire|dossier de candidature|accueil|aides?|catalogue)$/i;
const byId=new Map(coverage.map(x=>[x.id,x]));
const lockedCfg=(cfg.sources||[]).filter(s=>allowed.has(s.id));

if(lockedCfg.length!==allowed.size)problems.push('Le verrou référence une source absente du registre.');

for(const s of lockedCfg){
  const row=byId.get(s.id);
  if(!row){problems.push(`${s.id}: aucune preuve de collecte`);continue}
  if(!row.success)problems.push(`${s.id}: collecte non validée — ${row.message||'sans message'}`);
  if(Number(row.imported||0)<Number(s.minImported||0))problems.push(`${s.id}: imports ${row.imported||0} < minimum ${s.minImported}`);
  if(cert.requireAuditAccounting&&row.audit){
    const discovered=Number(row.audit.discovered??row.discovered??0);
    const accounted=Number(row.audit.accounted??0);
    if(discovered!==accounted)problems.push(`${s.id}: ${discovered-accounted} page(s) découverte(s) non expliquée(s)`);
  }
  if(cert.requireZeroExtractionErrors&&Number(row.audit?.errors?.length||0)>0)problems.push(`${s.id}: ${row.audit.errors.length} erreur(s) d’extraction`);
}

const hosts=new Set((cert.allowedHosts||[]).map(x=>String(x).toLowerCase()));
const primary=new Set(cert.primarySourceIds||lock.allowedSourceIds||[]);
const belongs=a=>{
  if(primary.has(a?.sourceId))return true;
  const funders=[...(Array.isArray(a?.funder)?a.funder:[]),a?.operator].filter(Boolean).map(x=>String(x).toLowerCase());
  if(funders.some(x=>x.includes(String(lock.name||'').toLowerCase())))return true;
  try{return hosts.has(new URL(a?.officialPage||'').hostname.toLowerCase())}catch{return false}
};
const records=(lib.aaps||[]).filter(belongs);

for(const a of records){
  const title=String(a.title||'').replace(/\s+/g,' ').trim();
  if(cert.forbidGenericTitles&&(!title||generic.test(title)))problems.push(`${a.id}: intitulé générique ou absent`);
  if(cert.requireDirectOfficialUrl){
    if(!/^https:\/\//i.test(String(a.officialPage||''))){problems.push(`${a.id}: page officielle directe absente`);continue}
    try{
      const u=new URL(a.officialPage),host=u.hostname.toLowerCase(),p=u.pathname;
      if(hosts.size&&!hosts.has(host))problems.push(`${a.id}: domaine non autorisé ${host}`);
      if(cert.requiredPathPrefix&&!p.startsWith(cert.requiredPathPrefix))problems.push(`${a.id}: chemin officiel inattendu ${p}`);
      if((cert.forbiddenPathFragments||[]).some(x=>p.includes(x)))problems.push(`${a.id}: page parasite interdite ${p}`);
    }catch{problems.push(`${a.id}: URL officielle invalide`)}
  }
}

const urlCounts=new Map();
for(const a of records){
  if(!a.officialPage)continue;
  const u=String(a.officialPage).replace(/\/$/,'');
  urlCounts.set(u,(urlCounts.get(u)||0)+1);
}
const duplicates=[...urlCounts].filter(([,n])=>n>1);
if(duplicates.length)problems.push(`${duplicates.length} URL(s) officielles dupliquée(s)`);

if(lock.preserveUnselectedSources&&!manifest?.collectionLock?.frozenUnselectedSha)problems.push('La preuve de gel des autres guichets/régions est absente.');

const slug=String(lock.name||'source').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const report={
  generatedAt:new Date().toISOString(),
  status:problems.length?'FAIL':'PASS',
  lock,
  configuredSources:lockedCfg.map(s=>s.id),
  libraryRecords:records.length,
  frozenUnselectedSha:manifest?.collectionLock?.frozenUnselectedSha||null,
  bySource:Object.fromEntries(lockedCfg.map(s=>[s.id,{
    discovered:Number(byId.get(s.id)?.discovered||0),
    imported:Number(byId.get(s.id)?.imported||0),
    success:Boolean(byId.get(s.id)?.success),
    errors:Number(byId.get(s.id)?.audit?.errors?.length||0),
    excluded:Number(byId.get(s.id)?.audit?.excluded?.length||0)
  }])),
  duplicates:duplicates.map(([url,count])=>({url,count})),
  problems
};
await fs.writeFile(path.join(DATA,`${slug}-certification.json`),JSON.stringify(report,null,2),'utf8');
await fs.writeFile(path.join(DATA,'active-source-certification.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify(report,null,2));
if(problems.length)process.exit(1);
