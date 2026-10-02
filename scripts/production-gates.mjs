import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CRITICAL_FIELDS, evidenceCoverage, verificationStatus } from './lib/qa.mjs';
import { isActiveAtJPlusOne, jPlusOneDate } from './lib/jplus1.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=async(p,d)=>{try{return JSON.parse(await fs.readFile(p,'utf8'))}catch{return d}};
const lib=await read(path.join(ROOT,'site','data','library.json'),{meta:{},aaps:[]});
const cov=await read(path.join(ROOT,'site','data','coverage.json'),[]);
const health=await read(path.join(ROOT,'site','data','source-health.json'),{summary:null,results:[]});
const cfg=await read(path.join(ROOT,'config','sources.json'),{sources:[]});
const uat=await read(path.join(ROOT,'site','data','uat-results.json'),{total:0,passed:0,results:[]});
const smoke=await read(path.join(ROOT,'site','data','live-smoke.json'),{companyApi:{ok:false},publicSite:{ok:false}});
const remediation=await read(path.join(ROOT,'site','data','remediation.json'),null);
const active=(lib.aaps||[]).filter(a=>a.lifecycleStatus==='ACTIVE');
const activeJPlusOne=active.filter(a=>isActiveAtJPlusOne(a));
const verifiedActive=activeJPlusOne.filter(a=>a.verification?.status==='VERIFIE');
const verified=verifiedActive.length;
const withCdc=activeJPlusOne.filter(a=>(a.cdcLinks||[]).length).length;
const withDeadline=activeJPlusOne.filter(a=>a.permanent||a.finalClosingDate||a.closingDate||(a.deadlines||[]).length).length;
const repo=process.env.GITHUB_REPOSITORY||lib.meta?.repositoryUrl||null;
const configuredPublicUrl=process.env.RADAR_PUBLIC_URL||'https://qualifund.pages.dev';
const deployed=Boolean(smoke.publicSite?.ok);
const deployedUrl=smoke.publicSite?.url||configuredPublicUrl;
const sourceCycles=cov.length;
const sourceSuccess=cov.filter(x=>x.success).length;
const ingestiveSources=(cfg.sources||[]).filter(s=>s.strategy!=='control-only');
const controlSources=(cfg.sources||[]).filter(s=>s.strategy==='control-only');
const covById=new Map(cov.map(x=>[x.id,x]));
const ingestiveExecuted=ingestiveSources.filter(s=>covById.has(s.id)).length;
const ingestiveSuccess=ingestiveSources.filter(s=>covById.get(s.id)?.success).length;
const ingestiveImported=ingestiveSources.reduce((n,s)=>n+Number(covById.get(s.id)?.imported||0),0);
const controlExecuted=controlSources.filter(s=>covById.has(s.id)).length;
const nonBootstrap=active.filter(a=>!String(a.id||'').startsWith('ae_')).length;
const consultantCases=Number(uat.passed||0);
const companyLiveOk=Boolean(smoke.companyApi?.ok);
const inActions=process.env.GITHUB_ACTIONS==='true';
const workflowEvent=String(process.env.GITHUB_EVENT_NAME||'');
const gate3Pass=ingestiveExecuted===ingestiveSources.length&&ingestiveSuccess>=Math.ceil(ingestiveSources.length*.9)&&controlExecuted===controlSources.length&&nonBootstrap>0;
const gate3Status=gate3Pass?'PASS':sourceCycles?'PARTIAL':'NOT_RUN';

// Recalculer la conformité VERIFIE plutôt que faire confiance à un statut sérialisé potentiellement ancien.
const verifiedIntegrity=verifiedActive.filter(a=>verificationStatus(a)==='VERIFIE').length;
const verifiedEvidenceIntegrity=verifiedActive.filter(a=>{
  const coverage=evidenceCoverage(a);
  return CRITICAL_FIELDS.every(f=>['A','B'].includes(coverage[f]));
}).length;
const remediationFresh=Boolean(remediation&&remediation.version===(cfg.version||lib.meta?.version)&&remediation.activeFiches===active.length&&remediation.generatedAt);
const volumeTarget=null;
const gate4Pass=gate3Pass&&activeJPlusOne.length>0&&verified>0&&verifiedIntegrity===verified;
const gate5Pass=gate4Pass&&verifiedEvidenceIntegrity===verified&&remediationFresh;
// Un run workflow_dispatch/push exerce exactement la même chaîne que le cron. Le test statique vérifie séparément le cron + timezone.
const workflowLiveOk=Boolean(inActions&&repo&&deployed&&gate3Pass&&['schedule','workflow_dispatch','push'].includes(workflowEvent));

