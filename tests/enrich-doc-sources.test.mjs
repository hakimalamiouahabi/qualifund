import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('enrichissement PDF considère CdC, règlements et sources PDF sans doublon',()=>{
  const s=fs.readFileSync(new URL('../scripts/lib/enrich.mjs',import.meta.url),'utf8');
  assert.match(s,/\.\.\.arr\(out\.cdcLinks\).*\.\.\.arr\(out\.regulationLinks\).*\.\.\.arr\(out\.sourceLinks\)/s);
  assert.match(s,/new Map\(docCandidates\.map\(x=>\[x\.url,x\]\)\)/);
});
