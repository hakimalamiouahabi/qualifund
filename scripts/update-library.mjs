import { filterDirectLibrary, isDirectAid, assertDirectSources } from './lib/direct-sources.mjs';
import { purgeIndirectSources } from './purge-indirect-sources.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectWebCatalog } from './connectors/web-catalog.mjs';
import { collectControl } from './connectors/control.mjs';
import { collectOpenDataSoft } from './connectors/opendatasoft.mjs';
import { collectOfficialPage } from './connectors/official-page.mjs';
import { collectBpifranceAaps, collectBpifranceAids } from './connectors/bpifrance.mjs';
import { collectAdeme } from './connectors/ademe.mjs';
import { enrichAid } from './lib/enrich.mjs';
import { mergeAid } from './lib/merge.mjs';
import { dedupe, canonicalKey } from './lib/dedupe.mjs';
import { qaAid, verificationStatus, completenessScore, confidenceScore, evidenceCoverage } from './lib/qa.mjs';
import { closeBrowser } from './lib/browser.mjs';
import { arr, nowIso, readJson, sha256, uniq, writeJsonAtomic } from './lib/utils.mjs';
import { assessCollection } from './lib/source-cycle.mjs';
import { shouldMarkStale } from './lib/lifecycle.mjs';
import { loadCollectionLock, validateCollectionLock, selectSources, selectedSourceSet, lockSummary } from './lib/collection-lock.mjs';
import { isActiveAtJPlusOne, jPlusOneDate } from './lib/jplus1.mjs';
const KNOWN_AID_TYPES=new Set(['SUBVENTION','AVANCE_REMBOURSABLE','PRET_TAUX_ZERO','PRET','BONIFICATION_INTERET','GARANTIE','ALLEGEMENT_FISCAL','PARTICIPATION_CAPITAL','APPEL_A_PROJET','ACCOMPAGNEMENT_GRATUIT','CREDIT_BAIL','AUTRE']);
function sanitizeAidTypes(xs=[]){const vals=arr(xs).filter(x=>typeof x==='string'&&x);const known=vals.filter(x=>KNOWN_AID_TYPES.has(x));return uniq(known.length?known:['AUTRE']);}
function unusableAidTitle(v=''){const t=String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,"'").replace(/\s+/g,' ').trim();return !t||t.length<4||/(desole.*offre.*plus disponible|offre.*plus disponible|document officiel|page introuvable|page non trouvee|erreur 404|404 not found|access denied|forbidden|service indisponible|site en maintenance)/i.test(t);}
function repairTitleSpacing(text=''){
  let s=String(text||'').replace(/\s+/g,' ').trim();
  for(let i=0;i<3;i++)s=s.replace(/\b([A-ZÀ-ÖØ-Ý]{2,})\s+([ÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ])\s+([A-ZÀ-ÖØ-Ý]{2,})\b/g,'$1$2$3');
  return s;
}
function repairAidTitle(a){
  if(!a||!unusableAidTitle(a.title))return a;
  const candidates=[
    ...arr(a.sourceAliases).map(x=>typeof x==='string'?x:x?.label),
    ...arr(a.cdcLinks).map(x=>typeof x==='string'?x:x?.label),
    ...arr(a.regulationLinks).map(x=>typeof x==='string'?x:x?.label),
    ...arr(a.sourceLinks).map(x=>typeof x==='string'?null:x?.label)
  ].filter(Boolean).map(repairTitleSpacing)
   .map(x=>x.replace(/^(?:r[eè]glement|cahier des charges|cdc|dossier de candidature|annexe)\s*[-–—:]\s*/i,'').trim())
   .filter(x=>x.length>=12&&x.length<=190&&!unusableAidTitle(x));
  let title=candidates[0]||null;
  if(!title){
    const src=repairTitleSpacing(a.objective||'').replace(/^\d+\s+(?=[A-ZÀ-ÖØ-Ý])/,'');
    const cut=src.split(/\b(?:Délibération|Direction de|Règlement|REGLEMENT|ARTICLE\s+\d+|Art\.\s*\d+)/)[0].trim();
    const upper=(cut.match(/[A-ZÀ-ÖØ-Ý]/g)||[]).length,letters=(cut.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g)||[]).length;
    if(cut.length>=15&&cut.length<=190&&letters>=12&&upper/letters>.6)title=cut;
  }
  return title?{...a,title}:a;
}
function directOfficialUrl(a){
  const candidates=[a?.officialPage,...arr(a?.sourceLinks).map(x=>typeof x==='string'?x:x?.url),...arr(a?.formLinks).map(x=>typeof x==='string'?x:x?.url)];
  for(const raw of candidates){
    if(!/^https?:\/\//i.test(String(raw||'')))continue;
    try{
      const u=new URL(raw),host=u.hostname.toLowerCase(),p=(u.pathname||'/').toLowerCase().replace(/\/+$/,'')||'/';
      if(/data\.aides-entreprises\.fr$/.test(host)&&(/^\/stock$/.test(p)||/^\/files\/aides\.json$/.test(p)))continue;
      if(['/','/catalogue','/aides','/les-aides','/vos-aides','/appels','/fr/appels'].includes(p))continue;
      return u.href;
    }catch{}
  }
  return null;
}

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),SITE=path.join(ROOT,'site'),DATA=path.join(SITE,'data'),FULL=process.argv.includes('--full')||(process.env.LEYTON_RADAR_FULL_REFRESH==='1'||process.env.QUALIFUND_FULL_REFRESH==='1');const log=(...x)=>console.log(new Date().toISOString(),...x);
const previous=await readJson(path.join(DATA,'library.json'),{meta:{},aaps:[]}),previousCoverage=await readJson(path.join(DATA,'coverage.json'),[]),prevCov=new Map(previousCoverage.map(x=>[x.id,x])),prevMap=new Map((previous.aaps||[]).map(a=>[canonicalKey(a),a])),cfg=await readJson(path.join(ROOT,'config','sources.json'),{sources:[]});
const collectionLock=await loadCollectionLock(ROOT);validateCollectionLock(cfg,collectionLock);
if(!collectionLock.locked)await purgeIndirectSources();
const sourcesToRun=selectSources(cfg,collectionLock),selectedIds=selectedSourceSet(collectionLock),coverage=[],changes=[];
const frozenDigest=list=>sha256(JSON.stringify(arr(list).filter(a=>!selectedIds.has(a?.sourceId)).map(a=>a).sort((a,b)=>String(a.id||'').localeCompare(String(b.id||'')))));
const frozenBeforeSha=collectionLock.locked?frozenDigest(previous.aaps||[]):null;
const current=collectionLock.locked
  ? new Map((previous.aaps||[]).filter(a=>!selectedIds.has(a?.sourceId)).map(a=>[canonicalKey(a),a]))
  : new Map(prevMap);
