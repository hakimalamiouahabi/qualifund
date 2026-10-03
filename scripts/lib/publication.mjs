import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { isForbiddenAggregatorUrl } from './direct-sources.mjs';
import { jPlusOneDate } from './jplus1.mjs';

export const TARGET_PUBLIC_INSTRUMENTS=new Set([
  'SUBVENTION','AVANCE_REMBOURSABLE','PRET_TAUX_ZERO','APPEL_A_PROJET'
]);

const CLOSED_STATES=new Set(['STALE','CLOSED','CLOS','EXPIRED']);
const generic=/^(?:accueil|home|aide|aides|dispositif|document|conditions particuli[eè]res(?: bpifrance)?|page|sans titre|nos aides|toutes nos aides|contact et aide)$/i;

function day(raw){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(raw||'')))return null;
  const ms=Date.parse(String(raw)+'T12:00:00Z');
  return Number.isFinite(ms)?ms:null;
}
function closingDate(a){
  const dates=[
    ...(Array.isArray(a?.deadlines)?a.deadlines:[]).map(x=>typeof x==='string'?x:x?.date),
    a?.finalClosingDate,a?.closingDate
  ].filter(Boolean).sort();
  return dates.at(-1)||null;
}
export function targetFunding(a){
  const kinds=String(a?.kind||'').toUpperCase();
  if(kinds.includes('AAP')||kinds.includes('AMI'))return true;
  const types=Array.isArray(a?.aidTypes)?a.aidTypes:[];
  return types.some(x=>TARGET_PUBLIC_INSTRUMENTS.has(x));
}

