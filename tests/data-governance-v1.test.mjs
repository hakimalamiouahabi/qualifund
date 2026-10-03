import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCertificationLedger, publicationReason, targetFunding, hasEnterpriseEvidence, hasTargetInstrumentEvidence, sourceConfigFingerprint, certificationBasisFingerprint } from '../scripts/lib/publication.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

test('les preuves métier de publication peuvent réutiliser les bénéficiaires officiels',()=>{
  const base={
    id:'x',sourceId:'bpi',title:'Aide innovation',kind:'AIDE',aidTypes:['SUBVENTION'],lifecycleStatus:'ACTIVE',
    officialPage:'https://example.fr/aide/x',
    verification:{fieldEvidence:[
      {field:'guichet',sourceTier:'B',sourceUrl:'https://example.fr/catalogue',evidenceText:'catalogue officiel'},
      {field:'sourceStatus',sourceTier:'B',sourceUrl:'https://example.fr/aide/x',evidenceText:'ouvert'},
      {field:'instrument',sourceTier:'B',sourceUrl:'https://example.fr/aide/x',evidenceText:'subvention'},
      {field:'beneficiaries',sourceTier:'B',sourceUrl:'https://example.fr/aide/x',evidenceText:'PME et ETI françaises'}
    ]}
  };
  assert.equal(hasEnterpriseEvidence(base),true);
  assert.equal(hasTargetInstrumentEvidence(base),true);
  assert.equal(publicationReason(base,{configuredSourceIds:new Set(['bpi']),unlockedSourceIds:new Set(['bpi'])}),null);
});

test('une certification de source ne remplace pas les preuves métier minimales de la fiche',()=>{
  const base={id:'x',sourceId:'bpi',title:'Aide',kind:'AIDE',aidTypes:['SUBVENTION'],lifecycleStatus:'ACTIVE',officialPage:'https://example.fr/aide/x',verification:{fieldEvidence:[]}};
  assert.equal(publicationReason(base,{configuredSourceIds:new Set(['bpi']),unlockedSourceIds:new Set(['bpi'])}),'MISSING_GUICHET_EVIDENCE');
});

test('la publication refuse une source non certifiée et un instrument hors périmètre',()=>{
  const base={
    id:'x',sourceId:'aura',title:'Aide à l’investissement',lifecycleStatus:'ACTIVE',
    officialPage:'https://www.auvergnerhonealpes.fr/aides/demo',
    aidTypes:['SUBVENTION'],
    enterpriseEligible:true,
    verification:{fieldEvidence:[
      {field:'guichet',sourceTier:'B',sourceUrl:'https://example.fr/source',evidenceText:'source'},
      {field:'sourceStatus',sourceTier:'B',sourceUrl:'https://example.fr/aide/x',evidenceText:'open'},
      {field:'instrument',sourceTier:'B',sourceUrl:'https://example.fr/aide/x',evidenceText:'subvention'},
      {field:'enterpriseEligibility',sourceTier:'B',sourceUrl:'https://example.fr/source',evidenceText:'entreprise'}
    ]}
  };
  const configured=new Set(['aura']);
  assert.equal(publicationReason(base,{configuredSourceIds:configured,unlockedSourceIds:new Set()}),'SOURCE_NOT_CERTIFIED');
  assert.equal(publicationReason({...base,aidTypes:['AUTRE']},{configuredSourceIds:configured,unlockedSourceIds:new Set(['aura'])}),'OUT_OF_TARGET_INSTRUMENT');
  assert.equal(publicationReason(base,{configuredSourceIds:configured,unlockedSourceIds:new Set(['aura'])}),null);
  assert.equal(targetFunding({...base,kind:'AAP / AMI',aidTypes:['AUTRE']}),true);
});

