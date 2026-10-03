import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { assertDirectSources, filterDirectLibrary, directPageId, sanitizeAidLinks } from '../scripts/lib/direct-sources.mjs';
import { purgeIndirectSources } from '../scripts/purge-indirect-sources.mjs';
const cfg={version:'test',sourcePolicy:'DIRECT_OFFICIAL_ONLY',sourceSelectionPolicy:'GUICHET_OR_REGION_OFFICIAL_ONLY',sources:[{id:'bpifrance',official:true,strategy:'catalog-html',url:'https://www.bpifrance.fr/nos-appels-a-projets-concours'}]};
const valid={id:'bpi1',sourceId:'bpifrance',title:'AAP',kind:'AAP / AMI',aidTypes:['APPEL_A_PROJET'],companyCategories:[],regions:[],scope:'NATIONAL',officialPage:'https://www.bpifrance.fr/nos-appels-a-projets-concours/aap-1',lifecycleStatus:'ACTIVE'};
test('distinct pages cannot collapse to the same identifier',()=>{
 assert.notEqual(directPageId('bpifrance',valid.officialPage),directPageId('bpifrance',valid.officialPage+'-2'));
});
test('stock, mixed provenance, foreign domains and catalog pages are rejected',()=>{
 const rows=[valid,{...valid,id:'ae_1'},{...valid,sourceAliases:['aides_entreprises']},{...valid,verification:{fieldEvidence:[{sourceUrl:'https://data.aides-entreprises.fr/stock'}]}},{...valid,officialPage:'https://example.com/aap'},{...valid,officialPage:cfg.sources[0].url}];
 assert.deepEqual(filterDirectLibrary(rows,cfg),[valid]);
 assert.throws(()=>assertDirectSources({...cfg,sources:[...cfg.sources,{id:'aides_entreprises',official:true,url:'https://data.aides-entreprises.fr/stock',strategy:'aides-entreprises'}]}));
});
test('purge cleans internal data without republishing raw exports and is repeatable',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'direct-source-test-'));
 try{
  await fs.mkdir(path.join(root,'config'),{recursive:true});await fs.mkdir(path.join(root,'site/data'),{recursive:true});
  await fs.writeFile(path.join(root,'config/sources.json'),JSON.stringify(cfg));
  await fs.writeFile(path.join(root,'config/collection-lock.json'),JSON.stringify({
   locked:true,mode:'GUICHET',name:'Bpifrance test',allowedSourceIds:['bpifrance']
  }));
  await fs.writeFile(path.join(root,'site/data/library.json'),JSON.stringify({meta:{generatedAt:'2026-09-28'},aaps:[valid,{...valid,id:'ae_1',sourceId:'aides_entreprises'}]}));
  await fs.writeFile(path.join(root,'site/data/changes.json'),JSON.stringify([{id:'bpi1'},{id:'ae_1'}]));
  const first=await purgeIndirectSources(root),second=await purgeIndirectSources(root);
  assert.deepEqual(first,second);assert.equal(second.meta.generatedAt,'2026-09-28');assert.equal(second.aaps.length,1);
  for(const f of ['site/data/library.json','site/data/changes.json'])assert.doesNotMatch(await fs.readFile(path.join(root,f),'utf8'),/ae_1|aides_entreprises/);
  for(const obsolete of ['site/data/bootstrap.js','site/data/library.previous.json','site/bibliotheque/radar-library.json','site/bibliotheque/radar-library.csv'])assert.equal(await fs.stat(path.join(root,obsolete)).then(()=>true).catch(()=>false),false,obsolete);
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


test('la purge élimine les doublons d’URL même avec des IDs différents',()=>{
 const a={...valid,id:'a1'};
 const b={...valid,id:'a2'};
 const out=filterDirectLibrary([a,b],cfg);
 assert.equal(out.length,1);
});

test('les statuts CLOSED/CLOS/EXPIRED ne survivent pas dans le stock direct',()=>{
 for(const lifecycleStatus of ['CLOSED','CLOS','EXPIRED','STALE','ARCHIVE'])assert.equal(filterDirectLibrary([{...valid,id:lifecycleStatus,lifecycleStatus}],cfg).length,0);
});

test('une simple mention textuelle de data.gouv.fr ne supprime pas une fiche officielle valide',()=>{
 const aid={...valid,id:'text-mention',objective:'Les données sectorielles peuvent aussi être consultées sur data.gouv.fr.'};
 assert.equal(filterDirectLibrary([aid],cfg).length,1);
});

test('les alias objets vers une source exclue sont correctement purgés',()=>{
 const localCfg={...cfg,excludedSources:['old_control']};
 const aid={...valid,id:'aliases',sourceAliases:[{sourceId:'old_control'},{sourceId:'bpifrance'}]};
 const out=sanitizeAidLinks(aid,localCfg);
 assert.deepEqual(out.sourceAliases,[{sourceId:'bpifrance'}]);
});


test('la purge retire physiquement les instruments hors périmètre du stock opérationnel',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'target-purge-test-'));
 try{
  await fs.mkdir(path.join(root,'config'),{recursive:true});await fs.mkdir(path.join(root,'site/data'),{recursive:true});
  await fs.writeFile(path.join(root,'config/sources.json'),JSON.stringify(cfg));
  await fs.writeFile(path.join(root,'config/collection-lock.json'),JSON.stringify({locked:true,mode:'GUICHET',name:'Bpifrance test',allowedSourceIds:['bpifrance']}));
  const other={...valid,id:'other',kind:'AIDE',aidTypes:['AUTRE'],officialPage:'https://www.bpifrance.fr/nos-appels-a-projets-concours/autre'};
  await fs.writeFile(path.join(root,'site/data/library.json'),JSON.stringify({meta:{generatedAt:'2026-10-03'},aaps:[valid,other]}));
  const clean=await purgeIndirectSources(root);
  assert.equal(clean.aaps.length,1);
  assert.equal(clean.aaps[0].id,'bpi1');
  assert.equal(clean.meta.purgeStats.removedOutOfTarget,1);
  assert.ok(!clean.meta.libraryInstruments.includes('AUTRE'));
 }finally{await fs.rm(root,{recursive:true,force:true})}
});


