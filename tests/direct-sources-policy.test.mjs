import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { assertDirectSources, filterDirectLibrary, directPageId } from '../scripts/lib/direct-sources.mjs';
import { purgeIndirectSources } from '../scripts/purge-indirect-sources.mjs';
const cfg={version:'test',sourcePolicy:'DIRECT_OFFICIAL_ONLY',sources:[{id:'bpifrance',official:true,strategy:'catalog-html',url:'https://www.bpifrance.fr/nos-appels-a-projets-concours'}]};
const valid={id:'bpi1',sourceId:'bpifrance',title:'AAP',officialPage:'https://www.bpifrance.fr/nos-appels-a-projets-concours/aap-1',lifecycleStatus:'ACTIVE'};
test('distinct pages cannot collapse to the same identifier',()=>{
 assert.notEqual(directPageId('bpifrance',valid.officialPage),directPageId('bpifrance',valid.officialPage+'-2'));
});
test('stock, mixed provenance, foreign domains and catalog pages are rejected',()=>{
 const rows=[valid,{...valid,id:'ae_1'},{...valid,sourceAliases:['aides_entreprises']},{...valid,verification:{fieldEvidence:[{sourceUrl:'https://data.aides-entreprises.fr/stock'}]}},{...valid,officialPage:'https://example.com/aap'},{...valid,officialPage:cfg.sources[0].url}];
 assert.deepEqual(filterDirectLibrary(rows,cfg),[valid]);
 assert.throws(()=>assertDirectSources({...cfg,sources:[...cfg.sources,{id:'aides_entreprises',official:true,url:'https://data.aides-entreprises.fr/stock',strategy:'aides-entreprises'}]}));
});
test('purge covers exports, fallback, previous records and changes; is repeatable',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'direct-source-test-'));
 try{
  await fs.mkdir(path.join(root,'config'),{recursive:true});await fs.mkdir(path.join(root,'site/data'),{recursive:true});
  await fs.writeFile(path.join(root,'config/sources.json'),JSON.stringify(cfg));
  await fs.writeFile(path.join(root,'site/data/library.json'),JSON.stringify({meta:{generatedAt:'2026-09-28'},aaps:[valid,{...valid,id:'ae_1',sourceId:'aides_entreprises'}]}));
  await fs.writeFile(path.join(root,'site/data/changes.json'),JSON.stringify([{id:'bpi1'},{id:'ae_1'}]));
  const first=await purgeIndirectSources(root),second=await purgeIndirectSources(root);
  assert.deepEqual(first,second);assert.equal(second.meta.generatedAt,'2026-09-28');assert.equal(second.aaps.length,1);
  for(const f of ['site/data/library.json','site/data/bootstrap.js','site/data/library.previous.json','site/data/changes.json','site/bibliotheque/radar-library.json','site/bibliotheque/radar-library.csv'])assert.doesNotMatch(await fs.readFile(path.join(root,f),'utf8'),/ae_1|aides_entreprises/);
 }finally{await fs.rm(root,{recursive:true,force:true})}
});
