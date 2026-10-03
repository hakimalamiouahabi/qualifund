import fs from 'node:fs/promises';
import path from 'node:path';
import { isForbiddenAggregatorUrl } from './direct-sources.mjs';

export const TARGET_PUBLIC_INSTRUMENTS=new Set([
  'SUBVENTION','AVANCE_REMBOURSABLE','PRET_TAUX_ZERO','APPEL_A_PROJET'
]);

const CLOSED_STATES=new Set(['STALE','CLOSED','CLOS','EXPIRED']);
const generic=/^(?:accueil|home|aide|aides|dispositif|document|page|sans titre|nos aides|toutes nos aides|contact et aide)$/i;

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
  const beneficiaryProof=evidence(a,'beneficiaries');
  if(beneficiaryProof.some(e=>companyWords.test(String(e.evidenceText||''))))return true;
  if(Array.isArray(a?.companyCategories)&&a.companyCategories.length&&beneficiaryProof.length)return true;
  return false;
}
export function recentOrActive(a,{now=new Date(),recentDays=60}={}){
  const lifecycle=String(a?.lifecycleStatus||'ACTIVE').toUpperCase();
  if(CLOSED_STATES.has(lifecycle))return false;
  if(a?.permanent===true&&lifecycle!=='ARCHIVE')return true;
  const d=day(closingDate(a));
  if(d!=null){
    // La date officielle prévaut sur un statut technique ancien : au-delà de J-60,
    // une fiche n'est plus publiable même si lifecycleStatus est resté ACTIVE.
    return d>=now.getTime()-recentDays*86400000;
  }
  if(lifecycle==='ARCHIVE')return false;
  return true;
}
export function publicationReason(a,{configuredSourceIds=null,unlockedSourceIds=null,now=new Date(),recentDays=60}={}){
  if(!a||typeof a!=='object')return'INVALID_RECORD';
  if(configuredSourceIds&& !configuredSourceIds.has(a.sourceId))return'SOURCE_NOT_CONFIGURED';
  if(unlockedSourceIds&& !unlockedSourceIds.has(a.sourceId))return'SOURCE_NOT_CERTIFIED';
  if(!recentOrActive(a,{now,recentDays}))return'INACTIVE_OR_STALE';
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

export async function buildCertificationLedger(dataDir,cfg){
  const sourceIds=new Set((cfg.sources||[]).map(s=>s.id));
  let names=[];try{names=await fs.readdir(dataDir)}catch{}
  const files=names.filter(n=>/^[a-z0-9-]+-certification\.json$/i.test(n)&&n!=='active-source-certification.json');
  const bestBySource=new Map(),certifications=[];
  for(const file of files){
    let report;try{report=JSON.parse(await fs.readFile(path.join(dataDir,file),'utf8'))}catch{continue}
    if(report?.status!=='PASS')continue;
    const generatedAt=report.generatedAt||null;
    const configured=(report.configuredSources||[]).filter(id=>sourceIds.has(id));
    if(!configured.length)continue;
    certifications.push({
      file,name:report.lock?.name||file.replace(/-certification\.json$/,''),
      generatedAt,status:'PASS',sourceIds:configured,libraryRecords:Number(report.libraryRecords||0)
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
    certifications:certifications.sort((a,b)=>String(a.name).localeCompare(String(b.name),'fr'))
  };
}
