import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CRITICAL_FIELDS, evidenceCoverage, qaAid } from './lib/qa.mjs';
import { buildCertificationLedger, isPublishableAid, publicationReason } from './lib/publication.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DATA=path.join(ROOT,'site','data');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const lib=await read(path.join(DATA,'library.json'));
const cfg=await read(path.join(ROOT,'config','sources.json'));
let ledger;try{ledger=await read(path.join(DATA,'certification-ledger.json'))}catch{ledger=await buildCertificationLedger(DATA,cfg)}
const configuredSourceIds=new Set((cfg.sources||[]).map(s=>s.id));
const unlockedSourceIds=new Set(ledger.unlockedSourceIds||[]);
const published=(lib.aaps||[]).filter(a=>isPublishableAid(a,{configuredSourceIds,unlockedSourceIds}));
const active=published.filter(a=>a.lifecycleStatus!=='ARCHIVE');
const certifiedQuarantine=(lib.aaps||[])
  .filter(a=>unlockedSourceIds.has(a.sourceId))
  .map(a=>({aid:a,reason:publicationReason(a,{configuredSourceIds,unlockedSourceIds})}))
  .filter(x=>/^MISSING_(?:GUICHET|STATUS|INSTRUMENT|ENTERPRISE)_EVIDENCE$/.test(String(x.reason||'')));

const byField=Object.fromEntries(CRITICAL_FIELDS.map(f=>[f,0]));
const contentFlags={},items=[];
let permanentUnverified=0,advancesMissingRepayment=0,missingCriticalDocs=0;
for(const a of active){
  const coverage=evidenceCoverage(a),missingEvidence=CRITICAL_FIELDS.filter(f=>!['A','B'].includes(coverage[f]));
  for(const f of missingEvidence)byField[f]++;
  const flags=qaAid(a);
  for(const flag of flags)contentFlags[flag]=(contentFlags[flag]||0)+1;
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
for(const {aid:a,reason} of certifiedQuarantine){
  const missingField={
    MISSING_GUICHET_EVIDENCE:'guichet',
    MISSING_STATUS_EVIDENCE:'sourceStatus',
    MISSING_INSTRUMENT_EVIDENCE:'instrument',
    MISSING_ENTERPRISE_EVIDENCE:'enterpriseEligibility'
  }[reason]||reason;
  items.push({
    id:a.id,title:a.title,sourceId:a.sourceId||null,severity:200,
    verification:a.verification?.status||'A_REVERIFIER',
    publicationBlocker:reason,
    missingEvidence:[missingField],
    qaFlags:['CERTIFIED_BUT_QUARANTINED'],
    officialPage:a.officialPage||null,
    hasCriticalDoc:Boolean((a.cdcLinks||[]).length||(a.regulationLinks||[]).length)
  });
}
items.sort((a,b)=>b.severity-a.severity||String(a.title).localeCompare(String(b.title),'fr'));
const summary={
  generatedAt:new Date().toISOString(),
  version:lib.meta?.version||'unknown',
  policy:'CERTIFIED_SOURCE_ONLY',
  rawFiches:(lib.aaps||[]).length,
  publishedFiches:published.length,
  quarantinedFiches:(lib.aaps||[]).length-published.length,
  activeFiches:active.length,
  verifiedFiches:active.filter(a=>a.verification?.status==='VERIFIE').length,
  certifiedSources:[...unlockedSourceIds],
  certifiedQuarantineCount:certifiedQuarantine.length,
  certifiedQuarantineByReason:Object.fromEntries([...new Set(certifiedQuarantine.map(x=>x.reason))].map(r=>[r,certifiedQuarantine.filter(x=>x.reason===r).length])),
  criticalFields:CRITICAL_FIELDS,
  missingEvidenceABByField:byField,
  qaFlags:contentFlags,
  permanentUnverified,
  advancesMissingRepayment,
  missingCriticalDocs,
  remediationQueueCount:items.length,
  topPriority:items.slice(0,250)
};
await fs.writeFile(path.join(DATA,'remediation.json'),JSON.stringify(summary,null,2),'utf8');
const lines=[
  `# FUNDING RADAR — Rapport de remédiation v${summary.version}`,'',
  `Généré : ${summary.generatedAt}`,'',
  `- Stock brut conservé : **${summary.rawFiches}**`,
  `- Corpus certifié publiable : **${summary.publishedFiches}**`,
  `- Quarantaine : **${summary.quarantinedFiches}**`,
  `- Fiches actives publiables : **${summary.activeFiches}**`,
  `- Fiches VÉRIFIÉES : **${summary.verifiedFiches}**`,
  `- File de remédiation : **${summary.remediationQueueCount}**`,
  `- Sources certifiées mais fiches bloquées pour preuve manquante : **${summary.certifiedQuarantineCount}**`,
  `- Permanences sans preuve calendrier A/B : **${summary.permanentUnverified}**`,
  `- Avances remboursables / PTZ sans modalités de remboursement : **${summary.advancesMissingRepayment}**`,
  `- Fiches sans CdC/règlement rattaché : **${summary.missingCriticalDocs}**`,'',
  '## Blocages de publication des sources certifiées','',
  ...Object.entries(summary.certifiedQuarantineByReason).map(([r,n])=>`- ${r}: ${n}`),'',
  '## Preuves A/B manquantes par champ','',
  ...Object.entries(byField).map(([f,n])=>`- ${f}: ${n}`),'',
  '## Principaux drapeaux QA','',
  ...Object.entries(contentFlags).sort((a,b)=>b[1]-a[1]).map(([flag,n])=>`- ${flag}: ${n}`),'',
  'La file détaillée priorisée est publiée dans `site/data/remediation.json`.'
];
await fs.writeFile(path.join(ROOT,'REMEDIATION_REPORT.md'),lines.join('\n'),'utf8');
console.log(lines.join('\n'));
