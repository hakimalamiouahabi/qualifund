import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readJson} from './lib/utils.mjs';
import { buildCertificationLedger, isPublishableAid } from './lib/publication.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=path.join(root,'site/data');
const lib=await readJson(path.join(data,'library.json'),{aaps:[]});
const cov=await readJson(path.join(data,'coverage.json'),[]);
const health=await readJson(path.join(data,'source-health.json'),{summary:{},results:[]});
const cfg=await readJson(path.join(root,'config/sources.json'),{sources:[]});
let ledger=await readJson(path.join(data,'certification-ledger.json'),null);
if(!ledger)ledger=await buildCertificationLedger(data,cfg);
const configuredSourceIds=new Set((cfg.sources||[]).map(s=>s.id));
const unlockedSourceIds=new Set(ledger.unlockedSourceIds||[]);
const raw=lib.aaps||[];
const published=raw.filter(a=>isPublishableAid(a,{configuredSourceIds,unlockedSourceIds}));
const pct=(n,d)=>d?Math.round(n/d*100):0;
const active=published.filter(x=>x.lifecycleStatus==='ACTIVE');
const archived=published.filter(x=>x.lifecycleStatus==='ARCHIVE');
const hs=health.summary||{};
const healthResults=Array.isArray(health.results)?health.results:[];
const cycleRows=(Array.isArray(cov)?cov:[]).filter(x=>unlockedSourceIds.has(x.id));
const report={
  generatedAt:new Date().toISOString(),
  policy:'CERTIFIED_SOURCE_ONLY',
  rawLibrary:raw.length,
  library:published.length,
  quarantined:raw.length-published.length,
  active:active.length,
  archived:archived.length,
  aap:active.filter(x=>String(x.kind).includes('AAP')||String(x.kind).includes('AMI')).length,
  verified:active.filter(x=>x.verification?.status==='VERIFIE').length,
  withCdc:active.filter(x=>(x.cdcLinks||[]).length).length,
  withDeadline:active.filter(x=>x.permanent||x.closingDate||x.finalClosingDate||(x.deadlines||[]).length).length,
  withSelectionCriteria:active.filter(x=>x.selectionCriteria).length,
  withDisbursementTerms:active.filter(x=>x.disbursementTerms).length,
  recoverableAdvances:active.filter(x=>(x.aidTypes||[]).includes('AVANCE_REMBOURSABLE')).length,
  zeroInterestLoans:active.filter(x=>(x.aidTypes||[]).includes('PRET_TAUX_ZERO')).length,
  repaymentRequired:active.filter(x=>(x.aidTypes||[]).some(t=>['AVANCE_REMBOURSABLE','PRET_TAUX_ZERO'].includes(t))).length,
  withRepaymentTerms:active.filter(x=>(x.aidTypes||[]).some(t=>['AVANCE_REMBOURSABLE','PRET_TAUX_ZERO'].includes(t))&&x.repaymentTerms).length,
  avgCompleteness:active.length?Math.round(active.reduce((s,x)=>s+(x.verification?.completeness||0),0)/active.length):0,
  sourcesConfigured:cfg.sources?.length||0,
  certifiedSources:unlockedSourceIds.size,
  sourcesProbed:Number(hs.probed ?? healthResults.filter(x=>x.probeState!=='UNPROBED').length),
  sourcesConclusive:Number(hs.conclusive ?? healthResults.filter(x=>['OK','PROTECTED','HTTP_ERROR'].includes(x.probeState)).length),
  sourcesOk:Number(hs.ok ?? healthResults.filter(x=>x.success).length),
  liveCycleSources:cycleRows.length,
  liveCycleSuccess:cycleRows.filter(x=>x.success).length,
  liveCycleExecuted:cycleRows.length>0,
  cdcCoverage:pct(active.filter(x=>(x.cdcLinks||[]).length).length,active.length),
  deadlineCoverage:pct(active.filter(x=>x.permanent||x.closingDate||x.finalClosingDate||(x.deadlines||[]).length).length,active.length),
  selectionCoverage:pct(active.filter(x=>x.selectionCriteria).length,active.length),
  disbursementCoverage:pct(active.filter(x=>x.disbursementTerms).length,active.length)
};
console.log(JSON.stringify(report,null,2));
