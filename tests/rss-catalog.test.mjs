import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRssLinks } from '../scripts/connectors/web-catalog.mjs';

test('le flux officiel conserve les appels entreprises et écarte les liens hors catalogue',()=>{
  const source={linkInclude:'/entreprises/aides-financieres/'};
  const xml=`<rss><channel>
    <item><title>Appel à projets énergie</title><link>https://agirpourlatransition.ademe.fr/entreprises/aides-financieres/catalogue/aap/energie</link></item>
    <item><title>Événement</title><link>https://agirpourlatransition.ademe.fr/agenda/rencontre</link></item>
  </channel></rss>`;
  const links=parseRssLinks(xml,source);
  assert.equal(links.length,1);
  assert.match(links[0].url,/catalogue\/aap\/energie$/);
});
