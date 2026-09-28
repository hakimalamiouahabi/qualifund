import test from 'node:test';
import assert from 'node:assert/strict';
import { isGenericCatalogPage, specificOfficialPage } from '../scripts/lib/source-proof.mjs';

test('le stock Aides Entreprises générique ne peut pas devenir une preuve B de fiche',()=>{
  assert.equal(isGenericCatalogPage('https://data.aides-entreprises.fr/stock'),true);
  assert.equal(isGenericCatalogPage('https://data.aides-entreprises.fr/files/aides.json'),true);
  assert.equal(specificOfficialPage({officialPage:'https://data.aides-entreprises.fr/stock',sourceLinks:[]}),null);
});

test('une page opérateur spécifique reste éligible à l’enrichissement B',()=>{
  const u='https://www.bpifrance.fr/catalogue-offres/example';
  assert.equal(isGenericCatalogPage(u),false);
  assert.equal(specificOfficialPage({officialPage:'https://data.aides-entreprises.fr/stock',sourceLinks:[{url:u}]}),u);
});
