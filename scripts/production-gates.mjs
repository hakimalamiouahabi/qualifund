import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CRITICAL_FIELDS, evidenceCoverage, verificationStatus } from './lib/qa.mjs';
import { isActiveAtJPlusOne, jPlusOneDate } from './lib/jplus1.mjs';
import { buildCertificationLedger, isPublishableAid } from './lib/publication.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DATA=path.join(ROOT,'site','data');
const read=async(p,d)=>{try{return JSON.parse(await fs.readFile(p,'utf8'))}catch{return d}};
const lib=await read(path.join(DATA,'library.json'),{meta:{},aaps:[]});
const cov=await read(path.join(DATA,'coverage.json'),[]);
const health=await read(path.join(DATA,'source-health.json'),{summary:null,results:[]});
const cfg=await read(path.join(ROOT,'config','sources.json'),{sources:[]});
const lock=await read(path.join(ROOT,'config','collection-lock.json'),{locked:false,allowedSourceIds:[]});
const uat=await read(path.join(DATA,'uat-results.json'),{total:0,passed:0,results:[]});
const smoke=await read(path.join(DATA,'live-smoke.json'),{companyApi:{ok:false},publicSite:{ok:false}});
const remediation=await read(path.join(DATA,'remediation.json'),null);
const deepAudit=await read(path.join(DATA,'deep-audit.json'),null);
let ledger=await read(path.join(DATA,'certification-ledger.json'),null);
if(!ledger)ledger=await buildCertificationLedger(DATA,cfg);

const configuredSourceIds=new Set((cfg.sources||[]).map(s=>s.id));
const unlockedSourceIds=new Set(ledger.unlockedSourceIds||[]);
const raw=lib.aaps||[];
const published=raw.filter(a=>isPublishableAid(a,{configuredSourceIds,unlockedSourceIds}));
const active=published.filter(a=>a.lifecycleStatus!=='ARCHIVE');
const activeJPlusOne=active.filter(a=>isActiveAtJPlusOne(a));
const verifiedActive=activeJPlusOne.filter(a=>a.verification?.status==='VERIFIE');
const verified=verifiedActive.length;
const withCdc=activeJPlusOne.filter(a=>(a.cdcLinks||[]).length).length;
const withDeadline=activeJPlusOne.filter(a=>a.permanent||a.finalClosingDate||a.closingDate||(a.deadlines||[]).length).length;

const repo=process.env.GITHUB_REPOSITORY||lib.meta?.repositoryUrl||null;
const configuredPublicUrl=process.env.RADAR_PUBLIC_URL||process.env.VERCEL_URL||null;
const deployed=Boolean(smoke.publicSite?.ok);
const deployedUrl=smoke.publicSite?.url||configuredPublicUrl;
const covById=new Map((cov||[]).map(x=>[x.id,x]));
const ingestive=(cfg.sources||[]).filter(s=>s.official&&s.strategy!=='control-only');
const controls=(cfg.sources||[]).filter(s=>s.strategy==='control-only');
const currentIds=new Set(lock.locked?(lock.allowedSourceIds||[]):ingestive.map(s=>s.id));
const evaluated=ingestive.filter(s=>currentIds.has(s.id));
const cycleId=lib.meta?.collectionCycleId||null;
const libraryGeneratedAt=Date.parse(lib.meta?.generatedAt||'');
const coverageIsFresh=row=>{
  if(!row)return false;
  if(cycleId&&row.cycleId)return String(row.cycleId)===String(cycleId);
  const checked=Date.parse(row.checkedAt||'');
  return Number.isFinite(checked)&&Number.isFinite(libraryGeneratedAt)&&Math.abs(libraryGeneratedAt-checked)<=6*3600*1000;
};
const executed=evaluated.filter(s=>covById.has(s.id));
const freshExecuted=evaluated.filter(s=>coverageIsFresh(covById.get(s.id)));
const successful=evaluated.filter(s=>coverageIsFresh(covById.get(s.id))&&covById.get(s.id)?.success);
const imported=evaluated.reduce((n,s)=>n+(coverageIsFresh(covById.get(s.id))?Number(covById.get(s.id)?.imported||0):0),0);
const controlExecuted=controls.filter(s=>covById.has(s.id)).length;
const cycleComplete=evaluated.length>0&&freshExecuted.length===evaluated.length;
const cycleSuccess=evaluated.length>0&&successful.length===evaluated.length;
const globalSuccess=ingestive.length>0&&ingestive.filter(s=>covById.get(s.id)?.success).length>=Math.ceil(ingestive.length*.9);
const gate3Pass=lock.locked?(cycleComplete&&cycleSuccess):globalSuccess;
const gate3Status=gate3Pass?'PASS':executed.length?'PARTIAL':'NOT_RUN';

