import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceCalibration, validateCollectionLock, requireCollectionLock } from '../scripts/lib/collection-lock.mjs';
import { assessCollection } from '../scripts/lib/source-cycle.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

const calibrated={id:'aura',official:true,strategy:'aura-official',minExpected:175,minImported:20,minImportRatio:0.1};
const pending={id:'bfc',official:true,strategy:'catalog-html'};
const control={id:'control',official:true,strategy:'control-only'};

test('une source d’ingestion doit être calibrée avant activation',()=>{
  assert.equal(sourceCalibration(calibrated).calibrated,true);
  assert.equal(sourceCalibration(pending).calibrated,false);
  assert.throws(
    ()=>validateCollectionLock({sources:[pending]},{locked:true,allowedSourceIds:['bfc']}),
    /SOURCE_NOT_CALIBRATED/
  );
});

test('un verrou calibré passe et une source de contrôle ne requiert pas de seuils',()=>{
  assert.doesNotThrow(()=>validateCollectionLock(
    {sources:[calibrated,control]},
    {locked:true,allowedSourceIds:['aura']}
  ));
  assert.equal(sourceCalibration(control).calibrated,true);
});

test('les seuils de calibration doivent être strictement positifs et le ratio borné',()=>{
  for(const bad of [
    {...calibrated,minExpected:0},
    {...calibrated,minImported:0},
    {...calibrated,minImportRatio:0},
    {...calibrated,minImportRatio:1.2}
  ])assert.equal(sourceCalibration(bad).calibrated,false);
});


test('la collecte de production refuse un mode global non verrouillé',()=>{
  assert.throws(()=>requireCollectionLock({locked:false,allowedSourceIds:[]}),/COLLECTION_LOCK_REQUIRED/);
  assert.doesNotThrow(()=>requireCollectionLock({locked:true,allowedSourceIds:['aura']}));
});

test('Bpifrance, ADEME et AURA ont tous des seuils de calibration exploitables en v12.8',()=>{
  const cfg=JSON.parse(fs.readFileSync(path.join(ROOT,'config','sources.json'),'utf8'));
  for(const id of ['bpifrance_aap','bpifrance_aides','bpifrance_rebond_industriel','ademe','aura']){
    const source=cfg.sources.find(x=>x.id===id);
    assert.ok(source,id+' absent du registre');
    assert.equal(sourceCalibration(source).calibrated,true,id+' non calibré');
  }
});


test('le compteur officiel dynamique prime sur le seuil historique sans perdre le fail-closed',()=>{
  const source={id:'aura',minExpected:175,minImported:20,minImportRatio:0.1};
  const legitimateDrop=assessCollection(source,{
    discovered:170,
    aids:Array.from({length:80},(_,i)=>({id:String(i)})),
    audit:{channels:{enterpriseExpected:170}}
  });
  assert.equal(legitimateDrop.dynamicExpected,170);
  assert.equal(legitimateDrop.suspiciousVolume,false);

  const incompleteRise=assessCollection(source,{
    discovered:175,
    aids:Array.from({length:80},(_,i)=>({id:String(i)})),
    audit:{channels:{enterpriseExpected:200}}
  });
  assert.equal(incompleteRise.dynamicExpected,200);
  assert.equal(incompleteRise.suspiciousVolume,true);
  assert.equal(incompleteRise.success,false);
});
