import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const cfg=JSON.parse(fs.readFileSync(new URL('../config/sources.json',import.meta.url)));
test('registre maître contient au moins 140 sources',()=>assert.ok((cfg.sources||[]).length>=140));
test('la grande majorité des sources sont officielles',()=>{const s=cfg.sources||[],n=s.filter(x=>x.official).length;assert.ok(n/s.length>=.95)});
