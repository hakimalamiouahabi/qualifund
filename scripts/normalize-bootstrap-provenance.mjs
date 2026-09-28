import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DATA=path.join(ROOT,'site','data');
const STOCK='https://data.aides-entreprises.fr/stock';
const API=/^https:\/\/api\.aides-entreprises\.fr\/v1\.1\/aide\//i;
const p=path.join(DATA,'library.json');
const lib=JSON.parse(await fs.readFile(p,'utf8'));
let sourceIds=0,recordIds=0,apiRemoved=0,officialRepaired=0,evidenceRepaired=0,linksRepaired=0;
for(const a of lib.aaps||[]){
  if(!String(a.id||'').startsWith('ae_')) continue;
  if(!a.sourceId){a.sourceId='aides_entreprises';sourceIds++}
  if(!a.sourceRecordId){a.sourceRecordId=String(a.id).replace(/^ae_/,'');recordIds++}
  if(a.apiUrl){a.apiUrl=null;apiRemoved++}
  if(API.test(String(a.officialPage||''))){a.officialPage=STOCK;officialRepaired++}
  for(const key of ['sourceLinks','regulationLinks','formLinks','cdcLinks']) for(const x of a[key]||[]){
    if(API.test(String(x?.url||''))){x.url=STOCK;linksRepaired++}
  }
  for(const e of a.verification?.fieldEvidence||[]){
    if(API.test(String(e?.sourceUrl||''))){e.sourceUrl=STOCK;e.locator=e.locator||`Aides Entreprises Open Data — fiche ${a.sourceRecordId}`;evidenceRepaired++}
  }
}
await fs.writeFile(p,JSON.stringify(lib,null,2)+'\n','utf8');
console.log(JSON.stringify({sourceIds,recordIds,apiRemoved,officialRepaired,evidenceRepaired,linksRepaired},null,2));
