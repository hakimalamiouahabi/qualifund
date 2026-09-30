import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertDirectSources } from '../scripts/lib/direct-sources.mjs';

const cfg=JSON.parse(fs.readFileSync(new URL('../config/sources.json',import.meta.url),'utf8'));
const by=new Map(cfg.sources.map(s=>[s.id,s]));
const connector=fs.readFileSync(new URL('../scripts/connectors/bpifrance.mjs',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../site/app.js',import.meta.url),'utf8');

test('Bpifrance utilise deux collecteurs directs dédiés',()=>{
  assert.equal(by.get('bpifrance_aap')?.strategy,'bpifrance-aap');
  assert.equal(by.get('bpifrance_aides')?.strategy,'bpifrance-aides');
  assert.ok(!by.has('bpifrance'));
  assert.ok(!by.has('bpifrance_adi'));
  assert.ok(by.get('bpifrance_aap').minExpected>=28);
  assert.ok(by.get('bpifrance_aides').minExpected>=20);
  assert.doesNotThrow(()=>assertDirectSources(cfg));
});

test('le collecteur Bpifrance parcourt la pagination et cible la rubrique aides',()=>{
  assert.match(connector,/page='\+page/);
  assert.match(connector,/Subventions et avances remboursables/);
  assert.match(connector,/\/nos-appels-a-projets-concours/);
  assert.match(connector,/\/catalogue-offres\//);
});

test('le filtre guichet Bpifrance repose sur la provenance officielle',()=>{
  assert.match(app,/const provenance=norm\(\[a\?\.sourceId,\.\.\.arr\(a\?\.sourceAliases\)\]/);
  assert.match(app,/bpifrance\\\.fr\$/);
});
