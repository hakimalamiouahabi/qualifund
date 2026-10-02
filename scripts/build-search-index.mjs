import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { norm, uniq } from './lib/utils.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DATA=path.join(ROOT,'site','data');
const lib=JSON.parse(await fs.readFile(path.join(DATA,'library.json'),'utf8'));
const cfg=JSON.parse(await fs.readFile(path.join(ROOT,'config','sources.json'),'utf8'));
const rows=(lib.aaps||[]).filter(a=>a.lifecycleStatus==='ACTIVE').map(a=>({
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
  tokens:uniq(norm([a.title,a.objective,a.beneficiaries,a.eligibleExpenses,a.prerequisites,...(a.projectLabels||[]),...(a.themes||[]),...(a.funder||[])].filter(Boolean).join(' ')).split(/\s+/).filter(x=>x.length>=3)).slice(0,160)
}));
const out={version:cfg.version||'unknown',generatedAt:new Date().toISOString(),count:rows.length,rows};
await fs.writeFile(path.join(DATA,'search-index.json'),JSON.stringify(out),'utf8');
console.log(`Index de recherche: ${rows.length} fiches -> site/data/search-index.json`);
