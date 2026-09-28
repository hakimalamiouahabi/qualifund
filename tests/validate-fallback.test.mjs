import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('validation locale fonctionne même sans AJV installé',()=>{
  const out=execFileSync(process.execPath,['scripts/validate-library.mjs'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
  assert.match(out,/OK \d+ fiches/);
});