test('une date de clôture ancienne prime sur un lifecycle ACTIVE obsolète',()=>{
  const opts={configuredSourceIds:new Set(['s']),unlockedSourceIds:new Set(['s']),now:new Date('2026-10-03T00:00:00Z')};
  const base={id:'x',sourceId:'s',title:'Dispositif test',officialPage:'https://example.fr/aide/x',aidTypes:['SUBVENTION'],lifecycleStatus:'ACTIVE',verification:{fieldEvidence:[
    {field:'guichet',sourceTier:'B',sourceUrl:'https://example.fr/source',evidenceText:'source'},
    {field:'sourceStatus',sourceTier:'B',sourceUrl:'https://example.fr/aide/x',evidenceText:'open'},
    {field:'instrument',sourceTier:'B',sourceUrl:'https://example.fr/aide/x',evidenceText:'subvention'},
    {field:'beneficiaries',sourceTier:'B',sourceUrl:'https://example.fr/aide/x',evidenceText:'PME françaises'}
  ]}};
  assert.equal(publicationReason({...base,closingDate:'2026-06-01'},opts),'INACTIVE_OR_STALE');
  assert.equal(publicationReason({...base,closingDate:'2026-09-20'},opts),'INACTIVE_OR_STALE');
  assert.equal(publicationReason({...base,closingDate:'2026-10-04'},opts),null);
});

test('une archive n’est jamais publiée, même avec une clôture récente',()=>{
  const opts={configuredSourceIds:new Set(['s']),unlockedSourceIds:new Set(['s']),now:new Date('2026-10-03T00:00:00Z')};
  const base={id:'x',sourceId:'s',title:'Dispositif test',officialPage:'https://example.fr/aide/x',aidTypes:['SUBVENTION'],lifecycleStatus:'ARCHIVE',verification:{fieldEvidence:[
    {field:'guichet',sourceTier:'B',sourceUrl:'https://example.fr/source',evidenceText:'source'},
    {field:'sourceStatus',sourceTier:'B',sourceUrl:'https://example.fr/aide/x',evidenceText:'open'},
    {field:'instrument',sourceTier:'B',sourceUrl:'https://example.fr/aide/x',evidenceText:'subvention'},
    {field:'beneficiaries',sourceTier:'B',sourceUrl:'https://example.fr/aide/x',evidenceText:'PME françaises'}
  ]}};
  assert.equal(publicationReason({...base,closingDate:'2026-06-01'},opts),'INACTIVE_OR_STALE');
  assert.equal(publicationReason({...base,closingDate:'2026-09-20'},opts),'INACTIVE_OR_STALE');
});

test('le ledger ne déverrouille que les certificats PASS liés au registre et au code courants',async()=>{
  const dir=await fsp.mkdtemp(path.join(os.tmpdir(),'qf-ledger-'));
  try{
    const cfg={version:'x',sources:[
      {id:'ademe',official:true,strategy:'official-page',url:'https://example.fr/ademe'},
      {id:'aura',official:true,strategy:'official-page',url:'https://example.fr/aura'}
    ]};
    const fp=sourceConfigFingerprint(cfg,['ademe']);
    const basis=await certificationBasisFingerprint(ROOT,cfg,['ademe']);
    await fsp.writeFile(path.join(dir,'ademe-certification.json'),JSON.stringify({
      status:'PASS',generatedAt:'2026-10-01T00:00:00Z',lock:{name:'ADEME'},configuredSources:['ademe'],
      sourceConfigFingerprint:fp,certificationBasisFingerprint:basis
    }));
    await fsp.writeFile(path.join(dir,'aura-certification.json'),JSON.stringify({status:'FAIL',generatedAt:'2026-10-02T00:00:00Z',lock:{name:'Auvergne-Rhône-Alpes'},configuredSources:['aura']}));
    await fsp.writeFile(path.join(dir,'legacy-certification.json'),JSON.stringify({status:'PASS',generatedAt:'2026-10-01T00:00:00Z',lock:{name:'Legacy'},configuredSources:['removed']}));
    const ledger=await buildCertificationLedger(dir,cfg,{root:ROOT});
    assert.deepEqual(ledger.unlockedSourceIds,['ademe']);
    assert.deepEqual(ledger.guichets,['ADEME']);
  }finally{await fsp.rm(dir,{recursive:true,force:true})}
});

