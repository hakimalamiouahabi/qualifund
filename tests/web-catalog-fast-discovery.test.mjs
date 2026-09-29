import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('le collecteur catalogue ne télécharge plus les PDF pendant la découverte',()=>{
  const s=fs.readFileSync(new URL('../scripts/connectors/web-catalog.mjs',import.meta.url),'utf8');
  const start=s.indexOf('async function extractOne');
  const end=s.indexOf('export async function collectWebCatalog');
  const block=s.slice(start,end);
  assert.doesNotMatch(block,/fetchBuffer\(/);
  assert.doesNotMatch(block,/extractFromPdf\(/);
  assert.match(block,/Les liens documentaires restent attachés/);
});

test('le collecteur retente le catalogue rendu quand le HTML initial est incomplet',()=>{
  const s=fs.readFileSync(new URL('../scripts/connectors/web-catalog.mjs',import.meta.url),'utf8');
  assert.match(s,/async function renderedCatalogLinks/);
  assert.match(s,/navigateur rendu/);
});