function evidence(a,field){
  return (Array.isArray(a?.verification?.fieldEvidence)?a.verification.fieldEvidence:[])
    .filter(e=>e?.field===field&&['A','B'].includes(e?.sourceTier)&&/^https?:\/\//i.test(String(e?.sourceUrl||'')));
}
export function hasGuichetEvidence(a){
  return evidence(a,'guichet').length>0;
}
export function hasStatusEvidence(a){
  return evidence(a,'sourceStatus').length>0||evidence(a,'calendar').length>0;
}
export function hasTargetInstrumentEvidence(a){
  if(String(a?.kind||'').toUpperCase().includes('AAP')||String(a?.kind||'').toUpperCase().includes('AMI')){
    return evidence(a,'catalogueKind').length>0||evidence(a,'instrument').length>0;
  }
  return evidence(a,'instrument').length>0;
}
export function hasEnterpriseEvidence(a){
  if(a?.enterpriseEligible===true&&evidence(a,'enterpriseEligibility').length>0)return true;
  if(evidence(a,'enterpriseEligibility').length>0)return true;
  const companyWords=/\b(?:entreprises?|tpe|pme|eti|grandes? entreprises?|start[- ]?ups?|soci[eé]t[eé]s?|artisans?|commer[cç]ants?|exploitations? agricoles?)\b/i;
  const eligibilityWords=/\b(?:vous [eê]tes|votre profil|[eé]ligib|candidat|porteur|b[eé]n[eé]ficiaire|consortium|peuvent candidater|doivent [eê]tre|projets? port[eé]s?|partenariats?)\b/i;
  const strongFields=new Set(['beneficiaries','prerequisites','projectsExpected','objective']);
  const proofs=(Array.isArray(a?.verification?.fieldEvidence)?a.verification.fieldEvidence:[])
    .filter(e=>strongFields.has(e?.field)&&['A','B'].includes(e?.sourceTier)&&/^https?:\/\//i.test(String(e?.sourceUrl||'')));
  if(proofs.some(e=>{
    const txt=String(e.evidenceText||'');
    if(!companyWords.test(txt))return false;
    if(['beneficiaries','prerequisites'].includes(e.field))return true;
    return eligibilityWords.test(txt);
  }))return true;
  const beneficiaryProof=evidence(a,'beneficiaries');
  if(Array.isArray(a?.companyCategories)&&a.companyCategories.length&&beneficiaryProof.length)return true;
  return false;
}
export function recentOrActive(a,{now=new Date()}={}){
  const lifecycle=String(a?.lifecycleStatus||'').toUpperCase();
  if(lifecycle!=='ACTIVE'||CLOSED_STATES.has(lifecycle))return false;
  if(a?.permanent===true)return true;
  const closing=String(closingDate(a)||'').slice(0,10);
  if(closing)return closing>=jPlusOneDate(now);
  return true;
}
export function publicationReason(a,{configuredSourceIds=null,unlockedSourceIds=null,now=new Date(),recentDays=60}={}){
  if(!a||typeof a!=='object')return'INVALID_RECORD';
  if(configuredSourceIds&& !configuredSourceIds.has(a.sourceId))return'SOURCE_NOT_CONFIGURED';
  if(unlockedSourceIds&& !unlockedSourceIds.has(a.sourceId))return'SOURCE_NOT_CERTIFIED';
  if(!recentOrActive(a,{now,recentDays}))return'INACTIVE_OR_STALE';
  const kinds=String(a?.kind||'').toUpperCase();
  const types=Array.isArray(a?.aidTypes)?a.aidTypes.filter(Boolean):[];
  const isCall=kinds.includes('AAP')||kinds.includes('AMI');
  const hasTargetType=types.some(x=>TARGET_PUBLIC_INSTRUMENTS.has(x));
  const instrumentUnknown=!isCall&&!hasTargetType&&(!types.length||types.every(x=>x==='AUTRE'));
  if(instrumentUnknown)return'MISSING_INSTRUMENT_EVIDENCE';
  if(!targetFunding(a))return'OUT_OF_TARGET_INSTRUMENT';
  if(!hasGuichetEvidence(a))return'MISSING_GUICHET_EVIDENCE';
  if(!hasStatusEvidence(a))return'MISSING_STATUS_EVIDENCE';
  if(!hasTargetInstrumentEvidence(a))return'MISSING_INSTRUMENT_EVIDENCE';
  if(!hasEnterpriseEvidence(a))return'MISSING_ENTERPRISE_EVIDENCE';
  const title=String(a.title||'').replace(/\s+/g,' ').trim();
  if(!title||title.length<4||generic.test(title))return'GENERIC_TITLE';
  const url=String(a.officialPage||'');
  if(!/^https:\/\//i.test(url))return'MISSING_DIRECT_URL';
  try{new URL(url)}catch{return'INVALID_DIRECT_URL'}
  if(isForbiddenAggregatorUrl(url))return'FORBIDDEN_AGGREGATOR';
  return null;
}
export function isPublishableAid(a,opts={}){
  return publicationReason(a,opts)==null;
}

const FINGERPRINT_IGNORED_SOURCE_KEYS=new Set(['notes','webVerifiedAt','webEvidenceUrl','observedCatalogCount','observedOpenCount']);
function stableValue(value){
  if(Array.isArray(value))return value.map(stableValue);
  if(value&&typeof value==='object'){
    return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stableValue(value[k])]));
  }
  return value;
}
function stableSourceValue(value){
  if(Array.isArray(value))return value.map(stableSourceValue);
  if(value&&typeof value==='object'){
    return Object.fromEntries(Object.keys(value).sort().filter(k=>!FINGERPRINT_IGNORED_SOURCE_KEYS.has(k)).map(k=>[k,stableSourceValue(value[k])]));
  }
  return value;
}
export function sourceConfigFingerprint(cfg,sourceIds=[]){
  const wanted=new Set(sourceIds);
  const sources=(cfg?.sources||[])
    .filter(s=>wanted.has(s.id))
    .sort((a,b)=>String(a.id).localeCompare(String(b.id)))
    .map(stableSourceValue);
  return createHash('sha256').update(JSON.stringify({version:cfg?.version||null,sources})).digest('hex');
}

