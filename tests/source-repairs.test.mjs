import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Occitanie utilise l’identifiant OpenDataSoft officiel actuel',()=>{
  const cfg=JSON.parse(fs.readFileSync(new URL('../config/sources.json',import.meta.url),'utf8'));
  const s=cfg.sources.find(x=>x.id==='occitanie');
  assert.equal(s.datasetId,'aides-et-appels-a-projets-de-la-region-occitanie');
});

test('Normandie collecte les liens de cartes même sans mot aide dans le titre',()=>{
  const cfg=JSON.parse(fs.readFileSync(new URL('../config/sources.json',import.meta.url),'utf8'));
  const s=cfg.sources.find(x=>x.id==='normandie');
  assert.equal(s.catalogLinkSelector,'h3 a[href]');
  const src=fs.readFileSync(new URL('../scripts/connectors/web-catalog.mjs',import.meta.url),'utf8');
  assert.match(src,/catalogLinkSelector/);
});
