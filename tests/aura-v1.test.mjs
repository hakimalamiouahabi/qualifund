import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  parseAuraEnterpriseListingHtml,
  isEuropeanFundAid,
  classifyAuraInstrument
} from '../scripts/connectors/aura.mjs';

test('le catalogue AURA Entreprise lit le compteur officiel et les cartes',()=>{
  const html=`<main>
    <p>175 Résultat(s)</p>
    <article class="node node--type-aid node--view-mode-search-result">
      <div class="c-result__category">Aide</div>
      <a href="/aides/region-industrie-test">Financer mon investissement</a>
      <p>Date limite du dépôt : 30/10/2026</p>
    </article>
    <article class="node node--type-aid node--view-mode-search-result">
      <a href="/aides/appel-projets-demo">Appel à projets démonstrateurs</a>
    </article>
  </main>`;
  const out=parseAuraEnterpriseListingHtml(html,'https://www.auvergnerhonealpes.fr/aides?f%5B0%5D=profil%3A3');
  assert.equal(out.expectedCount,175);
  assert.equal(out.items.length,2);
  assert.equal(out.items[0].closingDate,'2026-10-30');
  assert.equal(out.items[0].kind,'AIDE');
  assert.equal(out.items[1].kind,'AAP / AMI');
});

test('les dispositifs FEADER/FEDER/LEADER sont réservés aux cycles fonds européens',()=>{
  assert.equal(isEuropeanFundAid({label:'Investir dans mon entreprise (FEADER - Dispositif 303)',url:'https://www.auvergnerhonealpes.fr/aides/demo'}),true);
  assert.equal(isEuropeanFundAid({label:'Financer mon investissement régional',url:'https://www.auvergnerhonealpes.fr/aides/demo'}),false);
});

test('la qualification AURA conserve subvention, AR et PTZ et exclut garanties/fonds propres',()=>{
  assert.deepEqual(
    classifyAuraInstrument({title:'Industrie du Futur',aidTypes:['SUBVENTION']},'subvention plafonnée à 16 000 €').aidTypes,
    ['SUBVENTION']
  );
  assert.deepEqual(
    classifyAuraInstrument({title:'Commerce',aidTypes:[]},'Le taux d’aide est de 20 % des dépenses éligibles. L’aide régionale est versée après instruction.').aidTypes,
    ['SUBVENTION']
  );
  assert.deepEqual(
    classifyAuraInstrument({title:'Prêt Région',aidTypes:['PRET_TAUX_ZERO']},'Prêt à taux 0 %').aidTypes,
    ['PRET_TAUX_ZERO']
  );
  assert.equal(
    classifyAuraInstrument({title:'Garantie bancaire',aidTypes:[]},'La Région garantit un crédit bancaire à hauteur de 50 %.').reason,
    'INSTRUMENT_HORS_PERIMETRE'
  );
  assert.equal(
    classifyAuraInstrument({title:'Fonds souverain',aidTypes:[]},'Augmenter les fonds propres de mon entreprise.').reason,
    'INSTRUMENT_HORS_PERIMETRE'
  );
});

test('le collecteur AURA bascule sur Playwright quand la vue Drupal brute est vide',()=>{
  const connector=fs.readFileSync(new URL('../scripts/connectors/aura.mjs',import.meta.url),'utf8');
  assert.match(connector,/getListingHtml/);
  assert.match(connector,/waitForSelector:'article\.node--type-aid\.node--view-mode-search-result'/);
  assert.match(connector,/browser-forced/);
});

test('le collecteur AURA matérialise explicitement l’éligibilité entreprise',()=>{
  const connector=fs.readFileSync(new URL('../scripts/connectors/aura.mjs',import.meta.url),'utf8');
  assert.match(connector,/a\.enterpriseEligible=true/);
  assert.match(connector,/field:'enterpriseEligibility'/);
});