const cycleSeenKeys=new Set();
log('Collection lock',lockSummary(collectionLock));
function withTimeout(p,ms,label){return Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error(`timeout ${label} ${ms}ms`)),ms))])}
async function collect(source){const ctx={log};switch(source.strategy){case'catalog-html':return collectWebCatalog({...source,browserFallback:true},ctx);case'opendatasoft':return collectOpenDataSoft(source,ctx);case'official-page':return collectOfficialPage(source,ctx);case'bpifrance-aap':return collectBpifranceAaps(source,ctx);case'bpifrance-aides':return collectBpifranceAids(source,ctx);case'ademe-official':return collectAdeme(source,ctx);case'control-only':return collectControl(source,ctx);default:throw new Error('Stratégie de collecte non autorisée: '+source.strategy)}}
assertDirectSources(cfg);
const sourceRuns=new Array(sourcesToRun.length);
let sourceCursor=0;
const sourceWorkerCount=Math.max(1,Math.min(8,Number(process.env.QUALIFUND_SOURCE_WORKERS||4)));
log(`Collecte sources: ${sourcesToRun.length}/${cfg.sources.length} sources avec ${sourceWorkerCount} workers`);
const sourceWorkers=Array.from({length:sourceWorkerCount},async()=>{
  while(true){
    const i=sourceCursor++;
    if(i>=sourcesToRun.length)return;
    const source=sourcesToRun[i],started=Date.now(),old=prevCov.get(source.id);
    log(`[collecte ${i+1}/${sourcesToRun.length}] ${source.name}`);
    try{
      const r=await withTimeout(collect(source),source.priority===0?240000:160000,source.id);
      sourceRuns[i]={source,old,r,durationMs:Date.now()-started,error:null};
    }catch(error){
      sourceRuns[i]={source,old,r:null,assessment:null,durationMs:Date.now()-started,error};
    }
  }
});
await Promise.all(sourceWorkers);

