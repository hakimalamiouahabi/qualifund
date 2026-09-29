import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fromAidesEntreprises, broadAidTypes } from '../scripts/lib/records.mjs';

test('une garantie entreprise reste dans la bibliothèque large',()=>{
  const raw={id_aid:999,status:1,aid_nom:'Garantie développement PME',aid_objet:'Soutenir le développement',aid_benef:'PME',aid_montant:'Garantie de financement',cache_indexation:{profils:[{id_tut:4}],territoires:[{ter_libelle:'FRANCE'}],natures:[{id_typ:99,typ_libelle:'Garantie'}],financeurs:[],projets:[]},complements:{}};
  const a=fromAidesEntreprises(raw);
  assert.ok(a);
  assert.deepEqual(a.companyCategories,['PME']);
  assert.ok(a.aidTypes.includes('GARANTIE'));
});

test('les natures officielles larges sont reconnues',()=>{
  assert.ok(broadAidTypes([{typ_libelle:'Prêt'}],'').includes('PRET'));
  assert.ok(broadAidTypes([{typ_libelle:'Allègement fiscal'}],'').includes('ALLEGEMENT_FISCAL'));
  assert.ok(broadAidTypes([{typ_libelle:'Participation au capital'}],'').includes('PARTICIPATION_CAPITAL'));
  assert.ok(broadAidTypes([{typ_libelle:'Crédit-bail'}],'').includes('CREDIT_BAIL'));
});

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

test('moteur de recommandation reste strict SUB AR PTZ',()=>{
  const app=fs.readFileSync(new URL('../site/app.js',import.meta.url),'utf8');
  assert.match(app,/const targetInstruments=\['SUBVENTION','AVANCE_REMBOURSABLE','PRET_TAUX_ZERO'\]/);
});

