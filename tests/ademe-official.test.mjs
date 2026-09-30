import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseAdemeRss, parseAdemeCatalogueHtml, ademeAttributionEvidence, ademeStatusProof } from '../scripts/connectors/ademe.mjs';

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

test('le catalogue ADEME ne conserve que les liens de fiches directes',()=>{
  const html='<main><a href="/entreprises/aides-financieres/catalogue/2026/aide-a">Aide A</a><a href="/entreprises/aides-financieres/catalogue-rex/demo">REX</a><a href="/entreprises/aides-financieres/catalogue?page=2">Suite</a></main>';
  const out=parseAdemeCatalogueHtml(html,'https://agirpourlatransition.ademe.fr/entreprises/aides-financieres/catalogue');
  assert.equal(out.aids.length,1);
  assert.equal(out.aids[0].label,'Aide A');
  assert.ok(out.pages.some(x=>x.includes('page=2')));
});

test('la certification ADEME exige les deux canaux officiels',()=>{
  const lock=JSON.parse(fs.readFileSync(new URL('../config/collection-lock.json',import.meta.url),'utf8'));
  assert.equal(lock.certification.requireCatalogueDiscovery,true);
  assert.equal(lock.certification.requireRssDiscovery,true);
});


test('ADEME v2 refuse une simple mention générique de transition écologique',()=>{
  assert.equal(ademeAttributionEvidence("Ce dispositif régional accompagne la transition écologique des entreprises."),null);
  assert.equal(Boolean(ademeAttributionEvidence("L’ADEME vous accompagne en finançant votre étude de faisabilité.")),true);
});

test('ADEME v2 ne traite pas une échéance ancienne comme ouverte',()=>{
  const a={deadlines:['2024-12-31'],closingDate:'2024-12-31',finalClosingDate:'2024-12-31',permanent:false};
  const out=ademeStatusProof(a,"Cet appel à projets est maintenant clos.",new Date('2026-09-30T12:00:00Z'));
  assert.equal(out.state,'CLOSED_OLD');
  assert.equal(out.retain,false);
});

test('ADEME v2 conserve une échéance future et une clôture J-60',()=>{
  const open=ademeStatusProof({deadlines:['2026-12-31'],finalClosingDate:'2026-12-31'},"Aide en cours",new Date('2026-09-30T12:00:00Z'));
  assert.equal(open.state,'OPEN');
  assert.equal(open.retain,true);
  const recent=ademeStatusProof({deadlines:['2026-09-15'],finalClosingDate:'2026-09-15'},"Appel à projets",new Date('2026-09-30T12:00:00Z'));
  assert.equal(recent.state,'RECENTLY_CLOSED');
  assert.equal(recent.retain,true);
});

test('le verrou ADEME v2 exige le contre-audit et les preuves métier',()=>{
  const lock=JSON.parse(fs.readFileSync(new URL('../config/collection-lock.json',import.meta.url),'utf8'));
  assert.equal(lock.version,3);
  assert.equal(lock.certification.requireExternalAuditDiscovery,true);
  assert.equal(lock.certification.requireGuichetEvidence,true);
  assert.equal(lock.certification.requireCurrentStatusEvidence,true);
  assert.equal(lock.certification.requireEnterpriseScope,true);
  assert.match(lock.certification.externalAuditFile,/ademe-v2-external-audit\.json$/);
});

test("le manifeste multi-moteurs ADEME v2 n'est pas vide",()=>{
  const audit=JSON.parse(fs.readFileSync(new URL('../config/ademe-v2-external-audit.json',import.meta.url),'utf8'));
  assert.ok(audit.candidateCount>0);
  assert.ok(audit.candidates.length===audit.candidateCount);
  assert.ok(audit.engines.includes('Exa'));
  assert.ok(audit.engines.includes('Tavily'));
  assert.ok(audit.engines.includes('Parallel Search'));
  assert.ok(audit.engines.includes('Firecrawl'));
  for(const x of audit.candidates)assert.match(x.url,/^https:\/\/agirpourlatransition\.ademe\.fr\/entreprises\/aides-financieres\/catalogue\//);
});
