import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readJson} from './lib/utils.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const lib=await readJson(path.join(root,'site/data/library.json'),{aaps:[]});
const cov=await readJson(path.join(root,'site/data/coverage.json'),[]);
const health=await readJson(path.join(root,'site/data/source-health.json'),{summary:{},results:[]});
const cfg=await readJson(path.join(root,'config/sources.json'),{sources:[]});
const a=lib.aaps||[];
const pct=(n,d)=>d?Math.round(n/d*100):0;
const active=a.filter(x=>x.lifecycleStatus==='ACTIVE');
const hs=health.summary||{};
const healthResults=Array.isArray(health.results)?health.results:[];
const cycleRows=Array.isArray(cov)?cov:[];
const report={
  generatedAt:new Date().toISOString(),
  library:a.length,
  active:active.length,
  aap:active.filter(x=>String(x.kind).includes('AAP')).length,
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
  sourcesConfigured:Number(hs.total ?? cfg.sources?.length ?? 0),
  sourcesProbed:Number(hs.probed ?? healthResults.filter(x=>x.probeState!=='UNPROBED').length),
  sourcesConclusive:Number(hs.conclusive ?? healthResults.filter(x=>['OK','PROTECTED','HTTP_ERROR'].includes(x.probeState)).length),
  sourcesOk:Number(hs.ok ?? healthResults.filter(x=>x.success).length),
  liveCycleSources:cycleRows.length,
  liveCycleSuccess:cycleRows.filter(x=>x.success).length,
  liveCycleExecuted:Boolean(hs.liveCycleExecuted)||cycleRows.length>0,
  cdcCoverage:pct(active.filter(x=>(x.cdcLinks||[]).length).length,active.length),
  deadlineCoverage:pct(active.filter(x=>x.permanent||x.closingDate||x.finalClosingDate||(x.deadlines||[]).length).length,active.length),
  selectionCoverage:pct(active.filter(x=>x.selectionCriteria).length,active.length),
  disbursementCoverage:pct(active.filter(x=>x.disbursementTerms).length,active.length)
};
console.log(JSON.stringify(report,null,2));
