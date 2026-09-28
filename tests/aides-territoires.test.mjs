import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fromAidesTerritoires } from '../scripts/connectors/aides-territoires.mjs';

const base={id:123,slug:'demo',url:'/aides/demo/',name:'Aide innovation entreprise',description:'Soutien à un projet d’innovation et de démonstrateur.',eligibility:'PME et entreprises privées.',perimeter:'Occitanie',targeted_audiences:['Entreprises privées'],aid_types:['Subvention','Prêt'],submission_deadline:'2026-12-31',subvention_rate_lower_bound:20,subvention_rate_upper_bound:50,financers:['Région X'],categories:['Développement économique|Innovation'],application_url:'https://example.test/candidature'};

test('Aides Territoires importe une aide financière destinée aux entreprises privées',()=>{
  const a=fromAidesTerritoires(base);assert.ok(a);assert.equal(a.scope,'REGIONAL');assert.deepEqual(a.regions,['Occitanie']);assert.deepEqual(a.aidTypes.sort(),['SUBVENTION']);assert.equal(a.closingDate,'2026-12-31');assert.equal(a.sourceId,'aides_territoires');
});

test('Aides Territoires exclut les aides réservées aux collectivités',()=>{
  assert.equal(fromAidesTerritoires({...base,targeted_audiences:['Communes']}),null);
});

test('Aides Territoires exclut l’ingénierie hors instruments Qualifund',()=>{
  assert.equal(fromAidesTerritoires({...base,aid_types:['Ingénierie technique']}),null);
});

test('registre bascule Aides Territoires en ingestion avec plancher prudent',()=>{
  const cfg=JSON.parse(fs.readFileSync(new URL('../config/sources.json',import.meta.url),'utf8'));const s=cfg.sources.find(x=>x.id==='aides_territoires');assert.equal(s.strategy,'aides-territoires');assert.ok(s.minExpected>=2500);
});


test('Aides Territoires accepte un prêt seulement avec preuve taux zéro',()=>{
  const a=fromAidesTerritoires({...base,id:124,name:'Prêt innovation à taux zéro',description:'Financement sans intérêt',aid_types:['Prêt'],loan_amount:'100 000 €'});
  assert.ok(a);assert.deepEqual(a.aidTypes,['PRET_TAUX_ZERO']);
});
