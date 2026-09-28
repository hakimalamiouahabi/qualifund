import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rowsFromStock } from '../scripts/connectors/aides-entreprises.mjs';
import { rowToOpenDataSoftAid } from '../scripts/connectors/opendatasoft.mjs';
const cfg=JSON.parse(fs.readFileSync(new URL('../config/sources.json',import.meta.url),'utf8'));

test('stock Aides Entreprises accepte les formes array/data/results/aides',()=>{
  const row={id_aid:1};
  assert.equal(rowsFromStock([row]).length,1);
  assert.equal(rowsFromStock({data:[row]}).length,1);
  assert.equal(rowsFromStock({results:[row]}).length,1);
  assert.equal(rowsFromStock({aides:[row]}).length,1);
});

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

import { fromAidesEntreprises } from '../scripts/lib/records.mjs';

test('preuves Aides Entreprises pointent vers le stock Open Data public et non vers API protégée',()=>{
  const raw={id_aid:42,status:1,aid_nom:'Aide test',aid_objet:'Objet',aid_benef:'PME',aid_operations_el:'Dépenses',aid_conditions:'Conditions',aid_montant:'50 %',date_fin:'2026-12-31',cache_indexation:{natures:[{id_typ:3,typ_libelle:'Subvention'}],profils:[{id_tut:4}],territoires:[{ter_libelle:'FRANCE'}],financeurs:[],projets:[]},complements:{source:[],reglement:[],formulaire:[]}};
  const a=fromAidesEntreprises(raw);
  assert.equal(a.officialPage,'https://data.aides-entreprises.fr/stock');
  assert.ok(a.verification.fieldEvidence.every(e=>e.sourceUrl==='https://data.aides-entreprises.fr/stock'));
  assert.ok(a.verification.fieldEvidence.every(e=>/Open Data/.test(e.locator)));
});

test('sources de contrôle PDL et Région Sud ont une description technique cohérente',()=>{
  const pdl=cfg.sources.find(x=>x.id==='pdl_opendata_interventions');
  assert.equal(pdl.api,'https://data.paysdelaloire.fr/api/explore/v2.1/');
  assert.equal(pdl.datasetId,'234400034_fluxinterventionsprod_pdl');
  const sud=cfg.sources.find(x=>x.id==='paca_aides_json');
  assert.equal(sud.type,'web');
  assert.equal(sud.strategy,'control-only');
});
