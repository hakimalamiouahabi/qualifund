import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CRITICAL_FIELDS, evidenceCoverage, qaAid } from './lib/qa.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const lib=await read(path.join(ROOT,'site','data','library.json'));
const active=(lib.aaps||[]).filter(a=>a.lifecycleStatus!=='ARCHIVE');
const byField=Object.fromEntries(CRITICAL_FIELDS.map(f=>[f,0]));
const contentFlags={};
const items=[];
let permanentUnverified=0, advancesMissingRepayment=0, missingCriticalDocs=0;
for(const a of active){
  const coverage=evidenceCoverage(a),missingEvidence=CRITICAL_FIELDS.filter(f=>!['A','B'].includes(coverage[f]));
  for(const f of missingEvidence)byField[f]++;
  const flags=qaAid(a);
  for(const f of flags)contentFlags[f]=(contentFlags[f]||0)+1;
  const calendarEvidence=(a.verification?.fieldEvidence||[]).some(e=>e.field==='calendar'&&['A','B'].includes(e.sourceTier));
  if(a.permanent&&!calendarEvidence)permanentUnverified++;
  if((a.aidTypes||[]).some(x=>['AVANCE_REMBOURSABLE','PRET_TAUX_ZERO'].includes(x))&&!a.repaymentTerms)advancesMissingRepayment++;
  const hasCriticalDoc=(a.cdcLinks||[]).length||(a.regulationLinks||[]).length;
  if(!hasCriticalDoc)missingCriticalDocs++;
  if(missingEvidence.length||flags.length){
    const severity=missingEvidence.length*10+flags.length+(hasCriticalDoc?0:5);
    items.push({id:a.id,title:a.title,sourceId:a.sourceId||null,severity,verification:a.verification?.status||'A_REVERIFIER',missingEvidence,qaFlags:flags,officialPage:a.officialPage||null,hasCriticalDoc:Boolean(hasCriticalDoc)});
  }
}
items.sort((a,b)=>b.severity-a.severity||String(a.title).localeCompare(String(b.title),'fr'));
const summary={
  generatedAt:new Date().toISOString(),
  version:lib.meta?.version||'unknown',
  activeFiches:active.length,
  verifiedFiches:active.filter(a=>a.verification?.status==='VERIFIE').length,
  criticalFields:CRITICAL_FIELDS,
  missingEvidenceABByField:byField,
  qaFlags:contentFlags,
  permanentUnverified,
  advancesMissingRepayment,
  missingCriticalDocs,
  remediationQueueCount:items.length,
  topPriority:items.slice(0,250)
};
await fs.writeFile(path.join(ROOT,'site','data','remediation.json'),JSON.stringify(summary,null,2),'utf8');
const lines=[
  `# LEYTON RADAR — Rapport de remédiation v${summary.version}`,'',
  `Généré : ${summary.generatedAt}`,'',
  `- Fiches actives : **${summary.activeFiches}**`,
  `- Fiches VÉRIFIÉES : **${summary.verifiedFiches}**`,
  `- File de remédiation : **${summary.remediationQueueCount}**`,
  `- Permanences sans preuve calendrier A/B : **${summary.permanentUnverified}**`,
  `- Avances remboursables / PTZ sans modalités de remboursement : **${summary.advancesMissingRepayment}**`,
  `- Fiches sans CdC/règlement rattaché : **${summary.missingCriticalDocs}**`,'',
  '## Preuves A/B manquantes par champ','',
  ...Object.entries(byField).map(([f,n])=>`- ${f}: ${n}`),'',
  '## Principaux drapeaux QA','',
  ...Object.entries(contentFlags).sort((a,b)=>b[1]-a[1]).map(([f,n])=>`- ${f}: ${n}`),'',
  'La file détaillée priorisée est publiée dans `site/data/remediation.json`.'
];
await fs.writeFile(path.join(ROOT,'REMEDIATION_REPORT.md'),lines.join('\n'),'utf8');
console.log(lines.join('\n'));