// La fusion reste séquentielle et déterministe : même ordre que le registre maître.
for(let i=0;i<sourceRuns.length;i++){
  const run=sourceRuns[i],{source,old,r,durationMs,error}=run;
  log(`[fusion ${i+1}/${sourcesToRun.length}] ${source.name}`);
  if(error){
    log(`ANOMALIE ${source.id}: ${error.message}`);
    coverage.push({id:source.id,name:source.name,scope:source.scope,success:false,lifecycleSafe:false,emptyIngestion:false,suspiciousVolume:false,discovered:0,imported:0,message:`${error.message} — dernière version valide conservée.`,durationMs,checkedAt:nowIso(),lastSuccessfulAt:old?.lastSuccessfulAt||null,consecutiveFailures:(old?.consecutiveFailures||0)+1});
    continue;
  }
  const directAids=(r.aids||[]).filter(a0=>a0?.title&&isDirectAid(a0,cfg));
  const assessment=assessCollection(source,{...r,aids:directAids});
  const seen=new Set();
  for(const a0 of directAids){
    const a={...a0,lastSeenAt:nowIso(),sourceId:a0.sourceId||source.id,lifecycleStatus:a0.lifecycleStatus||'ACTIVE'};
    const k=canonicalKey(a);seen.add(k);cycleSeenKeys.add(k);
    const merged=current.has(k)?mergeAid(current.get(k),a):a;
    current.set(k,{...merged,lifecycleStatus:'ACTIVE',lastSeenAt:a.lastSeenAt});
  }
  if(assessment.lifecycleSafe){
    for(const[k,a]of current){
      if(shouldMarkStale({aid:a,sourceId:source.id,key:k,seenBySource:seen,seenInCycle:cycleSeenKeys,existedBefore:prevMap.has(k)})){
        current.set(k,{...a,lifecycleStatus:'STALE',attentionPoints:uniq([...(a.attentionPoints||[]),'Non retrouvé lors du dernier scan complet de ses sources : vérifier avant recommandation.'])});
      }
    }
  }
  const caution=assessment.reasons.length?`${assessment.reasons.join(' ; ')} — dernière version valide conservée. `:'';
  coverage.push({id:source.id,name:source.name,scope:source.scope,success:assessment.success,lifecycleSafe:assessment.lifecycleSafe,emptyIngestion:assessment.emptyIngestion,suspiciousVolume:assessment.suspiciousVolume,lowImportedCount:assessment.lowImportedCount,lowImportRatio:assessment.lowImportRatio,importRatio:assessment.importRatio,discovered:assessment.discovered,imported:assessment.imported,audit:r.audit||null,message:caution+(r.message||'OK'),durationMs,checkedAt:nowIso(),lastSuccessfulAt:assessment.success?nowIso():(old?.lastSuccessfulAt||null),consecutiveFailures:assessment.success?0:(old?.consecutiveFailures||0)+1});
}
let aids=[...current.values()];
const aidIsInActiveLock=a=>!collectionLock.locked||selectedIds.has(a?.sourceId);
let candidates=aids.filter(a=>aidIsInActiveLock(a)&&a.officialPage&&/^https?:/i.test(a.officialPage)&&a.lifecycleStatus!=='ARCHIVE');
candidates.sort((a,b)=>{
  const av=a.verification?.status==='VERIFIE'?1:0,bv=b.verification?.status==='VERIFIE'?1:0;
  if(av!==bv)return av-bv;
  const at=Date.parse(a.verification?.lastChecked||0)||0,bt=Date.parse(b.verification?.lastChecked||0)||0;
  if(at!==bt)return at-bt;
  return completenessScore(b)-completenessScore(a);
});
const enrichLimit=collectionLock.locked?candidates.length:Math.max(0,Number(process.env.QUALIFUND_ENRICH_LIMIT||process.env.LEYTON_RADAR_ENRICH_LIMIT||(FULL?180:80)));
const batch=candidates.slice(0,enrichLimit);
log(`Enrichissement officiel borné: ${batch.length}/${candidates.length} (limite ${enrichLimit})`);const enriched=new Map();let cursor=0;const workers=Array.from({length:6},async()=>{while(true){const i=cursor++;if(i>=batch.length)return;const a=batch[i];try{const e=await withTimeout(enrichAid(a,{log}),120000,`enrich ${a.id}`);enriched.set(canonicalKey(e),e)}catch(err){log(`Enrichissement ignoré ${a.title}: ${err.message}`)}}});await Promise.all(workers);for(const[k,a]of enriched)current.set(k,a);
const processedSelected=dedupe(filterDirectLibrary([...current.values()].filter(a=>aidIsInActiveLock(a)),cfg)).map(repairAidTitle)
  // Le guichet actif est normalisé ; les autres guichets restent strictement inchangés sous verrou.
  .filter(a=>!unusableAidTitle(a.title))
  .filter(a=>!arr(a.companyCategories).length||arr(a.companyCategories).some(x=>['STARTUP','PME','ETI','GE'].includes(x)))
  .filter(a=>['NATIONAL','REGIONAL'].includes(a.scope))
  .map(a=>({...a,themes:uniq(a.themes||[]),aidTypes:sanitizeAidTypes(a.aidTypes)}));
