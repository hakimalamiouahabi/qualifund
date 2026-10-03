import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

test('le smoke production suit les marqueurs structurels actuels de FUNDING RADAR', async()=>{
  const [smoke,index]=await Promise.all([
    fs.readFile(path.join(ROOT,'scripts','live-smoke.mjs'),'utf8'),
    fs.readFile(path.join(ROOT,'site','index.html'),'utf8')
  ]);
  assert.equal(smoke.includes("contains:'LEYTON RADAR'"),false,'ancien marqueur marketing interdit');
  for(const marker of ['FUNDING RADAR','id="app"','app.js']){
    assert.ok(smoke.includes(marker),'marqueur absent du smoke: '+marker);
    assert.ok(index.includes(marker),'marqueur absent de la page: '+marker);
  }
});