const verifiedIntegrity=verifiedActive.filter(a=>verificationStatus(a)==='VERIFIE').length;
const verifiedEvidenceIntegrity=verifiedActive.filter(a=>{
  const coverage=evidenceCoverage(a);
  return CRITICAL_FIELDS.every(field=>['A','B'].includes(coverage[field]));
}).length;
const remediationFresh=Boolean(
  remediation&&
  remediation.version===(cfg.version||lib.meta?.version)&&
  remediation.activeFiches===active.length&&
  remediation.generatedAt
);
const gate4Pass=gate3Pass&&activeJPlusOne.length>0&&verified>0&&verifiedIntegrity===verified;
const gate5Pass=gate4Pass&&verifiedEvidenceIntegrity===verified&&remediationFresh;
const companyLiveOk=Boolean(smoke.companyApi?.ok);
const consultantCases=Number(uat.passed||0);
const p0=Array.isArray(deepAudit?.severity?.p0)?deepAudit.severity.p0:[];
const gate6Pass=p0.length===0;
const inActions=process.env.GITHUB_ACTIONS==='true';
const workflowEvent=String(process.env.GITHUB_EVENT_NAME||'');
const workflowLiveOk=Boolean(inActions&&repo&&gate3Pass&&['schedule','workflow_dispatch','push'].includes(workflowEvent));

const gates=[
  {id:1,name:'Dépôt GitHub et versionnement',status:repo?'PASS':'BLOCKED',detail:repo||'Aucun dépôt GitHub accessible/configuré.'},
  {id:2,name:'URL permanente',status:deployed?'PASS':configuredPublicUrl?'READY':'BLOCKED',detail:deployed?`${deployedUrl} — smoke HTTP concluant.`:configuredPublicUrl?`${configuredPublicUrl} configurée mais non encore validée par smoke HTTP.`:'Déploiement permanent non confirmé.'},
  {id:3,name:lock.locked?`Cycle de collecte — ${lock.name||'verrou courant'}`:'Collecte réelle des sources',status:gate3Status,detail:lock.locked
    ?`${successful.length}/${evaluated.length} source(s) du verrou courant en succès sur le cycle ${cycleId||'non identifié'} ; ${freshExecuted.length}/${evaluated.length} ligne(s) coverage fraîches ; ${imported} imports bruts. Les autres sources restent gelées.`
    :`${ingestive.filter(s=>covById.has(s.id)).length}/${ingestive.length} sources officielles exécutées ; ${ingestive.filter(s=>covById.get(s.id)?.success).length} succès. Contrôles: ${controlExecuted}/${controls.length}.`},
  {id:4,name:'Bibliothèque certifiée publiable',status:gate4Pass?'PASS':gate3Pass?(verified?'PARTIAL':'FAIL'):(verified?'PARTIAL':'WAIT_LIVE'),detail:`${activeJPlusOne.length} fiches publiables J+1 sur ${raw.length} fiches brutes ; ${raw.length-published.length} en quarantaine. ${verified} strictement VÉRIFIÉES au ${jPlusOneDate()}. Intégrité recalculée ${verifiedIntegrity}/${verified}.`},
  {id:5,name:'Preuves documentaires par champ',status:gate5Pass?'PASS':gate3Pass?(verified?'PARTIAL':'FAIL'):'WAIT_LIVE',detail:`Preuves A/B complètes sur les champs critiques : ${verifiedEvidenceIntegrity}/${verified||0} fiches VÉRIFIÉES. File de remédiation synchronisée : ${remediationFresh?'oui':'non'}. CdC/règlement : ${withCdc}/${activeJPlusOne.length}.`},
  {id:6,name:'Intégrité, déduplication et périmètre',status:gate6Pass?'PASS':'FAIL',detail:gate6Pass?'Aucune anomalie P0 détectée par l’audit approfondi.':`${p0.length} anomalie(s) P0 : ${p0.join(' ; ')}`},
  {id:7,name:'Enrichissement SIREN/SIRET',status:companyLiveOk?'PASS':'READY',detail:companyLiveOk?'API Recherche d’entreprises DINUM validée par smoke live.':'Endpoint officiel disponible ; smoke live à confirmer.'},
  {id:8,name:'Qualification projet multi-financeurs',status:consultantCases>=5&&uat.total>=5?'PASS':'PARTIAL',detail:`Cas UAT réussis : ${consultantCases}/${uat.total||0}. Les résultats orientent l’instruction sans conclure à l’attribution.`},
  {id:9,name:'Exploitation automatisée',status:workflowLiveOk?'PASS':'PARTIAL',detail:workflowLiveOk?`Chaîne GitHub Actions exécutée sur ${workflowEvent} avec le verrou courant.`:'Workflow quotidien configuré ; exécution live du cycle courant à finaliser.'}
];
const preProductionPass=gates.every(g=>g.status==='PASS');
gates.push({id:10,name:'Recette production',status:preProductionPass?'PASS':'NOT_STARTED',detail:preProductionPass?'Gates 1–9 validées ; recette finale autorisée.':'Autorisation uniquement lorsque les Gates 1–9 sont PASS.'});

