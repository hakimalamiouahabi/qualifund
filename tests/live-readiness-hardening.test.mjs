import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const cfg=JSON.parse(fs.readFileSync(new URL('../config/sources.json',import.meta.url),'utf8'));

test('workflow reconstruit les artefacts publics avant déploiement',()=>{
  const yml=fs.readFileSync(new URL('../.github/workflows/update-and-deploy.yml',import.meta.url),'utf8');
  assert.match(yml,/npm run sync:metadata/);
  assert.match(yml,/npm run build:index/);
  assert.match(yml,/npm run audit:ingestion/);
});

test('configuration navigateur n’invente aucun endpoint serverless sur hébergement statique ou domaine personnalisé',()=>{
  const js=fs.readFileSync(new URL('../site/runtime-config.js',import.meta.url),'utf8');
  assert.doesNotMatch(js,/location\.hostname/);
  assert.match(js,/refreshEndpoint:server\.refreshEndpoint\|\|null/);
  assert.match(js,/companyEndpoint:server\.companyEndpoint\|\|null/);
  assert.doesNotMatch(js,/'\/api\/refresh'/);
  assert.doesNotMatch(js,/'\/api\/company'/);
});

test('service worker utilise exclusivement le cache de la version applicative courante',()=>{
  const sw=fs.readFileSync(new URL('../site/sw.js',import.meta.url),'utf8');
  const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
  assert.ok(sw.includes(`funding-radar-v${pkg.version}-shell`));
  assert.doesNotMatch(sw,/v10-shell|v11\./);
});

test('dépendances directes figées et Node 22 déclaré',()=>{
  const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
  assert.ok(Object.values(pkg.dependencies).every(v=>!/[~^*xX]/.test(v)));
  assert.equal(pkg.engines.node,'>=22 <23');
});

test('configuration Vercel ne contient plus de rewrite catch-all pouvant masquer /api',()=>{
  const v=JSON.parse(fs.readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
  assert.ok(!v.rewrites.some(r=>r.source==='/:path*'));
  assert.ok(v.rewrites.some(r=>r.source==='/data/:path*'));
});

test('exemple d’environnement documente le token admin requis',()=>{
  const env=fs.readFileSync(new URL('../.env.example',import.meta.url),'utf8');
  assert.match(env,/RADAR_ADMIN_TOKEN=/);
});

test('documentation opérationnelle est alignée sur le cycle quotidien 02:00',()=>{
  const ops=fs.readFileSync(new URL('../OPERATIONS.md',import.meta.url),'utf8');
  assert.match(ops,/chaque jour à 02:00 Europe\/Paris/i);
  assert.doesNotMatch(ops,/Toutes les 6 h/);
});

test('QA distingue sources configurées/probées d’un cycle live vide', async () => {
  const src = await fs.promises.readFile(new URL('../scripts/quality-report.mjs', import.meta.url), 'utf8');
  assert.match(src, /sourcesConfigured/);
  assert.match(src, /sourcesProbed/);
  assert.match(src, /liveCycleExecuted/);
  assert.doesNotMatch(src, /sourcesTotal:cov\.length/);
});


test('un premier push de code déclenche aussi la collecte complète sans lancement manuel supplémentaire',()=>{
  const yml=fs.readFileSync(new URL('../.github/workflows/update-and-deploy.yml',import.meta.url),'utf8');
  assert.doesNotMatch(yml,/if: github\.event_name != 'push'/);
  assert.match(yml,/run: npm run update:full/);
});