aids=collectionLock.locked
  ? [...(previous.aaps||[]).filter(a=>!selectedIds.has(a?.sourceId)),...processedSelected]
  : processedSelected;
if(collectionLock.locked){
  const frozenAfterSha=frozenDigest(aids);
  if(frozenBeforeSha!==frozenAfterSha)throw new Error(`LOCK SAFETY: un guichet/région non sélectionné a été modifié (${frozenBeforeSha} != ${frozenAfterSha})`);
}
const now=new Date();for(const a of aids){if(collectionLock.locked&&!selectedIds.has(a?.sourceId))continue;const final=a.finalClosingDate||a.closingDate;if(!a.permanent&&final&&new Date(final+'T23:59:59')<now&&a.lifecycleStatus!=='STALE')a.lifecycleStatus='ARCHIVE';else if(!a.lifecycleStatus)a.lifecycleStatus='ACTIVE';a.qaFlags=qaAid(a);a.verification={...(a.verification||{}),status:verificationStatus(a),lastChecked:a.verification?.lastChecked||null,completeness:completenessScore(a),confidence:confidenceScore(a),coverage:evidenceCoverage(a)};a.attentionPoints=uniq([...(a.attentionPoints||[]),...a.qaFlags.map(f=>({MISSING_DEADLINE:'Date/relèves non documentées.',MISSING_CDC:'Cahier des charges / règlement non rattaché.',MISSING_ELIGIBLE_EXPENSES:'Dépenses éligibles non documentées.',MISSING_PREREQUISITES:'Pré-requis non documentés.',MISSING_AID_TYPE:'Type d’aide à vérifier.',MISSING_BENEFICIARIES:'Bénéficiaires à vérifier.',MISSING_FINANCIAL_TERMS:'Modalités financières à vérifier.'}[f])).filter(Boolean)]);a.contentHash=sha256(JSON.stringify({...a,contentHash:undefined,verification:{...a.verification,lastChecked:undefined},lastSeenAt:undefined}))}aids.sort((a,b)=>String(a.title).localeCompare(String(b.title),'fr'));
const oldBy=new Map((previous.aaps||[]).map(a=>[canonicalKey(a),a])),newBy=new Map(aids.map(a=>[canonicalKey(a),a]));for(const[k,a]of newBy){const old=oldBy.get(k);if(!old)changes.push({type:'CREATION',id:a.id,title:a.title,at:nowIso()});else if(old.contentHash&&a.contentHash!==old.contentHash){const fields=['objective','themes','beneficiaries','aidTypes','aidSplit','aidRate','aidAmount','minimumProjectCost','maximumProjectCost','eligibleExpenses','excludedExpenses','prerequisites','selectionCriteria','deadlines','closingDate','finalClosingDate','disbursementTerms','repaymentTerms','stateAidRules','cdcLinks'];const changed=fields.filter(f=>JSON.stringify(old[f]??null)!==JSON.stringify(a[f]??null));changes.push({type:'MODIFICATION',id:a.id,title:a.title,fields:changed,at:nowIso()})}}for(const[k,a]of oldBy)if(!newBy.has(k))changes.push({type:'SORTIE_PERIMETRE',id:a.id,title:a.title,at:nowIso()});
const active=aids.filter(a=>a.lifecycleStatus!=='ARCHIVE');
const activeJPlusOne=active.filter(a=>isActiveAtJPlusOne(a));
const recommendationInstruments=['SUBVENTION','AVANCE_REMBOURSABLE','PRET_TAUX_ZERO'];
const libraryInstruments=uniq(active.flatMap(a=>arr(a.aidTypes))).sort();
const categoryCounts=Object.fromEntries(['STARTUP','PME','ETI','GE'].map(c=>[c,active.filter(a=>arr(a.companyCategories).includes(c)).length]));
const scopeCounts={NATIONAL:active.filter(a=>a.scope==='NATIONAL').length,REGIONAL:active.filter(a=>a.scope==='REGIONAL').length};
const instrumentCounts=Object.fromEntries(libraryInstruments.map(t=>[t,active.filter(a=>arr(a.aidTypes).includes(t)).length]));
const targetInstrumentCount=active.filter(a=>arr(a.aidTypes).some(x=>recommendationInstruments.includes(x))).length;
const directLinkCount=active.filter(a=>directOfficialUrl(a)).length;
const missingDirectLinks=active.filter(a=>!directOfficialUrl(a)).map(a=>({id:a.id,title:a.title,funder:arr(a.funder),scope:a.scope,regions:arr(a.regions),sourceId:a.sourceId}));
const targetCount=null;
const coverageFinal=collectionLock.locked
  ? cfg.sources.map(s=>coverage.find(x=>x.id===s.id)||prevCov.get(s.id)).filter(Boolean)
  : coverage;
