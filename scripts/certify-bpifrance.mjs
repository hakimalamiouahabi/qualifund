import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCollectionLock, validateCollectionLock } from './lib/collection-lock.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DATA=path.join(ROOT,'site','data');
const cfg=JSON.parse(await fs.readFile(path.join(ROOT,'config','sources.json'),'utf8'));
const lock=await loadCollectionLock(ROOT);
validateCollectionLock(cfg,lock);
const coverage=JSON.parse(await fs.readFile(path.join(DATA,'coverage.json'),'utf8'));
const lib=JSON.parse(await fs.readFile(path.join(DATA,'library.json'),'utf8'));
const allowed=new Set(lock.allowedSourceIds||[]);
const problems=[];
const generic=/^(document officiel|r[eè]glement|cahier des charges|annexe|formulaire|dossier de candidature)$/i;
const targetTypes=new Set(['SUBVENTION','AVANCE_REMBOURSABLE','PRET_TAUX_ZERO']);
const bpiCfg=(cfg.sources||[]).filter(s=>allowed.has(s.id));

if(!lock.locked||lock.name!=='Bpifrance')problems.push('Le verrou actif n’est pas Bpifrance.');
if(bpiCfg.length!==allowed.size)problems.push('Une source du verrou Bpifrance manque dans le registre.');

const byId=new Map(coverage.map(x=>[x.id,x]));
for(const s of bpiCfg){
  const row=byId.get(s.id);
  if(!row)problems.push(`${s.id}: aucune preuve de collecte`);
  else if(!row.success)problems.push(`${s.id}: collecte non validée — ${row.message||'sans message'}`);
  if(row?.audit){
    const accounted=Number(row.audit.accounted||0),discovered=Number(row.audit.discovered||row.discovered||0);
    if(accounted!==discovered)problems.push(`${s.id}: ${discovered-accounted} page(s) découverte(s) non expliquée(s)`);
    if((row.audit.errors||[]).length)problems.push(`${s.id}: ${row.audit.errors.length} erreur(s) d’extraction`);
  }
  if(Number(row?.imported||0)<Number(s.minImported||0))problems.push(`${s.id}: imports ${row?.imported||0} < minimum ${s.minImported}`);
  if(s.id==='bpifrance_aap'&&Number(row?.imported||0)!==Number(row?.discovered||0))problems.push(`bpifrance_aap: ${row?.imported||0}/${row?.discovered||0} pages importées`);
}

const records=(lib.aaps||[]).filter(a=>allowed.has(a.sourceId));
for(const a of records){
  const title=String(a.title||'').trim();
  if(!title||generic.test(title))problems.push(`${a.id}: intitulé générique ou absent`);
  if(!/^https:\/\//i.test(String(a.officialPage||'')))problems.push(`${a.id}: page officielle directe absente`);
  else {
    try{
      const host=new URL(a.officialPage).hostname.toLowerCase();
      if(!(host==='bpifrance.fr'||host.endsWith('.bpifrance.fr')))problems.push(`${a.id}: domaine non Bpifrance ${host}`);
    }catch{problems.push(`${a.id}: URL officielle invalide`)}
  }
  if(a.sourceId==='bpifrance_aides'&&!Array.isArray(a.aidTypes))problems.push(`${a.id}: instrument non structuré`);
  if(a.sourceId==='bpifrance_aides'&&!a.aidTypes?.some(t=>targetTypes.has(t)))problems.push(`${a.id}: instrument catalogue hors périmètre SUB/AR/PTZ`);
}

const duplicateUrls=new Map();
for(const a of records){
  if(!a.officialPage)continue;
  const u=a.officialPage.replace(/\/$/,'');
  duplicateUrls.set(u,(duplicateUrls.get(u)||0)+1);
}
const duplicates=[...duplicateUrls].filter(([,n])=>n>1);
if(duplicates.length)problems.push(`${duplicates.length} URL(s) Bpifrance dupliquée(s)`);

const report={
  generatedAt:new Date().toISOString(),
  status:problems.length?'FAIL':'PASS',
  lock,
  configuredSources:bpiCfg.map(s=>s.id),
  libraryRecords:records.length,
  bySource:Object.fromEntries(bpiCfg.map(s=>[s.id,{
    discovered:Number(byId.get(s.id)?.discovered||0),
    imported:Number(byId.get(s.id)?.imported||0),
    success:Boolean(byId.get(s.id)?.success),
    errors:Number(byId.get(s.id)?.audit?.errors?.length||0),
    excluded:Number(byId.get(s.id)?.audit?.excluded?.length||0)
  }])),
  duplicates:duplicates.map(([url,count])=>({url,count})),
  problems
};
await fs.writeFile(path.join(DATA,'bpifrance-certification.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify(report,null,2));
if(problems.length)process.exit(1);
