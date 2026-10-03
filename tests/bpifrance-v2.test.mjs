import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  parseBpifranceAapListingHtml,
  classifyBpifranceInstrument,
  bpifranceEnterpriseEvidence
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

test('la preuve entreprise Bpifrance est positive uniquement quand la page relie explicitement le dispositif aux entreprises',()=>{
  assert.ok(bpifranceEnterpriseEvidence("Le présent AAP vise des projets portés par des entreprises de la filière automobile."));
  assert.ok(bpifranceEnterpriseEvidence("Financer vos études de faisabilité pour une entreprise innovante sur un marché extra-européen."));
  assert.ok(bpifranceEnterpriseEvidence("Cet appel accompagne les entreprises et consortiums souhaitant industrialiser leurs solutions."));
  assert.equal(
    bpifranceEnterpriseEvidence("Ce dispositif ne vise pas à financer une entreprise, mais à soutenir le développement business d'un projet deeptech."),
    null
  );
  assert.equal(
    bpifranceEnterpriseEvidence("Ce fonds de fonds réalise des investissements dans des fonds ciblant des PME et ETI industrielles."),
    null
  );
});

test('le baseline AAP distingue couverture du listing et rétention publication-ready',()=>{
  const cfg=JSON.parse(fs.readFileSync(new URL('../config/sources.json',import.meta.url),'utf8'));
  const source=cfg.sources.find(x=>x.id==='bpifrance_aap');
  assert.ok(source.minExpected>=20);
  assert.equal(source.minImported,17);
  assert.equal(source.minImportRatio,0.60);
  assert.match(source.notes,/27 URL actives observées, 17 fiches directement publiables/);
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

test('le verrou Bpifrance exige désormais un corpus publication-ready et autorise les exclusions du listing AAP',()=>{
  const lock=JSON.parse(fs.readFileSync(new URL('../config/collection-lock.json',import.meta.url),'utf8'));
  assert.equal(lock.version,12);
  assert.equal(lock.certification.requirePublicationReady,true);
  assert.equal(lock.certification.requireEnterpriseScope,undefined);
  assert.equal(lock.certification.sourceRules.bpifrance_aap.requireImportedEqualsDiscovered,undefined);
  assert.equal(lock.certification.sourceRules.bpifrance_aap.minRetained,17);
});

test('Rebond Industriel est certifié comme page directe sans fausse exigence de catalogue maître',()=>{
  const lock=JSON.parse(fs.readFileSync(new URL('../config/collection-lock.json',import.meta.url),'utf8'));
  assert.equal(lock.certification.sourceRules.bpifrance_aap.requireMasterMembership,true);
  assert.equal(lock.certification.sourceRules.bpifrance_aides.requireMasterMembership,true);
  assert.equal(lock.certification.sourceRules.bpifrance_rebond_industriel.requireMasterMembership,undefined);
  const cert=fs.readFileSync(new URL('../scripts/certify-active-source.mjs',import.meta.url),'utf8');
  assert.match(cert,/const requireMasterMembership=Boolean/);
  assert.doesNotMatch(cert,/requireMasterMembership\|\|rule\.requireGuichetEvidence/);
});

test('Rebond Industriel force uniquement les deux instruments prouvés sur sa page officielle',()=>{
  const cfg=JSON.parse(fs.readFileSync(new URL('../config/sources.json',import.meta.url),'utf8'));
  const source=cfg.sources.find(x=>x.id==='bpifrance_rebond_industriel');
  assert.deepEqual(source.forceAidTypes,['SUBVENTION','AVANCE_REMBOURSABLE']);
  const connector=fs.readFileSync(new URL('../scripts/connectors/official-page.mjs',import.meta.url),'utf8');
  assert.match(connector,/official-page-instrument/);
  assert.match(connector,/forceAidTypes/);
});

test('Rebond Industriel déclare explicitement Bpifrance comme guichet vérifié',()=>{
  const cfg=JSON.parse(fs.readFileSync(new URL('../config/sources.json',import.meta.url),'utf8'));
  const source=cfg.sources.find(x=>x.id==='bpifrance_rebond_industriel');
  assert.equal(source.guichetVerified,'Bpifrance');
});
