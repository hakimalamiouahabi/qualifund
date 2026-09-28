import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('un permanent exige une preuve calendrier A/B dans le moteur navigateur',()=>{
  const s=fs.readFileSync(new URL('../site/app.js',import.meta.url),'utf8');
  assert.match(s,/function permanentVerified\(a\).*field==='calendar'.*\['A','B'\]\.includes\(e\.sourceTier\)/s);
  assert.match(s,/PERMANENT_UNVERIFIED/);
});
