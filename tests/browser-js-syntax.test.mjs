import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('les scripts navigateur principaux sont syntaxiquement valides',()=>{
  for(const rel of ['../site/app.js','../site/scoring-core.js']){
    const code=fs.readFileSync(new URL(rel,import.meta.url),'utf8');
    assert.doesNotThrow(()=>new vm.Script(code,{filename:rel}));
  }
});
