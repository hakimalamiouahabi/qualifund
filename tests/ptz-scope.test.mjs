import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeAidTypes } from '../scripts/lib/utils.mjs';

test('normalisation : accepte uniquement les prêts explicitement à taux zéro / honneur',()=>{
  assert.deepEqual(normalizeAidTypes('Prêt d’honneur à taux zéro sans intérêt'),['PRET_TAUX_ZERO']);
  assert.deepEqual(normalizeAidTypes('Prêt à taux 0% pour l’innovation'),['PRET_TAUX_ZERO']);
  assert.deepEqual(normalizeAidTypes('Prêt bancaire à 3,8 %'),[]);
});

test('sources PTZ officielles Occitanie et Région Sud sont ingestives',()=>{
  const cfg=JSON.parse(fs.readFileSync(new URL('../config/sources.json',import.meta.url),'utf8'));
  for(const id of ['occitanie_foster','paca_feder_loan']){
    const s=cfg.sources.find(x=>x.id===id);
    assert.equal(s.strategy,'official-page');
    assert.equal(s.forceAidType,'PRET_TAUX_ZERO');
  }
});