export function sourceDataFingerprint(records=[],sourceIds=[]){
  const wanted=new Set(sourceIds);
  const selected=(Array.isArray(records)?records:[])
    .filter(a=>wanted.has(a?.sourceId))
    .sort((a,b)=>String(a?.id||'').localeCompare(String(b?.id||''))||String(a?.officialPage||'').localeCompare(String(b?.officialPage||'')))
    .map(stableValue);
  return createHash('sha256').update(JSON.stringify(selected)).digest('hex');
}

const STRATEGY_IMPLEMENTATIONS={
  'bpifrance-aap':'scripts/connectors/bpifrance.mjs',
  'bpifrance-aides':'scripts/connectors/bpifrance.mjs',
  'ademe-official':'scripts/connectors/ademe.mjs',
  'aura-official':'scripts/connectors/aura.mjs',
  'official-page':'scripts/connectors/official-page.mjs',
  'catalog-html':'scripts/connectors/web-catalog.mjs',
  'opendatasoft':'scripts/connectors/opendatasoft.mjs',
  'control-only':'scripts/connectors/control.mjs'
};
const CERTIFICATION_CORE_FILES=[
  'package.json',
  'package-lock.json',
  'schemas/aap.schema.json',
  '.github/workflows/update-and-deploy.yml',
  'scripts/update-library.mjs',
  'scripts/purge-indirect-sources.mjs',
  'scripts/certify-active-source.mjs',
  'scripts/sync-static-metadata.mjs',
  'scripts/build-cloudflare-pages.mjs',
  'scripts/lib/publication.mjs',
  'scripts/lib/direct-sources.mjs',
  'scripts/lib/collection-lock.mjs',
  'scripts/lib/source-cycle.mjs',
  'scripts/lib/lifecycle.mjs',
  'scripts/lib/jplus1.mjs',
  'scripts/lib/enrich.mjs',
  'scripts/lib/merge.mjs',
  'scripts/lib/dedupe.mjs',
  'scripts/lib/qa.mjs',
  'scripts/lib/browser.mjs',
  'scripts/lib/utils.mjs'
];

