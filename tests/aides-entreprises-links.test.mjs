import test from 'node:test';
import assert from 'node:assert/strict';
import { fromAidesEntreprises } from '../scripts/lib/records.mjs';

const base={
  id_aid:123,status:1,aid_nom:'Aide test',aid_objet:'Soutenir un projet d’innovation',
  aid_benef:'PME',aid_operations_el:'Dépenses de R&D',aid_conditions:'Projet en France',
  aid_montant:'50 %',date_fin:'2026-12-31',
  cache_indexation:{
    territoires:[{ter_libelle:'FRANCE'}],
    profils:[{id_tut:'4'}],natures:[{id_typ:'1',typ_libelle:'Subvention'}],
    projets:[{proj_libelle:'Innovation'}],financeurs:[{org_nom:'Financeur test'}]
  },complements:{}
};

test('sans source détaillée, le stock Aides Entreprises n’est pas présenté comme page officielle',()=>{
  const a=fromAidesEntreprises(base);
  assert.equal(a.officialPage,null);
  assert.ok(a.verification.fieldEvidence.every(x=>x.sourceUrl==='https://data.aides-entreprises.fr/stock'));
});

test('une source détaillée est conservée comme page officielle directe',()=>{
  const raw={...base,id_aid:124,complements:{source:[{texte:'Source',lien:'https://financeur.fr/aides/aide-test'}]}};
  const a=fromAidesEntreprises(raw);
  assert.equal(a.officialPage,'https://financeur.fr/aides/aide-test');
});
