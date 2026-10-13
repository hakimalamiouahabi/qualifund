import test from 'node:test';
import assert from 'node:assert/strict';
import { rechercherEntreprise, rechercherJeuxDeDonnees } from '../official_apis.mjs';

test('API entreprises : appel officiel sans dossier client enregistré', async () => {
  let captured;
  const mock = async (url, options) => {
    captured = { url, options };
    return { ok: true, json: async () => ({ results: [{ siren: '123456789', nom_complet: 'FICTIVE', dirigeants: ['SHOULD_NOT_EXPORT'], siege: { libelle_commune: 'PARIS' } }] }) };
  };
  const result = await rechercherEntreprise('société de test', mock);
  assert.match(captured.url, /^https:\/\/recherche-entreprises\.api\.gouv\.fr\/search\?/);
  assert.equal(result.companies.length, 1);
  assert.equal(result.companies[0].siren, '123456789');
  assert.equal('dirigeants' in result.companies[0], false);
  assert.equal(result.eligibility_determined, false);
});

test('data.gouv : catalogue ouvert et aucune conclusion d éligibilité', async () => {
  let urlCalled;
  const mock = async url => { urlCalled = url; return { ok: true, json: async () => ({ data: [{ id: 'fiction', title: 'Données de test' }] }) }; };
  const result = await rechercherJeuxDeDonnees('feder', mock);
  assert.equal(new URL(urlCalled).host, 'www.data.gouv.fr');
  assert.equal(result.datasets[0].title, 'Données de test');
  assert.equal(result.eligibility_determined, false);
});
