import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  parseBpifranceAapListingHtml,
  classifyBpifranceInstrument
} from '../scripts/connectors/bpifrance.mjs';

test('le listing Bpifrance extrait les AAP directs sans confondre pagination et catalogue',()=>{
  const html=`<main>
    <article><span>01/01/2026 au 31/12/2026</span><h3><a href="/nos-appels-a-projets-concours/aap-test">AAP Test</a></h3></article>
    <a href="/nos-appels-a-projets-concours?page=1">Suivant</a>
    <a href="/catalogue-offres/subvention-innovation">hors listing</a>
  </main>`;
  const out=parseBpifranceAapListingHtml(html,'https://www.bpifrance.fr/nos-appels-a-projets-concours');
  assert.equal(out.items.length,1);
  assert.match(out.items[0].url,/\/nos-appels-a-projets-concours\/aap-test$/);
  assert.ok(out.pages.some(x=>x.includes('page=1')));
});

test('la qualification financière distingue subvention, avance remboursable et PTZ',()=>{
  assert.deepEqual(
    classifyBpifranceInstrument("Aide sous forme mixte de subvention et d'avance récupérable.",'Deeptech').aidTypes.sort(),
    ['AVANCE_REMBOURSABLE','SUBVENTION']
  );
  assert.deepEqual(
    classifyBpifranceInstrument("Prêt à taux 0%.",'PTZI').aidTypes,
    ['PRET_TAUX_ZERO']
  );
  assert.equal(
    classifyBpifranceInstrument("Bpifrance ne finance pas directement mais accompagne.",'Horizon Europe').reason,
    'BPIFRANCE_NON_FINANCEUR_DIRECT'
  );
});

test('le verrou courant est Bpifrance v2 et gèle les autres guichets',()=>{
  const lock=JSON.parse(fs.readFileSync(new URL('../config/collection-lock.json',import.meta.url),'utf8'));
  assert.equal(lock.locked,true);
  assert.equal(lock.name,'Bpifrance');
  assert.equal(lock.version,6);
  assert.deepEqual(lock.allowedSourceIds,[
    'bpifrance_aap','bpifrance_aides','bpifrance_rebond_industriel','bpifrance_projets_international'
  ]);
  assert.equal(lock.preserveUnselectedSources,true);
  assert.equal(lock.freezeUnselectedLifecycle,true);
  assert.equal(lock.certification.sourceRules.bpifrance_aap.requireListingDiscovery,true);
  assert.equal(lock.certification.sourceRules.bpifrance_aides.requireCatalogueSectionDiscovery,true);
});

test('les deux sources maîtres Bpifrance utilisent le contre-audit multi-moteurs',()=>{
  const cfg=JSON.parse(fs.readFileSync(new URL('../config/sources.json',import.meta.url),'utf8'));
  for(const id of ['bpifrance_aap','bpifrance_aides']){
    const s=cfg.sources.find(x=>x.id===id);
    assert.match(s.externalAuditFile||'',/bpifrance-v2-external-audit\.json$/);
  }
  const audit=JSON.parse(fs.readFileSync(new URL('../config/bpifrance-v2-external-audit.json',import.meta.url),'utf8'));
  assert.ok(audit.candidateCount>0);
  assert.ok(audit.candidates.some(x=>x.family==='aap'));
  assert.ok(audit.candidates.some(x=>x.family==='catalogue'));
  for(const engine of ['Exa','Tavily','Parallel Search','Firecrawl'])assert.ok(audit.engines.includes(engine));
});

test('le catalogue Bpifrance n’est plus balayé intégralement comme référentiel des aides',()=>{
  const connector=fs.readFileSync(new URL('../scripts/connectors/bpifrance.mjs',import.meta.url),'utf8');
  assert.match(connector,/section maître/);
  assert.match(connector,/Subventions et avances remboursables/);
  assert.match(connector,/listing maître Bpifrance/);
  assert.match(connector,/externalDisposition/);
});
