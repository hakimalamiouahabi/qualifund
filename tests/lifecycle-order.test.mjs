import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceOwnsAid,shouldMarkStale} from '../scripts/lib/lifecycle.mjs';

test('provenance multi-source reconnue par sourceId et sourceAliases',()=>{
  const aid={sourceId:'source_a',sourceAliases:['source_a','source_b']};
  assert.equal(sourceOwnsAid(aid,'source_a'),true);
  assert.equal(sourceOwnsAid(aid,'source_b'),true);
  assert.equal(sourceOwnsAid(aid,'source_c'),false);
});

test('une fiche déjà vue ailleurs dans le cycle ne redevient pas STALE selon ordre des connecteurs',()=>{
  const key='qf_x';
  const aid={sourceId:'source_a',sourceAliases:['source_a','source_b']};
  const seenByA=new Set();
  const seenInCycle=new Set([key]); // source B est passée avant A et a vu la fiche
  assert.equal(shouldMarkStale({aid,sourceId:'source_a',key,seenBySource:seenByA,seenInCycle,existedBefore:true}),false);
});

test('une fiche absente de toutes ses sources peut devenir STALE',()=>{
  const key='qf_x';
  const aid={sourceId:'source_a',sourceAliases:['source_a','source_b']};
  assert.equal(shouldMarkStale({aid,sourceId:'source_a',key,seenBySource:new Set(),seenInCycle:new Set(),existedBefore:true}),true);
});
