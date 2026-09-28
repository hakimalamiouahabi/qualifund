import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('préflight sérialise probed/conclusive et ne confond pas erreurs réseau avec résultats concluants',()=>{
  const s=fs.readFileSync(new URL('../scripts/preflight-sources.mjs',import.meta.url),'utf8');
  assert.match(s,/const unprobed=/);
  assert.match(s,/conclusive=results\.filter\(x=>\['OK','PROTECTED','HTTP_ERROR'\]/);
  assert.match(s,/liveCycleExecuted:false/);
});

test('QA dérive les résultats concluants uniquement des réponses HTTP si le résumé ancien est incomplet',()=>{
  const s=fs.readFileSync(new URL('../scripts/quality-report.mjs',import.meta.url),'utf8');
  assert.match(s,/\['OK','PROTECTED','HTTP_ERROR'\]\.includes\(x\.probeState\)/);
  assert.match(s,/cfg\.sources\?\.length/);
});
