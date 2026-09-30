import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rowToOpenDataSoftAid } from '../scripts/connectors/opendatasoft.mjs';
const cfg=JSON.parse(fs.readFileSync(new URL('../config/sources.json',import.meta.url),'utf8'));


test('Occitanie est désormais une source ingérée et non control-only',()=>{
  const s=cfg.sources.find(x=>x.id==='occitanie');
  assert.equal(s.strategy,'opendatasoft');
  assert.ok(s.datasetId.includes('aides-et-appels-a-projets'));
});

test('IDF possède le dataset officiel aides-appels-a-projets',()=>{
  const s=cfg.sources.find(x=>x.id==='idf');
  assert.equal(s.datasetId,'aides-appels-a-projets');
});

test('mapping OpenDataSoft conserve un AAP régional même si nature financière implicite',()=>{
  const a=rowToOpenDataSoftAid({titre:'Appel à projets Industrie verte',description:'Innovation et décarbonation pour les PME',public:'PME',cloture:'31/12/2026',url:'https://example.test/aap'},{id:'test',name:'Région Test',scope:'Occitanie',url:'https://example.test',datasetId:'dataset-test'},0);
  assert.equal(a.kind,'AAP / AMI');
  assert.equal(a.scope,'REGIONAL');
  assert.ok(a.aidTypes.includes('SUBVENTION'));
});



test('PDL conserve son API officielle sur la source principale et Région Sud son contrôle spécifique',()=>{
  const pdl=cfg.sources.find(x=>x.id==='pdl');
  assert.equal(pdl.api,'https://data.paysdelaloire.fr/api/explore/v2.1/');
  assert.equal(pdl.datasetId,'234400034_fluxinterventionsprod_pdl');
  assert.equal(cfg.sources.some(x=>x.id==='pdl_opendata_interventions'),false);
  const sud=cfg.sources.find(x=>x.id==='paca_aides_json');
  assert.equal(sud.type,'web');
  assert.equal(sud.strategy,'control-only');
});
