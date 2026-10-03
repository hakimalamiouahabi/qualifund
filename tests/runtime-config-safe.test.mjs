import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('runtime config n’invente aucun endpoint serverless selon le hostname',()=>{
  const s=fs.readFileSync(new URL('../site/runtime-config.js',import.meta.url),'utf8');
  assert.doesNotMatch(s,/location\.hostname/);
  assert.match(s,/refreshEndpoint:server\.refreshEndpoint\|\|null/);
  assert.match(s,/companyEndpoint:server\.companyEndpoint\|\|null/);
  assert.match(s,/recherche-entreprises\.api\.gouv\.fr/);
});

test('service worker porte exactement la version applicative courante',()=>{
  const sw=fs.readFileSync(new URL('../site/sw.js',import.meta.url),'utf8');
  const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
  assert.ok(sw.includes(`funding-radar-v${pkg.version}-shell`));
});
