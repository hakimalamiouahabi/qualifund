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
const primary=new Set(lock.certification?.primarySourceIds||lock.allowedSourceIds||[]);
const cert=lock.certification||{};
let externalAudit=null,externalAuditError=null;
if(cert.externalAuditFile){
  try{
    externalAudit=JSON.parse(await fs.readFile(path.join(ROOT,cert.externalAuditFile),'utf8'));
  }catch(e){
    externalAuditError=e.message;
  }
}
const problems=[];
const generic=/^(document officiel|r[eè]glement|cahier des charges|annexe|formulaire|dossier de candidature|accueil|aides?|aides financières|catalogue|agir pour la transition)$/i;
const byId=new Map(coverage.map(x=>[x.id,x]));
const lockedCfg=(cfg.sources||[]).filter(s=>allowed.has(s.id));
const records=(lib.aaps||[]).filter(a=>primary.has(a?.sourceId));
const sourceRecordCounts=new Map();
for(const a of records)sourceRecordCounts.set(a.sourceId,(sourceRecordCounts.get(a.sourceId)||0)+1);

if(lockedCfg.length!==allowed.size)problems.push('Le verrou référence une source absente du registre.');

for(const s of lockedCfg){
  const row=byId.get(s.id);
  if(!row){problems.push(`${s.id}: aucune preuve de collecte`);continue}
  if(!row.success)problems.push(`${s.id}: collecte non validée — ${row.message||'sans message'}`);
  if(Number(row.imported||0)<Number(s.minImported||0))problems.push(`${s.id}: imports ${row.imported||0} < minimum ${s.minImported}`);
  if(cert.requireAuditAccounting&&!row.audit){
    problems.push(`${s.id}: audit comptable de collecte absent`);
  }else if(cert.requireAuditAccounting){
    const discovered=Number(row.audit.discovered??row.discovered??0);
    const imported=Number(row.audit.imported??row.imported??0);
    const excluded=Number(row.audit.excluded?.length||0);
    const errors=Number(row.audit.errors?.length||0);
    const accounted=Number(row.audit.accounted??(imported+excluded+errors));
    if(discovered!==accounted)problems.push(`${s.id}: ${discovered-accounted} page(s) découverte(s) non expliquée(s)`);
    const retained=Number(sourceRecordCounts.get(s.id)||0);
    if(imported!==retained)problems.push(`${s.id}: ${imported} fiche(s) importée(s) mais ${retained} fiche(s) conservée(s) dans la bibliothèque`);
  }
  if(cert.requireCatalogueDiscovery&&Number(row.audit?.channels?.catalogue||0)<=0)problems.push(`${s.id}: aucune fiche découverte via le catalogue officiel`);
  if(cert.requireRssDiscovery&&Number(row.audit?.channels?.rss||0)<=0)problems.push(`${s.id}: aucune fiche découverte via le RSS officiel`);
  if(cert.requireExternalAuditDiscovery&&Number(row.audit?.channels?.externalAudit||0)<=0)problems.push(`${s.id}: aucune URL issue du contre-audit externe n’a été prise en compte`);
  if(cert.requireZeroExtractionErrors&&Number(row.audit?.errors?.length||0)>0)problems.push(`${s.id}: ${row.audit.errors.length} erreur(s) d’extraction`);
}

if(cert.requireExternalAuditDiscovery){
  if(!externalAudit){
    problems.push('Contre-audit externe absent ou illisible'+(externalAuditError?` — ${externalAuditError}`:''));
  }else{
    const generated=Date.parse(externalAudit.generatedAt||'');
    const maxAge=Number(cert.externalAuditMaxAgeHours||0);
    if(!Number.isFinite(generated))problems.push('Contre-audit externe: date de génération invalide');
    else if(maxAge>0&&(Date.now()-generated)>(maxAge*3600000))problems.push(`Contre-audit externe périmé: plus de ${maxAge} h`);
    if(!Array.isArray(externalAudit.candidates)||!externalAudit.candidates.length)problems.push('Contre-audit externe: aucune URL candidate');
  }
}

const hosts=new Set((cert.allowedHosts||[]).map(x=>String(x).toLowerCase()));
for(const a of records){
  const title=String(a.title||'').replace(/\s+/g,' ').trim();
  if(cert.forbidGenericTitles&&(!title||generic.test(title)))problems.push(`${a.id}: intitulé générique ou absent`);
  const ev=Array.isArray(a?.verification?.fieldEvidence)?a.verification.fieldEvidence:[];
  if(cert.requireGuichetEvidence){
    const proof=ev.find(e=>e?.field==='guichet'&&['A','B'].includes(e?.sourceTier)&&e?.sourceUrl);
    if(a?.guichetVerified!==lock.name||!proof)problems.push(`${a.id}: attribution au guichet ${lock.name} non prouvée`);
    if(lock.name==='ADEME'&&(a?.operator!=='ADEME'||!Array.isArray(a?.funder)||!a.funder.includes('ADEME')))problems.push(`${a.id}: financeur/opérateur ADEME incohérent`);
  }
  if(cert.requireCurrentStatusEvidence){
    const allowedStates=new Set(cert.allowedSourceStates||[]);
    const proof=ev.find(e=>e?.field==='sourceStatus'&&['A','B'].includes(e?.sourceTier));
    if(!proof||!a?.sourceState||allowedStates.size&&!allowedStates.has(a.sourceState))problems.push(`${a.id}: statut actuel non prouvé (${a?.sourceState||'absent'})`);
  }
  if(cert.requireEnterpriseScope){
    const proof=ev.find(e=>e?.field==='enterpriseEligibility'&&['A','B'].includes(e?.sourceTier));
    if(a?.enterpriseEligible!==true||!proof)problems.push(`${a.id}: éligibilité entreprise non prouvée`);
  }
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

let externalCoverage={candidateCount:0,accounted:0,missing:[]};
if(cert.requireExternalAuditDiscovery&&externalAudit?.candidates?.length){
  const dispositions=new Set();
  for(const a of records)if(a?.officialPage)dispositions.add(String(a.officialPage).replace(/\/$/,''));
  for(const s of lockedCfg){
    const row=byId.get(s.id);
    for(const x of [...(row?.audit?.excluded||[]),...(row?.audit?.errors||[])])if(x?.url)dispositions.add(String(x.url).replace(/\/$/,''));
  }
  const candidates=[...new Set(externalAudit.candidates.map(x=>String(x?.url||'').replace(/\/$/,'')).filter(Boolean))];
  const missing=candidates.filter(u=>!dispositions.has(u));
  externalCoverage={candidateCount:candidates.length,accounted:candidates.length-missing.length,missing};
  if(missing.length)problems.push(`Contre-audit externe: ${missing.length} URL(s) candidate(s) sans disposition`);
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
  externalAudit:externalAudit?{generatedAt:externalAudit.generatedAt||null,engines:externalAudit.engines||[],...externalCoverage}:null,
  bySource:Object.fromEntries(lockedCfg.map(s=>[s.id,{
    discovered:Number(byId.get(s.id)?.discovered||0),
    imported:Number(byId.get(s.id)?.imported||0),
    retained:Number(sourceRecordCounts.get(s.id)||0),
    success:Boolean(byId.get(s.id)?.success),
    rss:Number(byId.get(s.id)?.audit?.channels?.rss||0),
    catalogue:Number(byId.get(s.id)?.audit?.channels?.catalogue||0),
    externalAudit:Number(byId.get(s.id)?.audit?.channels?.externalAudit||0),
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
