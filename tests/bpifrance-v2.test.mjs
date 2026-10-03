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

test('le certificat historique Bpifrance reste cohérent avec les seuils calibrés',()=>{
  const cert=JSON.parse(fs.readFileSync(new URL('../site/data/bpifrance-certification.json',import.meta.url),'utf8'));
  const cfg=JSON.parse(fs.readFileSync(new URL('../config/sources.json',import.meta.url),'utf8'));
  assert.equal(cert.status,'PASS');
  assert.equal(cert.lock?.name,'Bpifrance');
  assert.equal(cert.problems?.length,0);
  for(const id of ['bpifrance_aap','bpifrance_aides','bpifrance_rebond_industriel']){
    const source=cfg.sources.find(x=>x.id===id);
    const row=cert.bySource?.[id];
    assert.ok(row,id+' absent du certificat');
    assert.ok(Number(row.retained)>=Number(source.minImported||1),id+' sous le seuil calibré');
  }
});

test('les deux sources maîtres Bpifrance sont strictement officiel-only',()=>{
  const cfg=JSON.parse(fs.readFileSync(new URL('../config/sources.json',import.meta.url),'utf8'));
  const connector=fs.readFileSync(new URL('../scripts/connectors/bpifrance.mjs',import.meta.url),'utf8');
  for(const id of ['bpifrance_aap','bpifrance_aides']){
    const source=cfg.sources.find(x=>x.id===id);
    assert.equal(source.externalAuditFile,undefined);
  }
  assert.doesNotMatch(connector,/externalAudit|Exa|Tavily|Parallel|Firecrawl/i);
  assert.match(connector,/sitemapUrls/);
  assert.match(connector,/listing maître Bpifrance|section maître/);
});

test('le catalogue Bpifrance n’est plus balayé intégralement comme référentiel des aides',()=>{
  const connector=fs.readFileSync(new URL('../scripts/connectors/bpifrance.mjs',import.meta.url),'utf8');
  assert.match(connector,/section maître/);
  assert.match(connector,/Subventions et avances remboursables/);
  assert.match(connector,/listing maître Bpifrance/);
  assert.doesNotMatch(connector,/externalDisposition|externalAudit/);
});


test('Bpifrance v2 exclut les prêts d’honneur personnels du périmètre entreprise',()=>{
  assert.equal(
    classifyBpifranceInstrument("Prêt d'honneur à taux zéro accordé au porteur de projet à titre personnel.",'Prêt d’honneur').reason,
    'PRET_PERSONNEL_HORS_PERIMETRE_ENTREPRISE'
  );
});

test('l’ancien slug ADD est déclaré comme alias du référentiel maître',()=>{
  const cfg=JSON.parse(fs.readFileSync(new URL('../config/sources.json',import.meta.url),'utf8'));
  const s=cfg.sources.find(x=>x.id==='bpifrance_aides');
  assert.equal(
    s.canonicalAliases['https://www.bpifrance.fr/catalogue-offres/aide-pour-le-developpement-de-linnovation'],
    'https://www.bpifrance.fr/catalogue-offres/aide-au-developpement-deeptech'
  );
});


test('le connecteur Bpifrance matérialise la preuve entreprise depuis la page directe',()=>{
  const connector=fs.readFileSync(new URL('../scripts/connectors/bpifrance.mjs',import.meta.url),'utf8');
  assert.match(connector,/bpifranceEnterpriseEvidence/);
  assert.match(connector,/field:'enterpriseEligibility'/);
  assert.match(connector,/a\.enterpriseEligible=true/);
});

test('Rebond Industriel déclare explicitement Bpifrance comme guichet vérifié',()=>{
  const cfg=JSON.parse(fs.readFileSync(new URL('../config/sources.json',import.meta.url),'utf8'));
  const source=cfg.sources.find(x=>x.id==='bpifrance_rebond_industriel');
  assert.equal(source.guichetVerified,'Bpifrance');
});
