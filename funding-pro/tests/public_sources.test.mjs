import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {normalizeDataGouv,normalizeAdeme,normalizeAidesTerritoires,collectOffline,collectLive} from '../sources/ingest_official.mjs';
const registry=JSON.parse(fs.readFileSync(join(dirname(fileURLToPath(import.meta.url)),'../sources/registry.json'),'utf8'));
test('data.gouv: jeu de données, jamais subvention certifiée',()=>{
 const rows=normalizeDataGouv({data:[{id:'id-a',title:'Appels à projets publics',page:'https://www.data.gouv.fr/datasets/test',
 last_update:'2026-10-12',organization:{name:'Collectivité'},
 resources:[{title:'Guide public',format:'pdf',url:'https://www.data.gouv.fr/file.pdf'},{title:'Non sûre',format:'pdf',url:'http://example.org/file.pdf'}]}]});
 assert.equal(rows.length,1);
 assert.equal(rows[0].category,'JEU_DE_DONNEES');
 assert.equal(rows[0].eligibility,'NON_ETABLIE');
 assert.equal(rows[0].funding_rate,null);
 assert.equal(rows[0].documents.length,1);
});
test('ADEME: catalogue statistique sans preuve de dispositif ouvert',()=>{
 const r=normalizeAdeme({results:[{id:'aide-ademe',title:'Les aides financières de l ADEME',updatedAt:'2026-10-12'}]});
 assert.equal(r.length,1);assert.equal(r[0].category,'JEU_DE_DONNEES');assert.equal(r[0].deadline,null);
});
test('Aides Territoires: aide à vérifier chez le financeur, pas preuve de taux',()=>{
 const r=normalizeAidesTerritoires({results:[{id:333,name:'Aide aux territoires',url:'/aides/test/'}]});
 assert.equal(r.length,1);assert.equal(r[0].category,'AIDE_A_QUALIFIER');
 assert.equal(r[0].instrument,'NON_DETERMINE');
 assert.equal(r[0].status,'A_VERIFIER');
});
test('references de portails: acces indirect, aucune eligibilite',()=>{
 const data=collectOffline(registry);
 assert.equal(data.collection_mode,'OFFLINE_REFERENCES_ONLY');
 assert.ok(data.records.length>=7);
 assert.ok(data.records.some(r=>r.category==='DOCUMENT_PDF_OFFICIEL' && r.documents.some(d=>d.format==='pdf')));
 assert.ok(data.records.every(r=>r.eligibility==='NON_ETABLIE' && r.funding_rate===null && r.funding_cap===null));
});
test('live avec API simulees: collecteur traite les sources et les echecs sans inventer',async()=>{
 const calls=[];
 const mocked=async url=>{
  calls.push(url);
  if(url.includes('data.gouv.fr/api/1/datasets/')){
   return {ok:true,headers:{get:()=> 'application/json'},json:async()=>({data:[{id:'abc',title:'Jeu d aide',page:'https://www.data.gouv.fr/datasets/abc'}]})};
  }
  if(url.includes('data.ademe.fr'))return {ok:true,headers:{get:()=> 'application/json'},json:async()=>({results:[]})};
  return {ok:false,status:401,headers:{get:()=> 'application/json'}};
 };
 const out=await collectLive(registry,{fetcher:mocked,maxPerQuery:2,includeAT:true});
 assert.ok(calls.length>=3);
 assert.ok(out.records.some(r=>r.source_id==='datagouv'));
 assert.ok(out.runs.some(r=>r.source==='aides_territoires'&&r.status==='ERREUR'));
 assert.ok(out.records.every(r=>r.eligibility==='NON_ETABLIE'));
});
