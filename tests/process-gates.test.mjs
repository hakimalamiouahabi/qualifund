import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

test('Gate 3 reflète la présence d’un cycle live sans déclarer GO prématurément',()=>{
  execFileSync(process.execPath,['scripts/production-gates.mjs'],{cwd:new URL('..',import.meta.url),stdio:'ignore'});
  const r=JSON.parse(fs.readFileSync(new URL('../site/data/production-readiness.json',import.meta.url),'utf8'));
  const coverage=JSON.parse(fs.readFileSync(new URL('../site/data/coverage.json',import.meta.url),'utf8'));
  const lock=JSON.parse(fs.readFileSync(new URL('../config/collection-lock.json',import.meta.url),'utf8'));
  const selected=new Set(lock.allowedSourceIds||[]);
  const currentCoverage=coverage.filter(row=>selected.has(row.id));
  assert.equal(r.gates.find(g=>g.id===3).status==='NOT_RUN',currentCoverage.length===0);
  assert.ok(['PASS_TECH','PASS'].includes(r.gates.find(g=>g.id===6).status));
  const preProduction=r.gates.filter(g=>g.id<=9).every(g=>g.status==='PASS');
  assert.equal(r.goProduction,preProduction);
});


test('gate 10 depends on all gates 1-9',()=>{
  const src=fs.readFileSync(new URL('../scripts/production-gates.mjs',import.meta.url),'utf8');
  assert.match(src,/const preProductionPass=gates\.every\(g=>g\.status==='PASS'\)/);
  assert.match(src,/id:10,name:'Recette production',status:preProductionPass\?'PASS':'NOT_STARTED'/);
});


test('Gate 3 exige un coverage rattaché au même cycle de collecte',()=>{
  const gates=fs.readFileSync(new URL('../scripts/production-gates.mjs',import.meta.url),'utf8');
  const update=fs.readFileSync(new URL('../scripts/update-library.mjs',import.meta.url),'utf8');
  assert.match(update,/collectionCycleId:cycleId/);
  assert.match(update,/coverage\.push\(\{cycleId,/);
  assert.match(gates,/coverageIsFresh/);
  assert.match(gates,/row\.cycleId/);
  assert.match(gates,/freshExecuted/);
});

test('un cycle verrouillé utilise le certificat fingerprinté et les preuves de publication',()=>{
  const gates=fs.readFileSync(new URL('../scripts/production-gates.mjs',import.meta.url),'utf8');
  assert.match(gates,/lockedCertificationMatch/);
  assert.match(gates,/fingerprintStatus==='MATCH'/);
  assert.match(gates,/publicationEvidenceIntegrity/);
  assert.match(gates,/hasGuichetEvidence\(a\).*hasStatusEvidence\(a\).*hasTargetInstrumentEvidence\(a\).*hasEnterpriseEvidence\(a\)/s);
});

test('la certification production stricte n’est jamais sautée en cycle verrouillé',()=>{
  const yml=fs.readFileSync(new URL('../.github/workflows/update-and-deploy.yml',import.meta.url),'utf8');
  const block=yml.match(/- name: Certification production stricte[\s\S]*?run: npm run certify:production/)?.[0]||'';
  assert.ok(block);
  assert.doesNotMatch(block,/\bif:/);
});
