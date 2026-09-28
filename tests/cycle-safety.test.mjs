import test from 'node:test';
import assert from 'node:assert/strict';
import { assessCollection } from '../scripts/lib/source-cycle.mjs';
import { mergeAid } from '../scripts/lib/merge.mjs';

test('une source d’ingestion vide ne peut pas invalider le dernier corpus valide',()=>{
  const a=assessCollection({id:'x',strategy:'catalog-html'},{discovered:0,aids:[]});
  assert.equal(a.success,false);
  assert.equal(a.emptyIngestion,true);
  assert.equal(a.lifecycleSafe,false);
});

test('une source control-only vide peut rester concluante sans agir sur le cycle de vie',()=>{
  const a=assessCollection({id:'x',strategy:'control-only'},{discovered:0,aids:[]});
  assert.equal(a.success,true);
  assert.equal(a.lifecycleSafe,false);
});

test('un plancher minExpected insuffisant reste un succès technique mais bloque le lifecycle',()=>{
  const a=assessCollection({id:'x',strategy:'catalog-html',minExpected:5},{discovered:3,aids:[{title:'A'}]});
  assert.equal(a.success,true);
  assert.equal(a.suspiciousVolume,true);
  assert.equal(a.lifecycleSafe,false);
});

test('une fiche retrouvée par une autre source réactive un doublon STALE',()=>{
  const merged=mergeAid(
    {id:'a',title:'A',lifecycleStatus:'STALE',verification:{sourceTier:'B',fieldEvidence:[]}},
    {id:'b',title:'A',lifecycleStatus:'ACTIVE',lastSeenAt:'2026-09-22T20:00:00Z',verification:{sourceTier:'B',fieldEvidence:[]}}
  );
  assert.equal(merged.lifecycleStatus,'ACTIVE');
  assert.equal(merged.lastSeenAt,'2026-09-22T20:00:00Z');
});
