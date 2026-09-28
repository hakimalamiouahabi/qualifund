import test from 'node:test';
import assert from 'node:assert/strict';
import { isPaginationLink, relevantLink } from '../scripts/lib/catalog-links.mjs';

test('pagination standard et currentPage régionale reconnue',()=>{
  assert.equal(isPaginationLink('2','https://example.fr/aides?page=2'),true);
  assert.equal(isPaginationLink('3','https://entreprises.maregionsud.fr/aides-et-appels-a-projet?tx_eannuaires_pi1%5BcurrentPage%5D=3'),true);
  assert.equal(isPaginationLink('Suivant','https://example.fr/aides?foo=bar'),true);
});

test('liens financement élargis',()=>{
  const s={};
  assert.equal(relevantLink(s,'Appel à candidatures','https://example.fr/selection'),true);
  assert.equal(relevantLink(s,'Avance remboursable','https://example.fr/dispositif'),true);
  assert.equal(relevantLink(s,'Prêt innovation','https://example.fr/dispositif'),true);
});
