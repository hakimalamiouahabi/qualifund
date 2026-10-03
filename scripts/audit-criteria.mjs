import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCertificationLedger, isPublishableAid } from './lib/publication.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=path.join(root,'site','data');
const {meta={},aaps=[]}=JSON.parse(await fs.readFile(path.join(data,'library.json'),'utf8'));
const cfg=JSON.parse(await fs.readFile(path.join(root,'config','sources.json'),'utf8'));
const coverage=JSON.parse(await fs.readFile(path.join(data,'coverage.json'),'utf8'));
let ledger;
try{ledger=JSON.parse(await fs.readFile(path.join(data,'certification-ledger.json'),'utf8'))}
catch{ledger=await buildCertificationLedger(data,cfg)}
const configuredSourceIds=new Set((cfg.sources||[]).map(s=>s.id));
const unlockedSourceIds=new Set(ledger.unlockedSourceIds||[]);
const rows=(aaps||[]).filter(a=>isPublishableAid(a,{configuredSourceIds,unlockedSourceIds}));
const certifiedCoverage=(coverage||[]).filter(x=>unlockedSourceIds.has(x.id));

const fields=['beneficiaries','eligibleExpenses','prerequisites','selectionCriteria','financialTerms','calendar'];
const proof=(a,field)=>Array.isArray(a.verification?.fieldEvidence)&&a.verification.fieldEvidence.some(e=>e.field===field&&['A','B'].includes(e.sourceTier)&&/^https?:\/\//.test(e.sourceUrl||'')&&String(e.evidenceText||'').trim());
const present=(a,field)=>field==='financialTerms'?Boolean(a.aidAmount?.raw||a.aidRate?.raw||a.repaymentTerms):field==='calendar'?Boolean(a.permanent||a.closingDate||a.finalClosingDate||a.deadlines?.length):Boolean(a[field]);
const summarize=list=>({
  total:list.length,
  verified:list.filter(a=>a.verification?.status==='VERIFIE').length,
  active:list.filter(a=>a.lifecycleStatus!=='ARCHIVE').length,
  fields:Object.fromEntries(fields.map(field=>[field,{
    present:list.filter(a=>present(a,field)).length,
    officialProof:list.filter(a=>proof(a,field)).length
  }]))
});
const instruments=['SUBVENTION','AVANCE_REMBOURSABLE','PRET_TAUX_ZERO'];
const categories=['STARTUP','PME','ETI','GE'];
const report={
  generatedAt:new Date().toISOString(),
  corpusGeneratedAt:meta.generatedAt||null,
  policy:'CERTIFIED_SOURCE_ONLY',
  rawTotal:(aaps||[]).length,
  publishedTotal:rows.length,
  quarantinedTotal:(aaps||[]).length-rows.length,
  certifiedSources:[...unlockedSourceIds],
  sourceCount:certifiedCoverage.length,
  sourcesSucceeded:certifiedCoverage.filter(s=>s.success).length,
  sourcesFailed:certifiedCoverage.filter(s=>!s.success).length,
  overall:summarize(rows),
  aapAmi:summarize(rows.filter(a=>a.kind==='AAP / AMI')),
  byInstrument:Object.fromEntries(instruments.map(x=>[x,summarize(rows.filter(a=>a.aidTypes?.includes(x)))])),
  byCompanyCategory:Object.fromEntries(categories.map(x=>[x,summarize(rows.filter(a=>a.companyCategories?.includes(x)))])),
  unknownCompanyCategory:summarize(rows.filter(a=>!a.companyCategories?.length)),
  missingSelectionProof:rows.filter(a=>!proof(a,'selectionCriteria')).map(a=>({
    id:a.id,title:a.title,sourceId:a.sourceId,officialPage:a.officialPage||null,selectionTextPresent:present(a,'selectionCriteria')
  }))
};
await fs.writeFile(path.join(data,'criteria-audit.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({
  generatedAt:report.generatedAt,
  rawTotal:report.rawTotal,
  publishedTotal:report.publishedTotal,
  quarantinedTotal:report.quarantinedTotal,
  overall:report.overall,
  missingSelectionProof:report.missingSelectionProof.length,
  sourcesFailed:report.sourcesFailed
},null,2));
