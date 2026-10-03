import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { norm, uniq } from './lib/utils.mjs';
import { buildCertificationLedger, isPublishableAid } from './lib/publication.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DATA=path.join(ROOT,'site','data');
const lib=JSON.parse(await fs.readFile(path.join(DATA,'library.json'),'utf8'));
const cfg=JSON.parse(await fs.readFile(path.join(ROOT,'config','sources.json'),'utf8'));
let ledger;
try{ledger=JSON.parse(await fs.readFile(path.join(DATA,'certification-ledger.json'),'utf8'))}
catch{ledger=await buildCertificationLedger(DATA,cfg)}
const configuredSourceIds=new Set((cfg.sources||[]).map(s=>s.id));
const unlockedSourceIds=new Set(ledger.unlockedSourceIds||[]);
const published=(lib.aaps||[]).filter(a=>isPublishableAid(a,{configuredSourceIds,unlockedSourceIds}));
const rows=published.map(a=>({
  id:a.id,
  title:a.title,
  scope:a.scope,
  regions:a.regions||[],
  aidTypes:a.aidTypes||[],
  themes:a.themes||[],
  funder:a.funder||[],
  closingDate:a.finalClosingDate||a.closingDate||null,
  permanent:!!a.permanent,
  verification:a.verification?.status||'A_REVERIFIER',
  sourceId:a.sourceId||null,
  tokens:uniq(norm([
    a.title,a.objective,a.beneficiaries,a.eligibleExpenses,a.prerequisites,
    ...(a.projectLabels||[]),...(a.themes||[]),...(a.funder||[])
  ].filter(Boolean).join(' ')).split(/\s+/).filter(x=>x.length>=3)).slice(0,160)
}));
const out={
  version:cfg.version||'unknown',
  generatedAt:new Date().toISOString(),
  policy:'CERTIFIED_SOURCE_ONLY',
  certifiedSourceCount:unlockedSourceIds.size,
  rawCount:(lib.aaps||[]).length,
  count:rows.length,
  rows
};
await fs.writeFile(path.join(DATA,'search-index.json'),JSON.stringify(out),'utf8');
console.log(`Index de recherche certifié: ${rows.length} fiches publiables / ${(lib.aaps||[]).length} brutes`);
