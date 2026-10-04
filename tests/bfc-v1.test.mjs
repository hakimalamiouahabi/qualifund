import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  parseBfcPrivatePage,
  bfcBeneficiarySection,
  classifyBfcInstrument
} from '../scripts/connectors/bfc.mjs';

test('BFC lit le compteur officiel et normalise les URLs Drupal alternatives',()=>{
  const html=`<body>
    <p>326 aide(s) & service(s) correspondent à votre recherche :</p>
    <div><h3>Aide test</h3><a href="/node/123">Plus de détails</a></div>
    <div><h3>Aide test bis</h3><a href="/index.php/node/456">Plus de détails</a></div>
  </body>`;
  const out=parseBfcPrivatePage(html,'https://www.bourgognefranchecomte.fr/guide-des-aides');
  assert.equal(out.expectedOccurrences,326);
  assert.equal(out.items.length,2);
  assert.equal(out.items[0].url,'https://www.bourgognefranchecomte.fr/node/123');
  assert.equal(out.items[1].url,'https://www.bourgognefranchecomte.fr/node/456');
});

test('BFC extrait la preuve entreprise depuis la section Vous êtes',()=>{
  const text='Vous êtes Une PME localisée en Bourgogne-Franche-Comté. Vous voulez Financer un investissement. Ce qu\'il faut savoir ...';
  assert.equal(bfcBeneficiarySection(text),'Une PME localisée en Bourgogne-Franche-Comté.');
});

test('BFC conserve uniquement les instruments cibles et les AAP',()=>{
  assert.deepEqual(
    classifyBfcInstrument('Aide création','Aide sous forme d’avance remboursable à taux zéro sans garantie.').aidTypes.sort(),
    ['AVANCE_REMBOURSABLE','PRET_TAUX_ZERO'].sort()
  );
  assert.deepEqual(
    classifyBfcInstrument('Appel à projets innovation','Une subvention finance les projets.').aidTypes.sort(),
    ['APPEL_A_PROJET','SUBVENTION'].sort()
  );
  assert.equal(
    classifyBfcInstrument('Participation au capital','La Région intervient par prise de participation en fonds propres.').reason,
    'INSTRUMENT_HORS_PERIMETRE'
  );
});

test('le verrou BFC v15 est official-only, publication-ready et compte les occurrences dynamiques',()=>{
  const lock=JSON.parse(fs.readFileSync(new URL('../config/collection-lock.json',import.meta.url),'utf8'));
  const raw=JSON.stringify(lock);
  assert.equal(lock.version,15);
  assert.equal(lock.mode,'REGION');
  assert.equal(lock.name,'Bourgogne-Franche-Comté');
  assert.deepEqual(lock.allowedSourceIds,['bfc']);
  assert.equal(lock.next,'Bretagne');
  assert.equal(lock.certification?.requirePublicationReady,true);
  assert.equal(lock.certification?.sourceRules?.bfc?.requireOccurrenceCount,true);
  assert.equal(lock.certification?.sourceRules?.bfc?.requireMasterMembership,true);
  assert.equal(lock.certification?.sourceRules?.bfc?.minRetained,40);
  assert.doesNotMatch(raw,/externalAudit|Exa|Tavily|Parallel|Firecrawl|TinyFish|OpenAI|Anthropic|Gemini/i);
});

test('la source BFC utilise le guide régional filtré Organisme privé et le connecteur dédié',()=>{
  const cfg=JSON.parse(fs.readFileSync(new URL('../config/sources.json',import.meta.url),'utf8'));
  const source=cfg.sources.find(x=>x.id==='bfc');
  assert.equal(source.strategy,'bfc-official');
  assert.match(source.url,/field_vous_etes_target_id=87/);
  assert.equal(source.browserFallback,false);
  assert.equal(source.minExpected,220);
  assert.equal(source.minImported,40);
  assert.equal(source.minImportRatio,0.17);
  assert.equal(source.externalAuditFile,undefined);
});

test('le connecteur BFC est strictement officiel-only et ne dépend pas de Playwright',()=>{
  const connector=fs.readFileSync(new URL('../scripts/connectors/bfc.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(connector,/externalAudit|Exa|Tavily|Parallel|Firecrawl|TinyFish|OpenAI|Anthropic|Gemini/i);
  assert.doesNotMatch(connector,/browserHtml|playwright/i);
  assert.match(connector,/field:'catalogueMembership'/);
  assert.match(connector,/field:'enterpriseEligibility'/);
  assert.match(connector,/field:'instrument'/);
  assert.match(connector,/enterpriseOccurrencesExpected/);
});

test('Bpifrance, ADEME et AURA restent PASS pendant le cycle BFC',()=>{
  for(const [file,name] of [
    ['bpifrance-certification.json','Bpifrance'],
    ['ademe-certification.json','ADEME'],
    ['aura-certification.json','AURA']
  ]){
    const cert=JSON.parse(fs.readFileSync(new URL('../site/data/'+file,import.meta.url),'utf8'));
    assert.equal(cert.status,'PASS',name);
    assert.ok(cert.sourceConfigFingerprint,name);
    assert.ok(cert.certificationBasisFingerprint,name);
    assert.ok(cert.certifiedDataFingerprint,name);
  }
});
