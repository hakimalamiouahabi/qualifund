import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const ROOT=path.resolve(new URL('..',import.meta.url).pathname);
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');

test('bibliothèque opérationnelle limitée aux instruments cibles dont AAP',()=>{
  const upd=read('scripts/update-library.mjs');
  assert.match(upd,/DIRECT_OFFICIAL_CATALOG/);
  for(const token of ['SUBVENTION','AVANCE_REMBOURSABLE','PRET_TAUX_ZERO','PRET','GARANTIE','ALLEGEMENT_FISCAL'])assert.ok(upd.includes(token),token);
  assert.match(upd,/recommendationInstruments=\['SUBVENTION','AVANCE_REMBOURSABLE','PRET_TAUX_ZERO','APPEL_A_PROJET'\]/);
  const cfg=JSON.parse(read('config/sources.json'));
  for(const id of ['occitanie_foster','paca_feder_loan']){const s=cfg.sources.find(x=>x.id===id);assert.equal(s?.strategy,'official-page');assert.equal(s?.forceAidType,'PRET_TAUX_ZERO');}
});

test('moteur v12.6 combine critères documentaires et BM25F sans simuler un barème financeur',()=>{
  const code=read('site/scoring-core.js');const ctx={globalThis:{}};vm.runInNewContext(code,ctx);const scorer=ctx.globalThis.FUNDING_RADAR_SCORING;
  const aid={id:'a1',title:'Innovation digitale',objective:'Innovation digitale',themes:['innovation'],projectsExpected:['prototype'],eligibleExpenses:'logiciel prototype',selectionCriteria:'innovation impact',prerequisites:'PME',aidRate:{max:50},scope:'NATIONAL',permanent:false,deadlines:['2099-12-31']};
  const p={name:'Innovation digitale',summary:'prototype logiciel innovation',sector:'industrie',expenses:'logiciel prototype',impacts:'impact innovation',environment:'',digital:'digital',partners:'',types:['R&D / Innovation'],maturity:'Prototype',budget:100000,region:'Île-de-France'};
  const r=scorer.relevance(aid,p);
  assert.equal(r.dims.length,9);
  assert.ok(r.dims.every(d=>d.max===1));
  assert.equal(typeof scorer.bm25fRank,'function');
  assert.equal(scorer.version,'12.6.0');
});

test('restitution finale : priorités, approfondissement et fusion de rangs',()=>{
  const app=read('site/app.js');
  assert.match(app,/Reciprocal Rank Fusion \(RRF\)/);
  assert.match(app,/slice\(0,10\)/);
  assert.match(app,/slice\(0,12\)/);
  assert.match(app,/Prioritaires à instruire/);
  assert.match(app,/À approfondir/);
});

test('workflow : SHA pinning, corpus publié et cron Europe\/Paris',()=>{
  const y=read('.github/workflows/update-and-deploy.yml');
  assert.match(y,/cron: '0 2 \* \* \*'/);assert.match(y,/timezone: 'Europe\/Paris'/);
  assert.match(y,/ref: \$\{\{ needs\.build\.outputs\.data_sha \}\}/);
  assert.doesNotMatch(y,/uses:\s*[^\n]+@v\d/);
  const uses=[...y.matchAll(/uses:\s*([^@\n]+)@([^\s#]+)/g)];
  assert.ok(uses.length>=2);
  assert.ok(uses.every(([,name,ref])=>name&&/^[0-9a-f]{40}$/.test(ref)));
});

test('API : SIREN exact et token refresh comparé en temps constant',()=>{
  assert.match(read('api/company.js'),/digits\(item\?\.siren\)===siren/);
  assert.match(read('api/refresh.js'),/timingSafeEqual/);
});

test('J+1 : une permanence non prouvée est refusée',()=>{
  const cal=read('scripts/lib/calendar.mjs');assert.match(cal,/PERMANENT_UNVERIFIED/);assert.match(cal,/sourceTier/);
});

