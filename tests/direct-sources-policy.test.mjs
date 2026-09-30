import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { assertDirectSources, filterDirectLibrary, directPageId, sanitizeAidLinks } from '../scripts/lib/direct-sources.mjs';
import { purgeIndirectSources } from '../scripts/purge-indirect-sources.mjs';
const cfg={version:'test',sourcePolicy:'DIRECT_OFFICIAL_ONLY',sourceSelectionPolicy:'GUICHET_OR_REGION_OFFICIAL_ONLY',sources:[{id:'bpifrance',official:true,strategy:'catalog-html',url:'https://www.bpifrance.fr/nos-appels-a-projets-concours'}]};
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


test('les agrégateurs nationaux généralistes sont exclus mais une page régionale spécifique reste admissible',()=>{
 const bad=[
  'https://www.service-public.gouv.fr/particuliers/vosdroits',
  'https://mes-aides.gouv.fr/',
  'https://www.les-aides.fr/',
  'https://www.europe-en-france.gouv.fr/fr/programmes-europeens-2021-2027'
 ];
 for(const url of bad) assert.throws(()=>assertDirectSources({...cfg,sources:[...cfg.sources,{id:'bad',official:true,strategy:'catalog-html',url}]}),url);
 const regional={id:'martinique-feder',official:true,strategy:'official-page',url:'https://www.europe-en-france.gouv.fr/fr/programmes-europeens-2021-2027/programme-martinique-feder-fse-2021-2027'};
 assert.doesNotThrow(()=>assertDirectSources({...cfg,sources:[...cfg.sources,regional]}));
});


test('les liens imbriqués agrégateurs et les doublons sont purgés sans supprimer la fiche officielle',()=>{
 const localCfg={...cfg,excludedSources:['old_control']};
 const row={...valid,
   sourceLinks:[
     {label:'officiel',url:'https://www.bpifrance.fr/nos-appels-a-projets-concours/aap-1'},
     {label:'doublon',url:'https://www.bpifrance.fr/nos-appels-a-projets-concours/aap-1?utm_source=x'},
     {label:'interdit',url:'https://www.aides-entreprises.fr/aide/test'}
   ],
   cdcLinks:[
     {label:'CdC',url:'https://media.bpifrance.fr/test.pdf'},
     {label:'CdC doublon',url:'https://media.bpifrance.fr/test.pdf?utm_source=x'}
   ],
   sourceAliases:['old_control','bpifrance']
 };
 const out=sanitizeAidLinks(row,localCfg);
 assert.equal(out.officialPage,valid.officialPage);
 assert.equal(out.sourceLinks.length,1);
 assert.equal(out.cdcLinks.length,1);
 assert.deepEqual(out.sourceAliases,['bpifrance']);
 assert.doesNotMatch(JSON.stringify(out),/aides-entreprises\.fr|old_control/);
});

test('une fiche STALE est supprimée de la bibliothèque directe',()=>{
 assert.deepEqual(filterDirectLibrary([{...valid,lifecycleStatus:'STALE'}],cfg),[]);
});

test('les URL de sources dupliquées sont interdites dans le registre',()=>{
 assert.throws(()=>assertDirectSources({...cfg,sources:[
  ...cfg.sources,
  {id:'dup',official:true,strategy:'control-only',url:cfg.sources[0].url}
 ]}),/Source dupliquée/);
});
