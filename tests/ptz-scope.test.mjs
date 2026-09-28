import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeAidTypes } from '../scripts/lib/utils.mjs';
import { fromAidesTerritoires } from '../scripts/connectors/aides-territoires.mjs';
import { fromAidesEntreprises } from '../scripts/lib/records.mjs';

test('normalisation : accepte uniquement les prêts explicitement à taux zéro / honneur',()=>{
  assert.deepEqual(normalizeAidTypes('Prêt d’honneur à taux zéro sans intérêt'),['PRET_TAUX_ZERO']);
  assert.deepEqual(normalizeAidTypes('Prêt à taux 0% pour l’innovation'),['PRET_TAUX_ZERO']);
  assert.deepEqual(normalizeAidTypes('Prêt bancaire à 3,8 %'),[]);
});

test('Aides Territoires : un loan n’entre que si le texte prouve le taux zéro',()=>{
  const base={id:1,slug:'ptz',url:'/aides/ptz/',name:'Prêt innovation à taux zéro',description:'Prêt sans intérêt pour un projet innovant.',eligibility:'PME entreprises privées',perimeter:'Occitanie',targeted_audiences:['Entreprises privées'],aid_types:['Prêt'],loan_amount:'50 000 €',submission_deadline:'2027-12-31'};
  const a=fromAidesTerritoires(base);assert.ok(a);assert.deepEqual(a.aidTypes,['PRET_TAUX_ZERO']);
  assert.equal(fromAidesTerritoires({...base,name:'Prêt croissance',description:'Prêt avec intérêts au taux de 3,5 %'}),null);
});

test('Aides Entreprises : prêt honneur/taux zéro est accepté sans ouvrir les prêts classiques',()=>{
  const raw={id_aid:42,aid_nom:"Prêt d'honneur innovation",aid_objet:'Financer un projet innovant',aid_montant:'Prêt à taux zéro de 20 000 €',aid_conditions:'PME',aid_benef:'PME',date_fin:'2027-12-31',cache_indexation:{natures:[{id_typ:5,typ_libelle:"Prêt d'honneur"}],profils:[{id_tut:4}],territoires:[{ter_libelle:'FRANCE'}],projets:[],financeurs:[]},complements:{source:[],reglement:[],formulaire:[]}};
  const a=fromAidesEntreprises(raw);assert.ok(a);assert.ok(a.aidTypes.includes('PRET_TAUX_ZERO'));
  const classic={...raw,id_aid:43,aid_nom:'Prêt croissance',aid_montant:'Prêt à 4 %',cache_indexation:{...raw.cache_indexation,natures:[{id_typ:5,typ_libelle:'Prêt'}]}};
  assert.equal(fromAidesEntreprises(classic),null);
});

test('sources PTZ officielles Occitanie et Région Sud sont ingestives',()=>{
  const cfg=JSON.parse(fs.readFileSync(new URL('../config/sources.json',import.meta.url),'utf8'));
  for(const id of ['occitanie_foster','paca_feder_loan']){const s=cfg.sources.find(x=>x.id===id);assert.equal(s.strategy,'official-page');assert.equal(s.forceAidType,'PRET_TAUX_ZERO');}
});