test('AURA reste gelée pendant la recertification ADEME',()=>{
  const lock=JSON.parse(fs.readFileSync(new URL('../config/collection-lock.json',import.meta.url),'utf8'));
  const bpi=JSON.parse(fs.readFileSync(new URL('../site/data/bpifrance-certification.json',import.meta.url),'utf8'));
  assert.equal(lock.locked,true);
  assert.equal(lock.mode,'GUICHET');
  assert.equal(lock.name,'ADEME');
  assert.equal(lock.version,13);
  assert.deepEqual(lock.allowedSourceIds,['ademe']);
  assert.equal(lock.next,'AURA');
  assert.equal(lock.allowedSourceIds.includes('aura'),false);
  assert.match(lock.notes,/AURA demeure gelée jusqu.au PASS ADEME/i);
  assert.equal(bpi.status,'PASS');
  assert.equal(bpi.lock?.name,'Bpifrance');
  assert.ok(bpi.sourceConfigFingerprint);
  assert.ok(bpi.certificationBasisFingerprint);
  assert.ok(bpi.certifiedDataFingerprint);
});

test('la source AURA est filtrée Entreprise et les sources fonds européens restent hors verrou',()=>{
  const cfg=JSON.parse(fs.readFileSync(new URL('../config/sources.json',import.meta.url),'utf8'));
  const aura=cfg.sources.find(x=>x.id==='aura');
  assert.equal(aura.strategy,'aura-official');
  assert.match(aura.url,/profil%3A3/);
  assert.equal(aura.minExpected,175);
  assert.equal(aura.externalAuditFile,undefined);
  assert.ok(cfg.sources.some(x=>x.id==='aura_feder'));
  assert.ok(!cfg.sources.some(x=>x.id==='aura_france2030'));
});

test('le connecteur AURA est strictement officiel-only',()=>{
  const connector=fs.readFileSync(new URL('../scripts/connectors/aura.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(connector,/externalAudit|Exa|Tavily|Parallel|Firecrawl/i);
  assert.match(connector,/enterpriseMaster/);
  assert.match(connector,/getAidHtml/);
});

test('Bpifrance reste certifié pendant que le certificat ADEME courant est conservé',()=>{
  const ademe=JSON.parse(fs.readFileSync(new URL('../site/data/ademe-certification.json',import.meta.url),'utf8'));
  const bpi=JSON.parse(fs.readFileSync(new URL('../site/data/bpifrance-certification.json',import.meta.url),'utf8'));
  assert.equal(bpi.status,'PASS');
  assert.equal(bpi.lock?.name,'Bpifrance');
  assert.ok(['PASS','FAIL'].includes(ademe.status));
  assert.equal(ademe.lock?.name,'ADEME');
  assert.ok(ademe.sourceConfigFingerprint);
});


test('une fiche Drupal AURA complète est reconnue sans fallback navigateur',()=>{
  const connector=fs.readFileSync(new URL('../scripts/connectors/aura.mjs',import.meta.url),'utf8');
  assert.match(connector,/node--type-aid\\s\+node--view-mode-full/);
  assert.match(connector,/waitForSelector:'article\.node--type-aid\.node--view-mode-full'/);
  assert.doesNotMatch(connector,/timeoutMs:65000,\s*waitForSelector:'h1'/);
});


test('AURA ne cumule pas retries HTTP longs et double fallback Playwright',()=>{
  const connector=fs.readFileSync(new URL('../scripts/connectors/aura.mjs',import.meta.url),'utf8');
  assert.match(connector,/fetchText\(url,\{timeoutMs:8000,retries:0/);
  const getHtmlBlock=connector.match(/async function getHtml\(url\)\{[\s\S]*?\n\}/)?.[0]||'';
  assert.doesNotMatch(getHtmlBlock,/browserHtml/);
  assert.match(connector,/async function getListingHtml/);
  assert.match(connector,/async function getAidHtml/);
});
