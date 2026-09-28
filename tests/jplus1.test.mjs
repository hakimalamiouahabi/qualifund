import test from 'node:test';
import assert from 'node:assert/strict';
import { isActiveAtJPlusOne, jPlusOneDate } from '../scripts/lib/jplus1.mjs';

const now=new Date('2026-09-28T12:00:00Z');

test('J+1 Europe/Paris vaut le lendemain civil',()=>{
  assert.equal(jPlusOneDate(now),'2026-09-29');
});

test('une aide clôturant à J+1 compte dans la cible',()=>{
  assert.equal(isActiveAtJPlusOne({lifecycleStatus:'ACTIVE',closingDate:'2026-09-29'},now),true);
});

test('une aide clôturant à J est exclue de la cible',()=>{
  assert.equal(isActiveAtJPlusOne({lifecycleStatus:'ACTIVE',closingDate:'2026-09-28'},now),false);
});

test('une aide permanente compte dans la cible J+1',()=>{
  assert.equal(isActiveAtJPlusOne({lifecycleStatus:'ACTIVE',permanent:true},now),true);
});

test('une date manquante ne compte jamais comme active J+1',()=>{
  assert.equal(isActiveAtJPlusOne({lifecycleStatus:'ACTIVE'},now),false);
});

test('une fiche archivée est exclue même si elle est permanente',()=>{
  assert.equal(isActiveAtJPlusOne({lifecycleStatus:'ARCHIVE',permanent:true},now),false);
});