const manifest={version:cfg.version||'unknown',generatedAt:nowIso(),repositoryUrl:process.env.GITHUB_REPOSITORY?`https://github.com/${process.env.GITHUB_REPOSITORY}`:previous.meta?.repositoryUrl||null,sourceCount:cfg.sources.length,sourcesOk:coverageFinal.filter(x=>x.success).length,sourcesFailed:coverageFinal.filter(x=>!x.success).length,activeCollectionSourceCount:sourcesToRun.length,collectionLock:{...lockSummary(collectionLock),frozenUnselectedSha:frozenBeforeSha},libraryCount:aids.length,activeCount:active.length,jPlusOneDate:jPlusOneDate(),jPlusOneActiveCount:activeJPlusOne.length,archivedCount:aids.length-active.length,aapCount:activeJPlusOne.filter(x=>String(x.kind).includes('AAP')).length,verifiedCount:activeJPlusOne.filter(x=>x.verification?.status==='VERIFIE').length,withCdc:activeJPlusOne.filter(x=>arr(x.cdcLinks).length).length,withDeadline:activeJPlusOne.filter(x=>x.permanent||x.closingDate||x.finalClosingDate||arr(x.deadlines).length).length,fullRefresh:FULL,libraryMode:'DIRECT_OFFICIAL_CATALOG',sourcePolicy:'DIRECT_OFFICIAL_ONLY',libraryInstruments,recommendationInstruments,targetInstrumentCount,directLinkCount,missingDirectLinkCount:missingDirectLinks.length,categoryCounts,scopeCounts,instrumentCounts,targetRule:'ACTIVE_SANS_ECHEANCE_OU_PERMANENT_OU_CLOTURE_GTE_J_PLUS_1',targetCount,targetReached:null,coverageGap:null,contentSha256:sha256(JSON.stringify(aids.map(x=>x.contentHash)))};
const prevCount=Number(previous.meta?.libraryCount||previous.aaps?.length||0);if(!aids.length)throw new Error('QA GATE: aucune fiche directe collectée');if(prevCount>400&&aids.length<prevCount*0.55)throw new Error(`QA GATE: baisse anormale ${prevCount} -> ${aids.length}`);if(!coverage.length)throw new Error('QA GATE: aucun connecteur exécuté');
if((previous.aaps||[]).length)await writeJsonAtomic(path.join(DATA,'library.previous.json'),previous);
const bpifranceCoverage=coverageFinal.filter(x=>String(x.id||'').startsWith('bpifrance'));
await writeJsonAtomic(path.join(DATA,'bpifrance-audit.json'),{
  generatedAt:manifest.generatedAt,
  collectionLock:lockSummary(collectionLock),
  sources:bpifranceCoverage,
  summary:{
    sources:bpifranceCoverage.length,
    success:bpifranceCoverage.filter(x=>x.success).length,
    discovered:bpifranceCoverage.reduce((n,x)=>n+Number(x.discovered||0),0),
    imported:bpifranceCoverage.reduce((n,x)=>n+Number(x.imported||0),0),
    errors:bpifranceCoverage.reduce((n,x)=>n+Number(x.audit?.errors?.length||0),0),
    excluded:bpifranceCoverage.reduce((n,x)=>n+Number(x.audit?.excluded?.length||0),0)
  }
});
await writeJsonAtomic(path.join(DATA,'library.json'),{meta:manifest,aaps:aids});await writeJsonAtomic(path.join(DATA,'link-audit.json'),{generatedAt:manifest.generatedAt,total:active.length,directLinkCount,missingDirectLinkCount:missingDirectLinks.length,missing:missingDirectLinks});await writeJsonAtomic(path.join(DATA,'coverage.json'),coverageFinal);const oldChanges=await readJson(path.join(DATA,'changes.json'),[]);await writeJsonAtomic(path.join(DATA,'changes.json'),[...oldChanges,...changes].slice(-1200));await writeJsonAtomic(path.join(DATA,'manifest.json'),manifest);await writeJsonAtomic(path.join(DATA,'sources.json'),{version:cfg.version||'unknown',sources:cfg.sources.map(({id,name,scope,type,strategy,url,official,priority,coveredBy,notes})=>({id,name,scope,type,strategy,url,official,priority,coveredBy:arr(coveredBy),notes:notes||null}))});
const PUBLIC_DIR=path.join(ROOT,'site','bibliotheque');await fs.mkdir(PUBLIC_DIR,{recursive:true});
const csvEsc=v=>`"${String(v??'').replaceAll('"','""')}"`;
const csvRows=[['id','titre','type','portee','regions','financeurs','instruments','beneficiaires','thematiques','assiette_min','assiette_max','aide_min','aide_max','taux_min','taux_max','taux_montants_par_taille','projets_attendus','depenses_eligibles','prerequis','criteres_selection','releves','cloture','permanent','page_officielle_directe','statut_lien_direct','cdc','statut_verification','completude','confiance'].join(',')];
for(const a of aids)csvRows.push([
  a.id,a.title,a.kind,a.scope,arr(a.regions).join(' | '),arr(a.funder).join(' | '),arr(a.aidTypes).join(' | '),arr(a.companyCategories).join(' | '),arr(a.themes).join(' | '),
  a.minimumProjectCost??'',a.maximumProjectCost??'',a.aidAmount?.min??'',a.aidAmount?.max??'',a.aidRate?.min??'',a.aidRate?.max??'',
  arr(a.aidAmount?.byCompanySize).concat(arr(a.aidRate?.byCompanySize)).map(x=>[x.category,x.rateMin??x.min??'',x.rateMax??x.max??'',x.amountMin??'',x.amountMax??''].join(':')).join(' | '),
  arr(a.projectsExpected).join(' | '),a.eligibleExpenses||'',a.prerequisites||'',a.selectionCriteria||'',
  arr(a.deadlines).map(x=>typeof x==='string'?x:(x?.date||'')).filter(Boolean).join(' | '),
  a.finalClosingDate||a.closingDate||'',a.permanent?'oui':'non',directOfficialUrl(a)||'',directOfficialUrl(a)?'LIEN_DIRECT':'A_RATTACHER',arr(a.cdcLinks).map(x=>x?.url||x).filter(Boolean).join(' | '),
  a.verification?.status||'',a.verification?.completeness??'',a.verification?.confidence??''
].map(csvEsc).join(','));
await fs.writeFile(path.join(PUBLIC_DIR,'radar-library.csv'),csvRows.join('\n'),'utf8');
await writeJsonAtomic(path.join(PUBLIC_DIR,'radar-library.json'),{meta:manifest,aaps:aids});
// Compatibilité v9 : conserver les anciens noms pendant la transition.
await fs.writeFile(path.join(PUBLIC_DIR,'qualifund-library.csv'),csvRows.join('\n'),'utf8');
await writeJsonAtomic(path.join(PUBLIC_DIR,'qualifund-library.json'),{meta:manifest,aaps:aids});
await writeJsonAtomic(path.join(PUBLIC_DIR,'status.json'),{...manifest,recommendationRule:'fiche ACTIVE sans échéance publiée, ou permanente, ou clôture >= J+1 ; STALE et ARCHIVE exclues',relevanceRule:'classement multi-critères des dispositifs ; éligibilité réglementaire et adéquation projet présentées séparément ; aucune probabilité d’obtention',libraryInstruments,recommendationInstruments});log('Terminé',manifest);await closeBrowser();

