import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceCalibration, validateCollectionLock } from '../scripts/lib/collection-lock.mjs';

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
