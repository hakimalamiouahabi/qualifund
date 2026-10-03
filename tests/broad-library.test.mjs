import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('la publication ne préfiltre plus la bibliothèque sur SUB AR PTZ',()=>{
  const src=fs.readFileSync(new URL('../scripts/update-library.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(src,/dedupe\(\[\.\.\.current\.values\(\)\]\)\.filter\(a=>arr\(a\.aidTypes\)/);
  assert.match(src,/DIRECT_OFFICIAL_CATALOG/);
});

test('interface bibliothèque expose taille région thème et instrument',()=>{
  const app=fs.readFileSync(new URL('../site/app.js',import.meta.url),'utf8');
  const pub=fs.readFileSync(new URL('../site/bibliotheque/index.html',import.meta.url),'utf8');
  for(const token of ['PME','ETI','GE','STARTUP','libRegion','libTheme','libInstrument'])assert.ok(app.includes(token),token);
  for(const token of ['PME','ETI','GE','STARTUP','id="region"','id="theme"','id="instrument"'])assert.ok(pub.includes(token),token);
});

test('moteur de qualification accepte aussi les appels à projets',()=>{
  const app=fs.readFileSync(new URL('../site/app.js',import.meta.url),'utf8');
  assert.match(app,/const targetInstruments=\['SUBVENTION','AVANCE_REMBOURSABLE','PRET_TAUX_ZERO','APPEL_A_PROJET'\]/);
});