export async function certificationBasisFingerprint(root,cfg,sourceIds=[]){
  const wanted=new Set(sourceIds);
  const selected=(cfg?.sources||[]).filter(s=>wanted.has(s.id));
  const files=new Set(CERTIFICATION_CORE_FILES);
  for(const source of selected){
    const impl=STRATEGY_IMPLEMENTATIONS[source.strategy];
    if(impl)files.add(impl);
  }
  const parts=[['source-config',sourceConfigFingerprint(cfg,sourceIds)]];
  for(const rel of [...files].sort()){
    try{
      const content=await fs.readFile(path.join(root,rel));
      parts.push([rel,createHash('sha256').update(content).digest('hex')]);
    }catch(e){
      parts.push([rel,'MISSING:'+String(e?.code||e?.message||e)]);
    }
  }
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

export async function buildCertificationLedger(dataDir,cfg,{root=path.resolve(dataDir,'../..')}={}){
  const sourceIds=new Set((cfg.sources||[]).map(s=>s.id));
  let currentLibrary={aaps:[]};
  try{currentLibrary=JSON.parse(await fs.readFile(path.join(dataDir,'library.json'),'utf8'))}catch{}
  let names=[];try{names=await fs.readdir(dataDir)}catch{}
  const files=names.filter(n=>/^[a-z0-9-]+-certification\.json$/i.test(n)&&n!=='active-source-certification.json');
  const bestBySource=new Map(),certifications=[],rejectedCertifications=[];
  for(const file of files){
    let report;try{report=JSON.parse(await fs.readFile(path.join(dataDir,file),'utf8'))}catch{continue}
    if(report?.status!=='PASS')continue;
    const generatedAt=report.generatedAt||null;
    const configured=(report.configuredSources||[]).filter(id=>sourceIds.has(id));
    if(!configured.length)continue;
    const currentFingerprint=sourceConfigFingerprint(cfg,configured);
    const certifiedFingerprint=String(report.sourceConfigFingerprint||'');
    const currentBasisFingerprint=await certificationBasisFingerprint(root,cfg,configured);
    const certifiedBasisFingerprint=String(report.certificationBasisFingerprint||'');
    if(!certifiedFingerprint){
      rejectedCertifications.push({
        file,name:report.lock?.name||file.replace(/-certification\.json$/,''),
        generatedAt,sourceIds:configured,reason:'SOURCE_CONFIG_FINGERPRINT_MISSING',
        certifiedFingerprint:null,currentFingerprint
      });
      continue;
    }
    if(certifiedFingerprint!==currentFingerprint){
      rejectedCertifications.push({
        file,name:report.lock?.name||file.replace(/-certification\.json$/,''),
        generatedAt,sourceIds:configured,reason:'SOURCE_CONFIG_CHANGED',
        certifiedFingerprint,currentFingerprint
      });
      continue;
    }
    if(!certifiedBasisFingerprint){
      rejectedCertifications.push({
        file,name:report.lock?.name||file.replace(/-certification\.json$/,''),
        generatedAt,sourceIds:configured,reason:'CERTIFICATION_BASIS_MISSING',
        certifiedBasisFingerprint:null,currentBasisFingerprint
      });
      continue;
    }
    if(certifiedBasisFingerprint!==currentBasisFingerprint){
      rejectedCertifications.push({
        file,name:report.lock?.name||file.replace(/-certification\.json$/,''),
        generatedAt,sourceIds:configured,reason:'CERTIFICATION_BASIS_CHANGED',
        certifiedBasisFingerprint,currentBasisFingerprint
      });
      continue;
    }
    const currentDataFingerprint=sourceDataFingerprint(currentLibrary?.aaps||[],configured);
    const certifiedDataFingerprint=String(report.certifiedDataFingerprint||'');
    if(!certifiedDataFingerprint){
      rejectedCertifications.push({
        file,name:report.lock?.name||file.replace(/-certification\.json$/,''),
        generatedAt,sourceIds:configured,reason:'CERTIFIED_DATA_FINGERPRINT_MISSING',
        certifiedDataFingerprint:null,currentDataFingerprint
      });
      continue;
    }
    if(certifiedDataFingerprint!==currentDataFingerprint){
      rejectedCertifications.push({
        file,name:report.lock?.name||file.replace(/-certification\.json$/,''),
        generatedAt,sourceIds:configured,reason:'CERTIFIED_DATA_CHANGED',
        certifiedDataFingerprint,currentDataFingerprint
      });
      continue;
    }
    certifications.push({
      file,name:report.lock?.name||file.replace(/-certification\.json$/,''),
      generatedAt,status:'PASS',sourceIds:configured,libraryRecords:Number(report.libraryRecords||0),
      fingerprintStatus:'MATCH',sourceConfigFingerprint:certifiedFingerprint,currentSourceConfigFingerprint:currentFingerprint,
      certificationBasisFingerprint:certifiedBasisFingerprint,currentCertificationBasisFingerprint:currentBasisFingerprint,
      certifiedDataFingerprint,currentDataFingerprint
    });
    for(const id of configured){
      const prev=bestBySource.get(id);
      if(!prev||Date.parse(generatedAt||0)>=Date.parse(prev.generatedAt||0))bestBySource.set(id,{generatedAt,file,name:report.lock?.name||id});
    }
  }
  const unlockedSourceIds=[...bestBySource.keys()].sort();
  const guichets=[...new Set([...bestBySource.values()].map(x=>x.name).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
  return{
    generatedAt:new Date().toISOString(),
    version:cfg.version||null,
    policy:'CERTIFIED_SOURCE_ONLY',
    unlockedSourceIds,guichets,
    certifications:certifications.sort((a,b)=>String(a.name).localeCompare(String(b.name),'fr')),
    rejectedCertifications
  };
}
