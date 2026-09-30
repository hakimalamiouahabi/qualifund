import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseAdemeRss } from '../scripts/connectors/ademe.mjs';

test('le RSS ADEME ne conserve que les fiches officielles du catalogue',()=>{
  const xml=`<rss><channel>
    <item><title>AAP Décarbonation</title><link>https://agirpourlatransition.ademe.fr/entreprises/aides-financieres/catalogue/aap/decarbonation</link></item>
    <item><title>Retour d'expérience</title><link>https://agirpourlatransition.ademe.fr/entreprises/aides-financieres/catalogue-rex/demo</link></item>
    <item><title>Actualité</title><link>https://agirpourlatransition.ademe.fr/entreprises/actualites/demo</link></item>
  </channel></rss>`;
  const links=parseAdemeRss(xml);
  assert.equal(links.length,1);
  assert.match(links[0].url,/catalogue\/aap\/decarbonation$/);
});

test('ADEME est le seul guichet actif du verrou courant',()=>{
  const lock=JSON.parse(fs.readFileSync(new URL('../config/collection-lock.json',import.meta.url),'utf8'));
  assert.equal(lock.locked,true);
  assert.equal(lock.name,'ADEME');
  assert.deepEqual(lock.allowedSourceIds,['ademe']);
  assert.equal(lock.certification.requireZeroExtractionErrors,true);
});

test('la source ADEME utilise le collecteur officiel dédié sans agrégateur',()=>{
  const cfg=JSON.parse(fs.readFileSync(new URL('../config/sources.json',import.meta.url),'utf8'));
  const s=cfg.sources.find(x=>x.id==='ademe');
  assert.equal(s.strategy,'ademe-official');
  assert.match(s.url,/agirpourlatransition\.ademe\.fr/);
  assert.match(s.rssUrl,/agirpourlatransition\.ademe\.fr/);
  assert.equal(cfg.sources.some(x=>x.id==='ademe_aides_historique'),false);
});
