import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync(new URL('../scripts/lib/http.mjs',import.meta.url),'utf8');
test('le User-Agent ne fige pas une ancienne version produit',()=>{
  assert.doesNotMatch(src,/LEYTON-RADAR\/10\.0/);
  assert.match(src,/LEYTON-RADAR/);
});