test('les doublons de liens entre familles sont éliminés avec priorité aux liens spécialisés',()=>{
 const row={...valid,
   sourceLinks:[
     {label:'page',url:'https://www.bpifrance.fr/nos-appels-a-projets-concours/aap-1'},
     {label:'pdf dupliqué',url:'https://media.bpifrance.fr/cdc.pdf'}
   ],
   cdcLinks:[{label:'CdC',url:'https://media.bpifrance.fr/cdc.pdf'}],
   regulationLinks:[{label:'Règlement',url:'https://media.bpifrance.fr/reglement.pdf'}],
   formLinks:[{label:'Formulaire',url:'https://media.bpifrance.fr/formulaire.pdf'}]
 };
 const out=sanitizeAidLinks(row,cfg);
 const urls=[...(out.sourceLinks||[]),...(out.cdcLinks||[]),...(out.regulationLinks||[]),...(out.formLinks||[])]
  .map(x=>typeof x==='string'?x:x.url);
 assert.equal(new Set(urls).size,urls.length);
 assert.equal(out.cdcLinks.length,1);
 assert.equal(out.sourceLinks.some(x=>(typeof x==='string'?x:x.url).includes('cdc.pdf')),false);
});


test('une fiche quarantinée d’une source déjà certifiée quitte le stock opérationnel',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'certified-quarantine-test-'));
 try{
  const localCfg={
   version:'test',
   sourcePolicy:'DIRECT_OFFICIAL_ONLY',
   sourceSelectionPolicy:'GUICHET_OR_REGION_OFFICIAL_ONLY',
   sources:[
    {id:'bpifrance',official:true,strategy:'official-page',url:'https://www.bpifrance.fr/offre-test'},
    {id:'aura',official:true,strategy:'official-page',url:'https://www.auvergnerhonealpes.fr/aides/test'}
   ]
  };
  await fs.mkdir(path.join(root,'config'),{recursive:true});
  await fs.mkdir(path.join(root,'site/data'),{recursive:true});
  await fs.writeFile(path.join(root,'config/sources.json'),JSON.stringify(localCfg));
  await fs.writeFile(path.join(root,'config/collection-lock.json'),JSON.stringify({
   locked:true,mode:'REGION',name:'AURA test',allowedSourceIds:['aura']
  }));
  await fs.writeFile(path.join(root,'site/data/bpifrance-certification.json'),JSON.stringify({
   status:'PASS',generatedAt:'2026-10-03T00:00:00Z',configuredSources:['bpifrance'],lock:{name:'Bpifrance'}
  }));
  const evidence=[
   {field:'guichet',sourceTier:'B',sourceUrl:'https://www.bpifrance.fr/offre-test'},
   {field:'sourceStatus',sourceTier:'B',sourceUrl:'https://www.bpifrance.fr/offre-test'},
   {field:'instrument',sourceTier:'B',sourceUrl:'https://www.bpifrance.fr/offre-test'},
   {field:'enterpriseEligibility',sourceTier:'B',sourceUrl:'https://www.bpifrance.fr/offre-test'}
  ];
  const clean={...valid,id:'bpi-clean',sourceId:'bpifrance',officialPage:'https://www.bpifrance.fr/offre-test',
   verification:{status:'VERIFIE',fieldEvidence:evidence}};
  const quarantined={...clean,id:'bpi-bad',officialPage:'https://www.bpifrance.fr/offre-bad',
   verification:{status:'A_REVERIFIER',fieldEvidence:evidence.filter(e=>e.field!=='enterpriseEligibility')}};
  const aura={...clean,id:'aura-current',sourceId:'aura',officialPage:'https://www.auvergnerhonealpes.fr/aides/test',
   verification:{status:'A_REVERIFIER',fieldEvidence:[]}};
  await fs.writeFile(path.join(root,'site/data/library.json'),JSON.stringify({meta:{generatedAt:'2026-10-03'},aaps:[clean,quarantined,aura]}));
  const out=await purgeIndirectSources(root);
  assert.deepEqual(out.aaps.map(x=>x.id).sort(),['aura-current','bpi-clean']);
  assert.equal(out.meta.purgeStats.removedCertifiedQuarantine,1);
 }finally{await fs.rm(root,{recursive:true,force:true})}
});
