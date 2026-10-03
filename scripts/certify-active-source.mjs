import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCollectionLock, validateCollectionLock } from './lib/collection-lock.mjs';
import { sourceConfigFingerprint, certificationBasisFingerprint, sourceDataFingerprint } from './lib/publication.mjs';
import { purgeIndirectSources } from './purge-indirect-sources.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DATA=path.join(ROOT,'site','data');
const cfg=JSON.parse(await fs.readFile(path.join(ROOT,'config','sources.json'),'utf8'));
const lock=await loadCollectionLock(ROOT);
validateCollectionLock(cfg,lock);
if(!lock?.locked)throw new Error('Aucun guichet/région n’est verrouillé.');

// Certifier uniquement le corpus final, après toutes les normalisations déterministes.
await purgeIndirectSources(ROOT);

const coverage=JSON.parse(await fs.readFile(path.join(DATA,'coverage.json'),'utf8'));
const lib=JSON.parse(await fs.readFile(path.join(DATA,'library.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(DATA,'manifest.json'),'utf8'));
const allowed=new Set(lock.allowedSourceIds||[]);
const primary=new Set(lock.certification?.primarySourceIds||lock.allowedSourceIds||[]);
const cert=lock.certification||{};
const problems=[];
const generic=/^(document officiel|r[eè]glement|cahier des charges|annexe|formulaire|dossier de candidature|accueil|aides?|aides financières|catalogue|agir pour la transition)$/i;
const byId=new Map(coverage.map(x=>[x.id,x]));
const lockedCfg=(cfg.sources||[]).filter(s=>allowed.has(s.id));
const records=(lib.aaps||[]).filter(a=>primary.has(a?.sourceId)||(Array.isArray(a?.sourceAliases)&&a.sourceAliases.some(x=>primary.has(x))));
const sourceRecordCounts=new Map();
for(const a of records){
  const ids=new Set([a?.sourceId,...(Array.isArray(a?.sourceAliases)?a.sourceAliases:[])].filter(x=>primary.has(x)));
  for(const id of ids)sourceRecordCounts.set(id,(sourceRecordCounts.get(id)||0)+1);
}

if(lockedCfg.length!==allowed.size)problems.push('Le verrou référence une source absente du registre.');

for(const s of lockedCfg){
  const row=byId.get(s.id);
  const rule=cert.sourceRules?.[s.id]||{};
  if(!row){problems.push(`${s.id}: aucune preuve de collecte`);continue}
  if(!row.success)problems.push(`${s.id}: collecte non validée — ${row.message||'sans message'}`);
  if(Number(row.imported||0)<Number(s.minImported||0))problems.push(`${s.id}: imports ${row.imported||0} < minimum ${s.minImported}`);
  const auditRequired=rule.requireAuditAccounting ?? cert.requireAuditAccounting;
  if(auditRequired&&!row.audit){
    problems.push(`${s.id}: audit comptable de collecte absent`);
  }else if(auditRequired){
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
  if(cert.requireCatalogueCompleteness){
    const found=Number(row.audit?.channels?.catalogue||0);
    const expected=Number(row.audit?.channels?.catalogueExpected||0);
    const mode=String(row.audit?.channels?.catalogueMode||'');
    const discoveryErrors=Number(row.audit?.channels?.catalogueDiscoveryErrors||0);
    const rssActive=Number(row.audit?.channels?.rssActive||0);
    const rssWithoutClosing=Number(row.audit?.channels?.rssWithoutClosing||0);
    if(!['CATALOGUE_HTML','RSS_ACTIVE_MIRROR'].includes(mode))problems.push(`${s.id}: mode d’inventaire ADEME non reconnu (${mode||'absent'})`);
    if(expected<=0)problems.push(`${s.id}: taille de l’inventaire officiel non déterminée`);
    else if(found!==expected)problems.push(`${s.id}: inventaire incomplet — ${found}/${expected} fiche(s) actives`);
    if(mode==='CATALOGUE_HTML'&&discoveryErrors>0)problems.push(`${s.id}: ${discoveryErrors} erreur(s) pendant la pagination du catalogue`);
    if(mode==='RSS_ACTIVE_MIRROR'){
      if(rssActive!==found)problems.push(`${s.id}: miroir RSS incohérent — ${rssActive} actives pour ${found} retenues`);
      if(rssWithoutClosing>0)problems.push(`${s.id}: ${rssWithoutClosing} entrée(s) RSS sans échéance exploitable`);
    }
  }
  if(cert.requireCatalogueClassification){
    const aap=Number(row.audit?.channels?.catalogueAap||0);
    const aide=Number(row.audit?.channels?.catalogueAid||0);
    const unclassified=Number(row.audit?.channels?.catalogueUnclassified||0);
    const total=Number(row.audit?.channels?.catalogue||0);
    if(unclassified>0)problems.push(`${s.id}: ${unclassified} fiche(s) du catalogue sans classification ADEME Aide/AAP`);
    if(aap<=0)problems.push(`${s.id}: aucun Appel à projet identifié par la classification du catalogue`);
    if(aap+aide!==total)problems.push(`${s.id}: classification catalogue incohérente — AAP ${aap} + aides ${aide} ≠ total ${total}`);
  }
  if(cert.requireRssDiscovery&&Number(row.audit?.channels?.rss||0)<=0)problems.push(`${s.id}: aucune fiche découverte via le RSS officiel`);

  if(rule.requireListingDiscovery&&Number(row.audit?.channels?.listing||0)<=0)problems.push(`${s.id}: listing maître Bpifrance vide`);
  if(rule.requireCatalogueSectionDiscovery&&Number(row.audit?.channels?.catalogueSection||0)<=0)problems.push(`${s.id}: section catalogue maître vide`);
  if(rule.requireEnterpriseCatalogueDiscovery&&Number(row.audit?.channels?.enterpriseCatalogue||0)<=0)problems.push(`${s.id}: catalogue régional Entreprise vide`);
  if(rule.requireExpectedCount){
    const found=Number(row.audit?.channels?.enterpriseCatalogue||0);
    const expected=Number(row.audit?.channels?.enterpriseExpected||rule.expectedCount||0);
    if(expected<=0)problems.push(`${s.id}: compteur officiel Entreprise absent`);
    else if(found!==expected)problems.push(`${s.id}: catalogue Entreprise incomplet — ${found}/${expected}`);
  }
  if(rule.requireImportedEqualsDiscovered){
    const discovered=Number(row.audit?.discovered??row.discovered??0);
    const imported=Number(row.audit?.imported??row.imported??0);
    if(discovered!==imported)problems.push(`${s.id}: ${imported}/${discovered} fiche(s) du référentiel maître importées`);
  }
  if(rule.minRetained!=null&&Number(sourceRecordCounts.get(s.id)||0)<Number(rule.minRetained))problems.push(`${s.id}: ${sourceRecordCounts.get(s.id)||0} fiche(s) conservée(s) < minimum ${rule.minRetained}`);
  if(cert.requireZeroExtractionErrors&&Number(row.audit?.errors?.length||0)>0)problems.push(`${s.id}: ${row.audit.errors.length} erreur(s) d’extraction`);
}

const hosts=new Set((cert.allowedHosts||[]).map(x=>String(x).toLowerCase()));
for(const a of records){
  const rule=cert.sourceRules?.[a?.sourceId]||{};
  const title=String(a.title||'').replace(/\s+/g,' ').trim();
  if(cert.forbidGenericTitles&&(!title||generic.test(title)))problems.push(`${a.id}: intitulé générique ou absent`);
  const ev=Array.isArray(a?.verification?.fieldEvidence)?a.verification.fieldEvidence:[];
  if(cert.requireGuichetEvidence||rule.requireGuichetEvidence){
    const proof=ev.find(e=>e?.field==='guichet'&&['A','B'].includes(e?.sourceTier)&&e?.sourceUrl);
    if(a?.guichetVerified!==lock.name||!proof)problems.push(`${a.id}: présence sur le portail ${lock.name} non prouvée`);
  }
  if(cert.requireCatalogueMasterMembership||rule.requireMasterMembership||rule.requireGuichetEvidence){
    const membership=ev.find(e=>e?.field==='catalogueMembership'&&['A','B'].includes(e?.sourceTier)&&e?.sourceUrl);
    const kindProof=ev.find(e=>e?.field==='catalogueKind'&&['A','B'].includes(e?.sourceTier));
    if((cert.requireCatalogueMasterMembership||rule.requireMasterMembership||rule.requireGuichetEvidence)&&(a?.catalogueVerified!==true||!membership))problems.push(`${a.id}: présence dans le référentiel maître ${lock.name} non prouvée`);
    if((cert.requireCatalogueMasterMembership||rule.allowedKinds)&&(!kindProof||!a?.kind))problems.push(`${a.id}: type de dispositif non prouvé`);
  }
  if(cert.requireCurrentStatusEvidence||rule.requireCurrentStatusEvidence){
    const allowedStates=new Set(rule.allowedSourceStates||cert.allowedSourceStates||[]);
    const proof=ev.find(e=>e?.field==='sourceStatus'&&['A','B'].includes(e?.sourceTier));
    if(!proof||!a?.sourceState||allowedStates.size&&!allowedStates.has(a.sourceState))problems.push(`${a.id}: statut actuel non prouvé (${a?.sourceState||'absent'})`);
  }
  if(rule.allowedKinds?.length&&!rule.allowedKinds.includes(a?.kind))problems.push(`${a.id}: type ${a?.kind||'absent'} hors règle ${rule.allowedKinds.join(', ')}`);
  if(rule.allowedAidTypes?.length){
    const allowedAidTypes=new Set(rule.allowedAidTypes);
    const actual=Array.isArray(a?.aidTypes)?a.aidTypes:[];
    if(!actual.length||actual.some(x=>!allowedAidTypes.has(x)))problems.push(`${a.id}: instrument(s) hors périmètre ${actual.join(', ')||'absent'}`);
  }
  if(rule.forbiddenTitleFragments?.length){
    const hit=rule.forbiddenTitleFragments.find(x=>title.toLowerCase().includes(String(x).toLowerCase()));
    if(hit)problems.push(`${a.id}: fiche fonds européen interdite dans ce cycle (${hit})`);
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
      const requiredPrefix=rule.requiredPathPrefix||cert.requiredPathPrefix;
      if(requiredPrefix&&!p.startsWith(requiredPrefix))problems.push(`${a.id}: chemin officiel inattendu ${p}`);
      if((cert.forbiddenPathFragments||[]).some(x=>p.includes(x)))problems.push(`${a.id}: page parasite interdite ${p}`);
    }catch{problems.push(`${a.id}: URL officielle invalide`)}
  }
}

let controlGaps={rssOutsideCatalogue:[]};
for(const s of lockedCfg){
  const row=byId.get(s.id);
  controlGaps={
    rssOutsideCatalogue:row?.audit?.controlGaps?.rssOutsideCatalogue||controlGaps.rssOutsideCatalogue
  };
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
  sourceConfigFingerprint:sourceConfigFingerprint(cfg,lockedCfg.map(s=>s.id)),
  certificationBasisFingerprint:await certificationBasisFingerprint(ROOT,cfg,lockedCfg.map(s=>s.id)),
  certifiedDataFingerprint:sourceDataFingerprint(lib.aaps||[],lockedCfg.map(s=>s.id)),
  libraryRecords:records.length,
  frozenUnselectedSha:manifest?.collectionLock?.frozenUnselectedSha||null,
  controlGaps,
  bySource:Object.fromEntries(lockedCfg.map(s=>[s.id,{
    discovered:Number(byId.get(s.id)?.discovered||0),
    imported:Number(byId.get(s.id)?.imported||0),
    retained:Number(sourceRecordCounts.get(s.id)||0),
    success:Boolean(byId.get(s.id)?.success),
    rss:Number(byId.get(s.id)?.audit?.channels?.rss||0),
    rssActive:Number(byId.get(s.id)?.audit?.channels?.rssActive||0),
    rssWithoutClosing:Number(byId.get(s.id)?.audit?.channels?.rssWithoutClosing||0),
    catalogue:Number(byId.get(s.id)?.audit?.channels?.catalogue||0),
    catalogueMode:String(byId.get(s.id)?.audit?.channels?.catalogueMode||''),
    listing:Number(byId.get(s.id)?.audit?.channels?.listing||0),
    catalogueSection:Number(byId.get(s.id)?.audit?.channels?.catalogueSection||0),
    sitemap:Number(byId.get(s.id)?.audit?.channels?.sitemap||0),
    enterpriseCatalogue:Number(byId.get(s.id)?.audit?.channels?.enterpriseCatalogue||0),
    enterpriseExpected:Number(byId.get(s.id)?.audit?.channels?.enterpriseExpected||0),
    enterprisePagesScanned:Number(byId.get(s.id)?.audit?.channels?.pagesScanned||0),
    europeanExcluded:Number(byId.get(s.id)?.audit?.channels?.europeanExcluded||0),
    catalogueExpected:Number(byId.get(s.id)?.audit?.channels?.catalogueExpected||0),
    catalogueAap:Number(byId.get(s.id)?.audit?.channels?.catalogueAap||0),
    catalogueAid:Number(byId.get(s.id)?.audit?.channels?.catalogueAid||0),
    catalogueUnclassified:Number(byId.get(s.id)?.audit?.channels?.catalogueUnclassified||0),
    cataloguePagesScanned:Number(byId.get(s.id)?.audit?.channels?.cataloguePagesScanned||0),
    catalogueHtmlFound:Number(byId.get(s.id)?.audit?.channels?.catalogueHtmlFound||0),
    catalogueHtmlExpected:Number(byId.get(s.id)?.audit?.channels?.catalogueHtmlExpected||0),
    detailWarnings:Number(byId.get(s.id)?.audit?.channels?.detailWarnings||0),
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
