import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseAdemeRss, parseAdemeCatalogueHtml, ademeStatusProof } from '../scripts/connectors/ademe.mjs';

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
  assert.equal(lock.version,4);
  assert.deepEqual(lock.allowedSourceIds,['ademe']);
});

test('le catalogue Entreprises est la source maître ADEME et le catalogue clos est déclaré',()=>{
  const cfg=JSON.parse(fs.readFileSync(new URL('../config/sources.json',import.meta.url),'utf8'));
  const s=cfg.sources.find(x=>x.id==='ademe');
  assert.equal(s.strategy,'ademe-official');
  assert.equal(s.url,'https://agirpourlatransition.ademe.fr/entreprises/aides-financieres/catalogue');
  assert.match(s.closedCatalogueUrl,/catalogue-aides-closes$/);
  assert.match(s.rssUrl,/agirpourlatransition\.ademe\.fr/);
});

test('le catalogue ADEME reprend directement la classification Appel à projet / Aide',()=>{
  const html=`<main>
    <p>2 dispositifs d’aide correspondent à vos critères</p>
    <article class="card"><span>Appel à projet</span><a href="/entreprises/aides-financieres/catalogue/aap/decarbonation">Décarbonation</a><span>Ouvert jusqu'au 09 février 2027</span><span>Toutes les Régions</span></article>
    <article class="card"><span>Aide</span><a href="/entreprises/aides-financieres/catalogue/2026/etude-x">Étude X</a><span>Ouvert jusqu'au 31 décembre 2026</span><span>Toutes les Régions</span></article>
    <a href="/entreprises/aides-financieres/catalogue-rex/demo">REX</a>
    <a href="/entreprises/aides-financieres/catalogue?page=1">Suite</a>
  </main>`;
  const out=parseAdemeCatalogueHtml(html,'https://agirpourlatransition.ademe.fr/entreprises/aides-financieres/catalogue');
  assert.equal(out.totalCount,2);
  assert.equal(out.aids.length,2);
  assert.equal(out.aapCount,1);
  assert.equal(out.aidCount,1);
  assert.equal(out.unclassifiedCount,0);
  assert.equal(out.aids.find(x=>x.label==='Décarbonation').catalogueKind,'AAP / AMI');
  assert.equal(out.aids.find(x=>x.label==='Étude X').catalogueKind,'AIDE');
  assert.equal(out.aids.find(x=>x.label==='Décarbonation').catalogueClosingDate,'2027-02-09');
  assert.ok(out.pages.some(x=>x.includes('page=1')));
});

test('un titre contenant aide ne suffit jamais à classifier une carte sans statut ouvert',()=>{
  const html='<main><h2><a href="/entreprises/aides-financieres/catalogue/aap/aide-experimentale">Aide expérimentale</a></h2></main>';
  const out=parseAdemeCatalogueHtml(html,'https://agirpourlatransition.ademe.fr/entreprises/aides-financieres/catalogue');
  assert.equal(out.aids.length,1);
  assert.equal(out.aids[0].catalogueKind,null);
  assert.equal(out.unclassifiedCount,1);
});

test('la certification ADEME v3 exige complétude, classification et appartenance au catalogue maître',()=>{
  const lock=JSON.parse(fs.readFileSync(new URL('../config/collection-lock.json',import.meta.url),'utf8'));
  assert.equal(lock.certification.requireCatalogueDiscovery,true);
  assert.equal(lock.certification.requireCatalogueCompleteness,true);
  assert.equal(lock.certification.requireCatalogueClassification,true);
  assert.equal(lock.certification.requireCatalogueMasterMembership,true);
  assert.equal(lock.certification.requireRssDiscovery,true);
  assert.equal(lock.certification.requireExternalAuditDiscovery,true);
});

test("le contre-audit multi-moteurs reste un contrôle et n'est pas vide",()=>{
  const audit=JSON.parse(fs.readFileSync(new URL('../config/ademe-v2-external-audit.json',import.meta.url),'utf8'));
  assert.ok(audit.candidateCount>0);
  assert.ok(audit.engines.includes('Exa'));
  assert.ok(audit.engines.includes('Tavily'));
  assert.ok(audit.engines.includes('Parallel Search'));
  assert.ok(audit.engines.includes('Firecrawl'));
});

test('une fiche directe indiquée close entre en conflit avec le catalogue actif',()=>{
  const out=ademeStatusProof({deadlines:['2026-12-31'],finalClosingDate:'2026-12-31'},"Cet appel à projets est maintenant clos.",new Date('2026-09-30T12:00:00Z'));
  assert.equal(out.state,'STATUS_CONFLICT');
  assert.equal(out.retain,false);
});
