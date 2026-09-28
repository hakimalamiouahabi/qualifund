import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const cfg=JSON.parse(fs.readFileSync(new URL('../config/sources.json',import.meta.url),'utf8'));
const by=new Map(cfg.sources.map(s=>[s.id,s]));
test('planchers Web officiels des sources prioritaires',()=>{
  assert.ok(by.get('ademe').minExpected>=50);
  assert.ok(by.get('dge_aap').minExpected>=40);
  assert.ok(by.get('pdl').minExpected>=100);
  assert.equal(by.get('occitanie').datasetId,'aides-et-appels-a-projets-de-la-region-occitanie@occitanie');
  assert.equal(by.get('idf').datasetId,'aides-appels-a-projets');
});
