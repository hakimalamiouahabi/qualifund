import test from 'node:test';
import assert from 'node:assert/strict';
import { fromAidesEntreprises } from '../scripts/lib/records.mjs';

test('Aides Entreprises conserve une aide entreprise sans profil de taille explicite', () => {
  const audit={};
  const aid=fromAidesEntreprises({
    id_aid: 999001,
    status: 1,
    aid_nom: 'Aide entreprise sans profil de taille',
    aid_objet: 'Soutien aux investissements des entreprises',
    aid_benef: 'Entreprises',
    aid_operations_el: 'Investissements éligibles',
    aid_conditions: 'Conditions à vérifier',
    aid_montant: 'Subvention',
    cache_indexation: {
      profils: [],
      territoires: [{ter_libelle:'FRANCE'}],
      natures: [{id_typ:3,typ_libelle:'Subvention'}],
      financeurs: [{org_nom:'Organisme public'}],
      projets: []
    },
    complements: {}
  }, audit);
  assert.ok(aid);
  assert.equal(aid.scope,'NATIONAL');
  assert.deepEqual(aid.companyCategories,[]);
  assert.ok(aid.aidTypes.includes('SUBVENTION'));
  assert.equal(audit.profileNotIndexed, undefined);
});
