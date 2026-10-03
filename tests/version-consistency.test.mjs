import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const cfg=JSON.parse(fs.readFileSync(new URL('../config/sources.json',import.meta.url),'utf8'));
const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const update=fs.readFileSync(new URL('../scripts/update-library.mjs',import.meta.url),'utf8');
const gates=fs.readFileSync(new URL('../scripts/production-gates.mjs',import.meta.url),'utf8');
const indexer=fs.readFileSync(new URL('../scripts/build-search-index.mjs',import.meta.url),'utf8');
const preflight=fs.readFileSync(new URL('../scripts/preflight-sources.mjs',import.meta.url),'utf8');
test('version applicative cohérente et non figée dans les générateurs',()=>{
  assert.equal(pkg.version,cfg.version);
  assert.match(update,/version:cfg\.version/);
  assert.match(gates,/version:cfg\.version/);
  assert.match(indexer,/version:cfg\.version/);
  assert.match(preflight,/FUNDING-RADAR\/\$\{cfg\.version\} source-health/);
});
