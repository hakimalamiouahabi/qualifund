import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');

test('les anciens duplicats lourds de bibliothèque ne sont plus versionnés',()=>{
  for(const p of [
    'site/data/bootstrap.js',
    'site/data/library.previous.json',
    'site/bibliotheque/radar-library.json',
    'site/bibliotheque/qualifund-library.json',
    'site/bibliotheque/qualifund-library.csv'
  ]) assert.equal(fs.existsSync(path.join(ROOT,p)),false,p);
  assert.equal(fs.existsSync(path.join(ROOT,'site/data/library.json')),true);
  assert.equal(fs.existsSync(path.join(ROOT,'site/bibliotheque/radar-library.csv')),true);
});

test('la page Bibliothèque ne référence plus les artefacts supprimés et ses filtres existent',()=>{
  const html=read('site/bibliotheque/index.html');
  assert.match(html,/href="radar-library\.csv"/);
  assert.doesNotMatch(html,/qualifund-library\.(?:json|csv)/);
  assert.match(html,/id="verified"/);
  assert.match(html,/id="verification"/);
  assert.match(html,/<th>Vérification<\/th>/);
  assert.match(html,/Tous statuts documentaires/);
});

test('le front charge dynamiquement les cycles certifiés',()=>{
  const app=read('site/app.js');
  assert.match(app,/certified-sources\.json/);
  assert.match(app,/Tous les guichets certifiés/);
  assert.match(app,/guichetVerified&&PUBLIC_UNLOCKED_GUICHETS\.includes/);
  assert.match(app,/chunkedLibrary/);
  assert.match(app,/fetchJsonStrict\('\.\/data\/library\.json'\)/);
});

test('la readiness du cycle est recalculée même sous verrou',()=>{
  const wf=read('.github/workflows/update-and-deploy.yml');
  const marker='- name: Pré-readiness du cycle';
  assert.ok(wf.includes(marker));
  const slice=wf.slice(wf.indexOf(marker),wf.indexOf(marker)+180);
  assert.doesNotMatch(slice,/locked != 'true'/);
  const gates=read('scripts/production-gates.mjs');
  assert.match(gates,/selectedSourceSet\(collectionLock\)/);
  assert.match(gates,/Corpus public certifié/);
});

test('package, lockfile, registre et cache web partagent la version v13',()=>{
  const pkg=JSON.parse(read('package.json'));
  const lock=JSON.parse(read('package-lock.json'));
  const sources=JSON.parse(read('config/sources.json'));
  const html=read('site/index.html');
  assert.equal(pkg.name,'funding-radar');
  assert.equal(pkg.version,'13.0.0');
  assert.equal(lock.name,'funding-radar');
  assert.equal(lock.version,'13.0.0');
  assert.equal(lock.packages[''].name,'funding-radar');
  assert.equal(lock.packages[''].version,'13.0.0');
  assert.equal(sources.version,'13.0.0');
  assert.match(html,/app\.js\?v=13\.0\.0/);
});
