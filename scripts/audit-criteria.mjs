import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=path.join(root,'site','data');
const {meta={},aaps=[]}=JSON.parse(await fs.readFile(path.join(data,'library.json'),'utf8'));
const coverage=JSON.parse(await fs.readFile(path.join(data,'coverage.json'),'utf8'));
const fields=['beneficiaries','eligibleExpenses','prerequisites','selectionCriteria','financialTerms','calendar'];
const proof=(a,field)=>Array.isArray(a.verification?.fieldEvidence)&&a.verification.fieldEvidence.some(e=>e.field===field&&['A','B'].includes(e.sourceTier)&&/^https?:\/\//.test(e.sourceUrl||'')&&String(e.evidenceText||'').trim());
const present=(a,field)=>field==='financialTerms'?Boolean(a.aidAmount?.raw||a.aidRate?.raw):field==='calendar'?Boolean(a.permanent||a.closingDate||a.finalClosingDate||a.deadlines?.length):Boolean(a[field]);
const summarize=rows=>({total:rows.length,verified:rows.filter(a=>a.verification?.status==='VERIFIE').length,active:rows.filter(a=>a.lifecycleStatus==='ACTIVE').length,fields:Object.fromEntries(fields.map(field=>[field,{present:rows.filter(a=>present(a,field)).length,officialProof:rows.filter(a=>proof(a,field)).length}]))});
const instruments=['SUBVENTION','AVANCE_REMBOURSABLE','PRET_TAUX_ZERO'];
const categories=['STARTUP','PME','ETI','GE'];
const report={generatedAt:new Date().toISOString(),corpusGeneratedAt:meta.generatedAt||null,sourceCount:coverage.length,sourcesSucceeded:coverage.filter(s=>s.success).length,sourcesFailed:coverage.filter(s=>!s.success).length,overall:summarize(aaps),aapAmi:summarize(aaps.filter(a=>a.kind==='AAP / AMI')),byInstrument:Object.fromEntries(instruments.map(x=>[x,summarize(aaps.filter(a=>a.aidTypes?.includes(x)))])),byCompanyCategory:Object.fromEntries(categories.map(x=>[x,summarize(aaps.filter(a=>a.companyCategories?.includes(x)))])),unknownCompanyCategory:summarize(aaps.filter(a=>!a.companyCategories?.length)),missingSelectionProof:aaps.filter(a=>!proof(a,'selectionCriteria')).map(a=>({id:a.id,title:a.title,sourceId:a.sourceId,officialPage:a.officialPage||null,selectionTextPresent:present(a,'selectionCriteria')}))};
await fs.writeFile(path.join(data,'criteria-audit.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({generatedAt:report.generatedAt,overall:report.overall,missingSelectionProof:report.missingSelectionProof.length,sourcesFailed:report.sourcesFailed},null,2));