const gates=[
 {id:1,name:'Dépôt GitHub et versionnement',status:repo?'PASS':'BLOCKED',detail:repo||'Aucun dépôt GitHub accessible/configuré.'},
 {id:2,name:'URL permanente',status:deployed?'PASS':configuredPublicUrl?'READY':'BLOCKED',detail:deployed?`${deployedUrl} — smoke HTTP concluant.`:configuredPublicUrl?`${configuredPublicUrl} configurée mais non encore validée par smoke HTTP.`:'Déploiement permanent non confirmé.'},
 {id:3,name:'Collecte réelle des sources',status:gate3Status,detail:`Ingestion: ${ingestiveExecuted}/${ingestiveSources.length} exécutées, ${ingestiveSuccess} succès, ${ingestiveImported} imports bruts. Contrôles: ${controlExecuted}/${controlSources.length}. Corpus de sources directes: ${nonBootstrap}. ${health.summary?.environmentSuspect?'Préflight local non concluant (réseau du runner indisponible).':`Préflight réseau: ${health.summary?.ok??0}/${health.summary?.total??0} accessibles/protégées.`}`},
 {id:4,name:'Bibliothèque réglementaire vérifiée',status:gate4Pass?'PASS':gate3Pass?(verified?'PARTIAL':'FAIL'):(verified?'PARTIAL':'WAIT_LIVE'),detail:`${verified}/${activeJPlusOne.length} fiches J+1 strictement VÉRIFIÉES ; sources directes uniquement, sans quota de fiches, au ${jPlusOneDate()}. Sont comptées les aides retrouvées ACTIVE sans échéance publiée, les aides permanentes et celles avec clôture documentée >= J+1 ; STALE et ARCHIVE sont exclues. Intégrité recalculée ${verifiedIntegrity}/${verified}.`},
 {id:5,name:'Extraction CdC / preuves par champ',status:gate5Pass?'PASS':gate3Pass?(verified?'PARTIAL':'FAIL'):'WAIT_LIVE',detail:`Preuves A/B complètes sur les 8 champs critiques : ${verifiedEvidenceIntegrity}/${verified||0} fiches VÉRIFIÉES. File de remédiation synchronisée : ${remediationFresh?'oui':'non'}. Couverture J+1 indicative : ${withCdc}/${activeJPlusOne.length} avec CdC/règlement.`},
 {id:6,name:'Déduplication et fraîcheur',status:gate3Pass&&nonBootstrap>0?'PASS':'PASS_TECH',detail:'Scans vides non destructifs, ordre multi-source neutralisé, réactivation et J+1 couverts par tests. PASS final après corpus multi-sources réel.'},
 {id:7,name:'Enrichissement SIREN/SIRET',status:companyLiveOk?'PASS':'READY',detail:companyLiveOk?'API Recherche d’entreprises DINUM validée par smoke live.':'Fallback navigateur + endpoint /api/company disponibles ; smoke live non concluant ou non exécuté.'},
 {id:8,name:'Qualification projet multi-financeurs',status:consultantCases>=5&&uat.total>=5?'PASS':'PARTIAL',detail:`Moteur partagé navigateur/recette avec profils Bpifrance/France 2030, ADEME, FEDER et régional. Cas UAT réussis : ${consultantCases}/${uat.total||0}. Minimum : 5.`},
 {id:9,name:'Exploitation quotidienne 02:00 + rapport',status:workflowLiveOk?'PASS':(repo&&deployed?'READY':'PARTIAL'),detail:workflowLiveOk?`Chaîne GitHub Actions live validée sur ${workflowEvent}; la définition cron 02:00 Europe/Paris est couverte par test statique.`:'Workflow, cron 02:00 Europe/Paris et rapport implémentés ; une exécution live de la chaîne reste requise.'}
];
const preProductionPass=gates.every(g=>g.status==='PASS');
gates.push({id:10,name:'Recette production',status:preProductionPass?'PASS':'NOT_STARTED',detail:preProductionPass?'Gates 1–9 validées ; recette production finale autorisée.':'GO uniquement quand les Gates 1–9 sont validées et sans anomalie P0.'});
const summary={generatedAt:new Date().toISOString(),version:cfg.version||'unknown',gates,counts:{sourcesConfigured:cfg.sources.length,ingestiveSources:ingestiveSources.length,controlSources:controlSources.length,sourcesInLastCycle:sourceCycles,sourcesSuccess:sourceSuccess,ingestiveExecuted,ingestiveSuccess,ingestiveImported,controlExecuted,nonBootstrapFiches:nonBootstrap,activeFiches:active.length,jPlusOneDate:jPlusOneDate(),jPlusOneActiveFiches:activeJPlusOne.length,volumeTarget,verifiedFiches:verified,verifiedIntegrity,verifiedEvidenceIntegrity,withCdc,withDeadline,consultantCases,uatTotal:uat.total,companySmokeOk:companyLiveOk,publicSmokeOk:deployed,workflowEvent,inActions,remediationFresh},goProduction:preProductionPass};
const outDir=path.join(ROOT,'site','data');await fs.mkdir(outDir,{recursive:true});await fs.writeFile(path.join(outDir,'production-readiness.json'),JSON.stringify(summary,null,2),'utf8');
const md=[`# FUNDING RADAR — Production Readiness v${cfg.version||'unknown'}`,'',`Généré : ${summary.generatedAt}`,'',...gates.map(g=>`- **Gate ${g.id} — ${g.name}** : ${g.status} — ${g.detail}`),'',`**GO PRODUCTION : ${summary.goProduction?'OUI':'NON'}**`].join('\n');await fs.writeFile(path.join(ROOT,'PRODUCTION_READINESS.md'),md,'utf8');console.log(md);