test('l’interface déverrouille les guichets depuis le ledger et filtre le hors-périmètre',()=>{
  const app=fs.readFileSync(path.join(ROOT,'site/app.js'),'utf8');
  assert.match(app,/certification-ledger\.json/);
  assert.match(app,/applyCertificationLedger/);
  assert.doesNotMatch(app,/!ledger\.unlockedSourceIds\.length/);
  assert.match(app,/CERTIFIED_SOURCE_NAMES/);
  assert.match(app,/targetFundingAid/);
  assert.match(app,/publicAidUnlocked\(a\).*PUBLIC_UNLOCKED_SOURCE_IDS\.has\(a\.sourceId\)/);
  assert.doesNotMatch(app,/publicAidUnlocked\(a\).*sourceAliases/);
  assert.match(app,/timeZone:'Europe\/Paris'/);
  assert.match(app,/isoDayNumber/);
  assert.doesNotMatch(app,/const today=\(\)=>new Date\(\)\.toISOString\(\)\.slice\(0,10\)/);
  assert.doesNotMatch(app,/const PUBLIC_UNLOCKED_SOURCE_IDS=new Set\(\['bpifrance_aap'/);
});

test('les artefacts lourds et audits historiques obsolètes ont disparu du dépôt',()=>{
  for(const p of [
    'site/data/bootstrap.js','site/data/library.previous.json',
    'SOURCE_LINK_AUDIT_v8.5.md','SOURCE_LINK_AUDIT_v9.3.md','SOURCE_ROLE_AUDIT_v11.1.2.md'
  ])assert.equal(fs.existsSync(path.join(ROOT,p)),false,p);
});

test('les audits d’ingestion n’utilisent plus les stratégies tierces historiques',()=>{
  for(const p of ['scripts/audit-ingestion.mjs','scripts/production-gates.mjs']){
    const src=fs.readFileSync(path.join(ROOT,p),'utf8');
    assert.doesNotMatch(src,/aides-entreprises|aides-territoires|data-gouv-query/);
  }
});


test('le workflow construit l’artefact certifié puis vérifie le SHA réellement publié sur Cloudflare',()=>{
  const wf=fs.readFileSync(path.join(ROOT,'.github/workflows/update-and-deploy.yml'),'utf8');
  assert.match(wf,/Construire l'artefact public certifié/);
  assert.match(wf,/run: npm run build:cloudflare/);
  assert.match(wf,/RADAR_PUBLIC_URL: https:\/\/qualifund\.pages\.dev/);
  assert.match(wf,/build-info\.json/);
  assert.match(wf,/EXPECTED_SHA/);
  assert.doesNotMatch(wf,/actions\/deploy-pages/);
  assert.doesNotMatch(wf,/actions\/upload-pages-artifact/);
});


test('la collecte interne ne publie jamais directement le stock brut',()=>{
  const update=fs.readFileSync(path.join(ROOT,'scripts/update-library.mjs'),'utf8');
  assert.doesNotMatch(update,/writeJsonAtomic\(path\.join\(PUBLIC_DIR/);
  assert.doesNotMatch(update,/radar-library\.json/);
  const sync=fs.readFileSync(path.join(ROOT,'scripts/sync-static-metadata.mjs'),'utf8');
  assert.match(sync,/CERTIFIED_SOURCE_ONLY/);
  assert.match(sync,/isPublishableAid/);
});


test('le certificat actif reflète toujours le verrou courant au lieu d’un ancien guichet',()=>{
  const sync=fs.readFileSync(path.join(ROOT,'scripts/sync-static-metadata.mjs'),'utf8');
  assert.match(sync,/status:'PENDING'/);
  assert.match(sync,/matchingCert/);
  assert.match(sync,/active-source-certification\.json/);
  const app=fs.readFileSync(path.join(ROOT,'site/app.js'),'utf8');
  assert.match(app,/Référentiel officiel/);
  assert.doesNotMatch(app,/Canal RSS<\/span>/);
});


test('la purge conserve les snapshots historiques rejetés mais ne les certifie pas',async()=>{
  const purge=fs.readFileSync(new URL('../scripts/purge-indirect-sources.mjs',import.meta.url),'utf8');
  assert.match(purge,/buildCertificationLedger/);
  assert.match(purge,/historicalRejectedSourceIds/);
  assert.match(purge,/ledger\.rejectedCertifications/);
  assert.match(purge,/ledger\.unlockedSourceIds/);
  assert.match(purge,/lock\.allowedSourceIds/);
  assert.match(purge,/filter\(a=>retainedSourceIds\.has\(a\?\.sourceId\)\)/);
  assert.match(purge,/certification-ledger\.json/);
  assert.match(purge,/status:'PENDING'/);
});


test('une preuve entreprise peut venir d’un objectif officiel contextualisé',async()=>{
  const {hasEnterpriseEvidence}=await import('../scripts/lib/publication.mjs');
  const aid={
    verification:{fieldEvidence:[{
      field:'objective',sourceTier:'B',sourceUrl:'https://www.bpifrance.fr/test',
      evidenceText:'Bpifrance soutient des partenariats en innovation entre entreprises françaises et japonaises.'
    }]}
  };
  assert.equal(hasEnterpriseEvidence(aid),true);
});

test('une mention entreprise non contextuelle dans un objectif ne suffit pas',async()=>{
  const {hasEnterpriseEvidence}=await import('../scripts/lib/publication.mjs');
  const aid={
    verification:{fieldEvidence:[{
      field:'objective',sourceTier:'B',sourceUrl:'https://www.bpifrance.fr/test',
      evidenceText:'Le marché concerne de nombreuses entreprises du secteur.'
    }]}
  };
  assert.equal(hasEnterpriseEvidence(aid),false);
});


test('la page Bibliothèque n’utilise plus de contrôles DOM inexistants ni le branding historique',()=>{
  const html=fs.readFileSync(path.join(ROOT,'site/bibliotheque/index.html'),'utf8');
  assert.doesNotMatch(html,/verified\.textContent/);
  assert.doesNotMatch(html,/verification\.value/);
  assert.doesNotMatch(html,/qualifund-library/i);
  assert.match(html,/radar-library\.csv/);
  assert.match(html,/CERTIFIED_SOURCE_ONLY|sources certifiées|corpus certifié/i);
  const headers=(html.match(/<th>/g)||[]).length;
  const rowTemplate=(html.match(/<td>/g)||[]).length;
  assert.equal(headers,8);
  assert.equal(rowTemplate,8);
});

test('les duplications JSON publiques monolithiques et documents historiques ont disparu',()=>{
  for(const p of [
    'site/bibliotheque/radar-library.json',
    'site/bibliotheque/qualifund-library.json',
    'site/bibliotheque/qualifund-library.csv',
    'Cahier_des_charges_QUALIFUND_FINAL.md',
    'POLITIQUE_COUVERTURE_2026-09-28.md',
    'REVUE_CODIR_2026-09-29.md',
    'QA_REPORT.md',
    'SOURCE_LINK_AUDIT.md'
  ])assert.equal(fs.existsSync(path.join(ROOT,p)),false,p);
});


test('un ancien certificat PASS ne peut pas être affiché comme PASS du verrou courant',()=>{
  const app=fs.readFileSync(path.join(ROOT,'site/app.js'),'utf8');
  assert.match(app,/function currentLockCertification\(\)/);
  assert.match(app,/certLock\.name===current\.name/);
  assert.match(app,/activeCert=currentCert\?\.status\|\|'PENDING'/);
  assert.match(app,/function certification\(\)\{\s*const c=currentLockCertification\(\)/);
});

test('le build Cloudflare régénère le certificat actif du verrou courant',()=>{
  const build=fs.readFileSync(path.join(ROOT,'scripts/build-cloudflare-pages.mjs'),'utf8');
  assert.match(build,/config','collection-lock\.json/);
  assert.match(build,/status:'PENDING'/);
  assert.match(build,/active-source-certification\.json/);
  assert.match(build,/c\.name===lock\.name/);
});


test('la chaîne de production valide Cloudflare Pages et non un site GitHub Pages parallèle',()=>{
  const wf=fs.readFileSync(path.join(ROOT,'.github/workflows/update-and-deploy.yml'),'utf8');
  assert.match(wf,/RADAR_PUBLIC_URL: https:\/\/qualifund\.pages\.dev/);
  assert.match(wf,/build-info\.json/);
  assert.match(wf,/EXPECTED_SHA/);
  assert.doesNotMatch(wf,/actions\/deploy-pages/);
  assert.doesNotMatch(wf,/actions\/upload-pages-artifact/);
  assert.doesNotMatch(wf,/environment:\s*\n\s*name: github-pages/);
});

test('le build Cloudflare publie un marqueur de SHA vérifiable',()=>{
  const build=fs.readFileSync(path.join(ROOT,'scripts/build-cloudflare-pages.mjs'),'utf8');
  assert.match(build,/CF_PAGES_COMMIT_SHA/);
  assert.match(build,/build-info\.json/);
  assert.match(build,/deployment:'cloudflare-pages'/);
});


test('le client ne conserve plus l’ancien cache IndexedDB ni la pseudo-collecte locale',()=>{
  const app=fs.readFileSync(path.join(ROOT,'site/app.js'),'utf8');
  assert.doesNotMatch(app,/funding-direct-sources-v1|LIVE_STORE|LIVE_REFRESH_KEY|idbOpen|liveGet\(|liveSet\(|loadClientLibrary|maybeAutoClientRefresh|scheduleClientDailyRefresh/);
  assert.doesNotMatch(app,/function sourceAliasId/);
});

test('la CI de pull request est non destructive et bloque les régressions avant main',()=>{
  const ci=fs.readFileSync(path.join(ROOT,'.github/workflows/ci.yml'),'utf8');
  assert.match(ci,/pull_request:/);
  assert.match(ci,/permissions:\s*\n\s*contents: read/);
  assert.match(ci,/npm test/);
  assert.match(ci,/npm run validate/);
  assert.match(ci,/npm run audit:deep:strict/);
  assert.doesNotMatch(ci,/npm run update(?::full)?/);
  assert.doesNotMatch(ci,/wrangler|cloudflare|git push/i);
});

test('le workflow Cloudflare ne conserve pas la permission GitHub Pages obsolète',()=>{
  const wf=fs.readFileSync(path.join(ROOT,'.github/workflows/update-and-deploy.yml'),'utf8');
  assert.doesNotMatch(wf,/^\s+pages:\s+read\s*$/m);
});


test('un certificat est rejeté si sa configuration ou sa base technique change',async()=>{
  const dir=await fsp.mkdtemp(path.join(os.tmpdir(),'qf-fingerprint-'));
  try{
    const cfgA={version:'x',sources:[{id:'s',official:true,strategy:'official-page',url:'https://example.fr/a'}]};
    const fp=sourceConfigFingerprint(cfgA,['s']);
    const basis=await certificationBasisFingerprint(ROOT,cfgA,['s']);
    await fsp.writeFile(path.join(dir,'s-certification.json'),JSON.stringify({
      status:'PASS',generatedAt:'2026-10-03T00:00:00Z',lock:{name:'S'},configuredSources:['s'],
      sourceConfigFingerprint:fp,certificationBasisFingerprint:basis
    }));
    const ok=await buildCertificationLedger(dir,cfgA,{root:ROOT});
    assert.deepEqual(ok.unlockedSourceIds,['s']);
    assert.equal(ok.certifications[0].fingerprintStatus,'MATCH');

    const cfgB={...cfgA,sources:[{...cfgA.sources[0],url:'https://example.fr/b'}]};
    const changed=await buildCertificationLedger(dir,cfgB,{root:ROOT});
    assert.deepEqual(changed.unlockedSourceIds,[]);
    assert.equal(changed.rejectedCertifications[0].reason,'SOURCE_CONFIG_CHANGED');

    await fsp.writeFile(path.join(dir,'s-certification.json'),JSON.stringify({
      status:'PASS',generatedAt:'2026-10-03T00:00:00Z',lock:{name:'S'},configuredSources:['s'],
      sourceConfigFingerprint:fp,certificationBasisFingerprint:'0'.repeat(64)
    }));
    const codeChanged=await buildCertificationLedger(dir,cfgA,{root:ROOT});
    assert.deepEqual(codeChanged.unlockedSourceIds,[]);
    assert.equal(codeChanged.rejectedCertifications[0].reason,'CERTIFICATION_BASIS_CHANGED');
  }finally{await fsp.rm(dir,{recursive:true,force:true})}
});

test('un ancien PASS sans fingerprints est fail-closed',async()=>{
  const dir=await fsp.mkdtemp(path.join(os.tmpdir(),'qf-legacy-cert-'));
  try{
    const cfg={version:'x',sources:[{id:'s',official:true,strategy:'official-page',url:'https://example.fr/a'}]};
    await fsp.writeFile(path.join(dir,'s-certification.json'),JSON.stringify({
      status:'PASS',generatedAt:'2026-10-01T00:00:00Z',lock:{name:'S'},configuredSources:['s']
    }));
    const ledger=await buildCertificationLedger(dir,cfg,{root:ROOT});
    assert.deepEqual(ledger.unlockedSourceIds,[]);
    assert.equal(ledger.rejectedCertifications[0].reason,'SOURCE_CONFIG_FINGERPRINT_MISSING');
  }finally{await fsp.rm(dir,{recursive:true,force:true})}
});


test('la collecte exige un verrou et préserve le dernier snapshot valide du guichet actif',()=>{
  const update=fs.readFileSync(path.join(ROOT,'scripts/update-library.mjs'),'utf8');
  const purge=update.indexOf('await purgeIndirectSources()');
  const previous=update.indexOf("const previous=await readJson(path.join(DATA,'library.json')");
  assert.ok(purge>=0&&previous>purge);
  assert.doesNotMatch(update,/if\(!collectionLock\.locked\)await purgeIndirectSources/);
  assert.match(update,/requireCollectionLock\(collectionLock\)/);
  assert.match(update,/const current=new Map\(prevMap\)/);
  assert.doesNotMatch(update,/new Map\(\(previous\.aaps\|\|\[\]\)\.filter\(a=>!selectedIds\.has/);
  const wf=fs.readFileSync(path.join(ROOT,'.github/workflows/update-and-deploy.yml'),'utf8');
  assert.match(wf,/Purger et persister le stock hors sources certifiées \/ cycle courant/);
  assert.doesNotMatch(wf,/Purger et persister[^\n]*\n\s*if:\s*\$\{\{ steps\.lock\.outputs\.locked != 'true' \}\}/);
});


test('l’interface échoue fermée si le ledger de certification est indisponible',()=>{
  const app=fs.readFileSync(path.join(ROOT,'site/app.js'),'utf8');
  assert.match(app,/const PUBLIC_UNLOCKED_SOURCE_IDS=new Set\(\)/);
  assert.match(app,/const PUBLIC_UNLOCKED_GUICHETS=\[\]/);
  assert.match(app,/const CERTIFIED_SOURCE_NAMES=new Map\(\)/);
  assert.doesNotMatch(app,/FALLBACK_UNLOCKED_SOURCE_IDS/);
});


test('la purge reconstruit les agrégats du manifeste au lieu de recopier les anciens compteurs',()=>{
  const purge=fs.readFileSync(path.join(ROOT,'scripts/purge-indirect-sources.mjs'),'utf8');
  assert.doesNotMatch(purge,/\.\.\.\(migrated\?lib\.meta/);
  assert.match(purge,/jPlusOneActiveCount:activeJPlusOne\.length/);
  assert.match(purge,/instrumentCounts/);
  assert.match(purge,/purgedAt:changed\?new Date\(\)\.toISOString\(\):\(lib\.meta\?\.purgedAt\|\|null\)/);
  const update=fs.readFileSync(path.join(ROOT,'scripts/update-library.mjs'),'utf8');
  assert.match(update,/const active=aids\.filter\(a=>String\(a\.lifecycleStatus\|\|'\'\)\.toUpperCase\(\)==='ACTIVE'\)/);
});


test('le deep audit bloque les compteurs de manifeste impossibles',()=>{
  const audit=fs.readFileSync(path.join(ROOT,'scripts/deep-audit.mjs'),'utf8');
  assert.match(audit,/manifest\.libraryCount/);
  assert.match(audit,/manifest\.rawLibraryCount/);
  assert.match(audit,/manifest\.activeCount/);
  assert.match(audit,/manifest\.jPlusOneActiveCount/);
  assert.match(audit,/jPlusOneActiveCount=.*> ACTIVE réels/);
});


test('le deep audit mesure la fraîcheur des certificats sans en faire un faux P0',()=>{
  const audit=fs.readFileSync(path.join(ROOT,'scripts/deep-audit.mjs'),'utf8');
  assert.match(audit,/CERT_FRESHNESS_WARN_HOURS=72/);
  assert.match(audit,/maintenance opérationnelle à rafraîchir/);
  assert.match(audit,/certificationFreshness/);
});
