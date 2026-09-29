import test from 'node:test';
import assert from 'node:assert/strict';
import { rowToOpenDataSoftAid } from '../scripts/connectors/opendatasoft.mjs';
import { assessCollection } from '../scripts/lib/source-cycle.mjs';

test('OpenDataSoft conserve une aide officielle même si l’instrument n’est pas explicite',()=>{
  const source={
    id:'occitanie',
    name:'Région Occitanie — aides et appels à projets',
    scope:'Occitanie',
    url:'https://data.laregion.fr/api/explore/v2.1/',
    api:'https://data.laregion.fr/api/explore/v2.1/',
    datasetId:'aides-et-appels-a-projets-de-la-region-occitanie'
  };
  const a=rowToOpenDataSoftAid({
    titre:'Aide régionale à la transformation',
    chapo:'Soutien régional à des projets de transformation.',
    url:'https://www.laregion.fr/aide-regionale-transformation'
  },source,0);
  assert.ok(a);
  assert.deepEqual(a.aidTypes,['AUTRE']);
  assert.equal(a.officialPage,'https://www.laregion.fr/aide-regionale-transformation');
});

test('OpenDataSoft Île-de-France lit les champs qui, url_descriptif et libelle',()=>{
  const source={
    id:'idf',
    name:'Région Île-de-France — aides et appels à projets',
    scope:'Île-de-France',
    url:'https://www.iledefrance.fr/aides-et-appels-a-projets',
    api:'https://data.iledefrance.fr/api/explore/v2.1/',
    datasetId:'aides-appels-a-projets'
  };
  const a=rowToOpenDataSoftAid({
    libelle:'Pack Relance Île-de-France',
    qui:'Professionnel - ETI < 5000|||Professionnel - GE > 5000|||Professionnel - PME < 250',
    objectif_txt:'Accompagner la relance des entreprises.',
    url_descriptif:'https://www.iledefrance.fr/aides-et-appels-a-projets/430'
  },source,1);
  assert.ok(a);
  assert.equal(a.title,'Pack Relance Île-de-France');
  assert.equal(a.officialPage,'https://www.iledefrance.fr/aides-et-appels-a-projets/430');
  assert.ok(a.companyCategories.includes('PME'));
  assert.ok(a.companyCategories.includes('ETI'));
  assert.ok(a.companyCategories.includes('GE'));
});

test('le contrôle de couverture refuse une extraction très partielle',()=>{
  const source={strategy:'opendatasoft',minExpected:200,minImported:180,minImportRatio:.8};
  const bad=assessCollection(source,{discovered:226,aids:Array.from({length:36},(_,i)=>({id:i}))});
  assert.equal(bad.success,false);
  assert.equal(bad.lowImportedCount,true);
  assert.equal(bad.lowImportRatio,true);
  const good=assessCollection(source,{discovered:226,aids:Array.from({length:226},(_,i)=>({id:i}))});
  assert.equal(good.success,true);
  assert.equal(good.lifecycleSafe,true);
});
