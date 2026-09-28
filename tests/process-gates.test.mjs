import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

test('sans cycle live, Gate 3 est NOT_RUN et PASS_TECH ne suffit pas au GO',()=>{
  execFileSync(process.execPath,['scripts/production-gates.mjs'],{cwd:new URL('..',import.meta.url),stdio:'ignore'});
  const r=JSON.parse(fs.readFileSync(new URL('../site/data/production-readiness.json',import.meta.url),'utf8'));
  assert.equal(r.gates.find(g=>g.id===3).status,'NOT_RUN');
  assert.equal(r.gates.find(g=>g.id===6).status,'PASS_TECH');
  assert.equal(r.goProduction,false);
});


test('gate 10 depends on all gates 1-9',()=>{
  const src=fs.readFileSync(new URL('../scripts/production-gates.mjs',import.meta.url),'utf8');
  assert.match(src,/const preProductionPass=gates\.every\(g=>g\.status==='PASS'\)/);
  assert.match(src,/id:10,name:'Recette production',status:preProductionPass\?'PASS':'NOT_STARTED'/);
});
