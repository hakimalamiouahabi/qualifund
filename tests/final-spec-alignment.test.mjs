import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const ROOT=path.resolve(new URL('..',import.meta.url).pathname);
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');

test('périmètre final amendé : SUBVENTION + AVANCE_REMBOURSABLE + PRET_TAUX_ZERO uniquement',()=>{
  const utils=read('scripts/lib/utils.mjs');
  assert.doesNotMatch(utils,/o\.push\(['"]PRET['"]\)/); assert.match(utils,/PRET_TAUX_ZERO/);
  const upd=read('scripts/update-library.mjs');
  assert.match(upd,/SUBVENTION/); assert.match(upd,/AVANCE_REMBOURSABLE/); assert.match(upd,/PRET_TAUX_ZERO/); assert.doesNotMatch(upd,/['"]PRET['"]/);
  const cfg=JSON.parse(read('config/sources.json'));
  for(const id of ['occitanie_foster','paca_feder_loan']){const s=cfg.sources.find(x=>x.id===id);assert.equal(s?.strategy,'official-page');assert.equal(s?.forceAidType,'PRET_TAUX_ZERO');}
});

test('scoring final = 25/15/20/15/10/10/5 = 100',()=>{
  const code=read('site/scoring-core.js');const ctx={globalThis:{}};vm.runInNewContext(code,ctx);const scorer=ctx.globalThis.LEYTON_SCORING;
  const aid={title:'Innovation digitale',objective:'Innovation digitale',themes:['innovation'],projectsExpected:['prototype'],eligibleExpenses:'logiciel prototype',selectionCriteria:'innovation impact',prerequisites:'PME',aidRate:{max:50},scope:'NATIONAL',permanent:false,deadlines:['2099-12-31']};
  const p={name:'Innovation digitale',summary:'prototype logiciel innovation',sector:'industrie',expenses:'logiciel prototype',impacts:'impact innovation',environment:'',digital:'digital',partners:'',types:['R&D / Innovation'],maturity:'Prototype',budget:100000,region:'Île-de-France'};
  const r=scorer.relevance(aid,p);assert.deepEqual(Array.from(r.dims,d=>d.max),[25,15,20,15,10,10,5]);assert.equal(r.dims.reduce((n,d)=>n+d.max,0),100);assert.equal(scorer.version,'12.2.0');
});

test('restitution finale : 8 priorités vérifiées + 6 pistes',()=>{
  const app=read('site/app.js');
  assert.match(app,/status==='VERIFIE'.*slice\(0,8\)/);
  assert.match(app,/slice\(0,6\)/);
  assert.match(app,/Pourquoi je la retiens/);
  assert.match(app,/À sécuriser/);
});

test('workflow : SHA pinning, corpus publié et cron Europe\/Paris',()=>{
  const y=read('.github/workflows/update-and-deploy.yml');
  assert.match(y,/cron: '0 2 \* \* \*'/);assert.match(y,/timezone: 'Europe\/Paris'/);
  assert.match(y,/ref: \$\{\{ needs\.build\.outputs\.data_sha \}\}/);
  assert.doesNotMatch(y,/uses:\s*[^\n]+@v\d/);
  const refs=[...y.matchAll(/uses:\s*[^@\n]+@([0-9a-f]{40})/g)];assert.ok(refs.length>=6);
});

test('API : SIREN exact et token refresh comparé en temps constant',()=>{
  assert.match(read('api/company.js'),/digits\(item\?\.siren\)===siren/);
  assert.match(read('api/refresh.js'),/timingSafeEqual/);
});

test('J+1 : une permanence non prouvée est refusée',()=>{
  const cal=read('scripts/lib/calendar.mjs');assert.match(cal,/PERMANENT_UNVERIFIED/);assert.match(cal,/sourceTier/);
});
