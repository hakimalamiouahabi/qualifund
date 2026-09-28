import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const p=path.join(ROOT,'site','data','production-readiness.json');
let r;try{r=JSON.parse(await fs.readFile(p,'utf8'))}catch{console.error('Readiness absente : exécuter npm run production:gates.');process.exit(2)}
if(!r.goProduction){
  console.error('CERTIFICATION PRODUCTION: NON');
  for(const g of r.gates||[])if(g.status!=='PASS')console.error(`Gate ${g.id} ${g.status}: ${g.detail}`);
  process.exit(1);
}
console.log(`CERTIFICATION PRODUCTION: OUI — v${r.version} — ${r.generatedAt}`);
