import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync(new URL('../scripts/generate-daily-report.mjs',import.meta.url),'utf8');
test('un premier rapport sans baseline ne classe pas tout le stock comme nouveau',()=>{
  assert.match(src,/baselineInitialized=!explicitBefore/);
  assert.match(src,/beforeObj=explicitBefore\|\|afterObj/);
});
test('update-library conserve le snapshot précédent avant écriture',()=>{
  const update=fs.readFileSync(new URL('../scripts/update-library.mjs',import.meta.url),'utf8');
  assert.match(update,/library\.previous\.json/);
});
