import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fromAidesEntreprises } from '../scripts/lib/records.mjs';

const cfg=JSON.parse(fs.readFileSync(new URL('../config/sources.json',import.meta.url),'utf8'));

test('Aides Entreprises n’expose plus l’API REST protégée comme source active',()=>{
  const s=cfg.sources.find(x=>x.id==='aides_entreprises');
  assert.equal(s.url,'https://data.aides-entreprises.fr/stock');
  assert.equal(s.stockUrl,'https://data.aides-entreprises.fr/files/aides.json');
  assert.equal(s.apiAuthRequired,true);
  assert.ok(!String(s.url).includes('api.aides-entreprises.fr'));
});

test('mapping Aides Entreprises n’expose pas apiUrl et normalise les échéances',()=>{
  const raw={id_aid:42,status:1,aid_nom:'Appel à projets test',aid_objet:'Objet',aid_benef:'PME',aid_operations_el:'Dépenses',aid_conditions:'Conditions',aid_montant:'Subvention 50 %',date_fin:'2026-12-31',cache_indexation:{natures:[{id_typ:3,typ_libelle:'Subvention'},{id_typ:14,typ_libelle:'Appel à projet'}],profils:[{id_tut:4}],territoires:[{ter_libelle:'FRANCE'}],financeurs:[],projets:[]},complements:{source:[],reglement:[],formulaire:[]}};
  const a=fromAidesEntreprises(raw);
  assert.equal(a.apiUrl,null);
  assert.equal(a.kind,'AAP / AMI');
  assert.deepEqual(a.deadlines,[{date:'2026-12-31',type:'CLOTURE'}]);
});

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

test('service worker utilise exclusivement le cache de release v12',()=>{
  const sw=fs.readFileSync(new URL('../site/sw.js',import.meta.url),'utf8');
  assert.match(sw,/leyton-radar-v12\.6\.0-shell/);
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
  assert.match(ops,/Chaque jour à 02:00 Europe\/Paris/);
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
