import test from 'node:test';
import assert from 'node:assert/strict';
import { nextApplicableDeadline } from '../scripts/lib/calendar.mjs';

test('règle de recommandation J+1 et permanence prouvée',()=>{
  const d=new Date('2026-09-22T12:00:00Z');
  assert.equal(nextApplicableDeadline({deadlines:['2026-09-22']},d).eligible,false,'J0 doit être exclu');
  assert.equal(nextApplicableDeadline({deadlines:['2026-09-23']},d).eligible,true,'J+1 doit être retenu');
  assert.equal(nextApplicableDeadline({deadlines:['2026-09-24']},d).eligible,true,'J+2 doit être retenu');
  assert.deepEqual(nextApplicableDeadline({permanent:true},d),{eligible:false,date:null,reason:'PERMANENT_UNVERIFIED'});
  const verified={permanent:true,verification:{fieldEvidence:[{field:'calendar',sourceTier:'B'}]}};
  assert.deepEqual(nextApplicableDeadline(verified,d),{eligible:true,date:null,reason:'PERMANENT'});
});
