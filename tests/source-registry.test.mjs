import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const cfg=JSON.parse(fs.readFileSync(new URL('../config/sources.json',import.meta.url)));
test('registre limité aux sources directes de guichet ou de région',()=>{assert.equal(cfg.sourcePolicy,'DIRECT_OFFICIAL_ONLY');assert.equal(cfg.sourceSelectionPolicy,'GUICHET_OR_REGION_OFFICIAL_ONLY');assert.ok(cfg.sources.length>0);assert.ok(!cfg.sources.some(s=>s.id==='aides_entreprises'));assert.ok(!cfg.sources.some(s=>s.id==='europe_france'));});
test('la grande majorité des sources sont officielles',()=>{const s=cfg.sources||[],n=s.filter(x=>x.official).length;assert.ok(n/s.length>=.95)});