const summary={
  generatedAt:new Date().toISOString(),
  version:cfg.version||'unknown',
  mode:lock.locked?'LOCKED_CYCLE':'GLOBAL',
  currentLock:{locked:Boolean(lock.locked),name:lock.name||null,mode:lock.mode||null,allowedSourceIds:lock.allowedSourceIds||[]},
  publicationPolicy:'CERTIFIED_SOURCE_ONLY',
  gates,
  counts:{
    sourcesConfigured:cfg.sources.length,
    ingestiveSources:ingestive.length,
    controlSources:controls.length,
    certifiedSources:unlockedSourceIds.size,
    evaluatedSources:evaluated.length,
    executedSources:executed.length,
    freshExecutedSources:freshExecuted.length,
    successfulSources:successful.length,
    collectionCycleId:cycleId,
    rawLibrary:raw.length,
    publishedLibrary:published.length,
    quarantinedLibrary:raw.length-published.length,
    activeFiches:active.length,
    jPlusOneDate:jPlusOneDate(),
    jPlusOneActiveFiches:activeJPlusOne.length,
    verifiedFiches:verified,
    verifiedIntegrity,
    verifiedEvidenceIntegrity,
    withCdc,
    withDeadline,
    consultantCases,
    uatTotal:uat.total,
    companySmokeOk:companyLiveOk,
    publicSmokeOk:deployed,
    workflowEvent,
    inActions,
    remediationFresh,
    deepAuditP0:p0.length
  },
  goProduction:preProductionPass
};
await fs.mkdir(DATA,{recursive:true});
await fs.writeFile(path.join(DATA,'production-readiness.json'),JSON.stringify(summary,null,2),'utf8');
const md=[
  `# FUNDING RADAR — Production Readiness v${cfg.version||'unknown'}`,'',
  `Généré : ${summary.generatedAt}`,'',
  ...gates.map(g=>`- **Gate ${g.id} — ${g.name}** : ${g.status} — ${g.detail}`),'',
  `**GO PRODUCTION : ${summary.goProduction?'OUI':'NON'}**`
].join('\n');
await fs.writeFile(path.join(ROOT,'PRODUCTION_READINESS.md'),md,'utf8');
console.log(md);
