import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const cfg=JSON.parse(fs.readFileSync(new URL('../config/sources.json',import.meta.url),'utf8'));
const by=new Map(cfg.sources.map(s=>[s.id,s]));
test('planchers Web officiels des sources prioritaires',()=>{
  assert.ok(by.get('ademe').minExpected>=60);
  assert.ok(by.get('ademe').minImported>=1);
  assert.match(by.get('ademe').externalAuditFile||'',/ademe-v2-external-audit\.json$/);
  assert.equal(by.get('ademe').strategy,'ademe-official');
  assert.ok(by.get('bpifrance_aap').minExpected>=20);
  assert.ok(by.get('bpifrance_aides').minExpected>=20);
  assert.ok(!by.has('dge_aap')); // Hors du périmètre demandé
  assert.ok(by.get('pdl').minExpected>=150);
  assert.ok(['aides-et-appels-a-projets-de-la-region-occitanie','aides-et-appels-a-projets-de-la-region-occitanie@occitanie'].includes(by.get('occitanie').datasetId));
  assert.ok(by.get('occitanie').minImported>=180);
  assert.equal(by.get('idf').datasetId,'aides-appels-a-projets');
  assert.equal(by.get('idf').strategy,'opendatasoft');
  assert.ok(by.get('idf').minImported>=150);
});

