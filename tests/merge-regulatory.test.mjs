import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeAid } from '../scripts/lib/merge.mjs';

test('la fusion conserve les champs réglementaires enrichis de meilleure preuve',()=>{
  const base={title:'Aide',verification:{sourceTier:'C',fieldEvidence:[]}};
  const inc={title:'Aide',selectionCriteria:'Notation sur 100',disbursementTerms:'50 % à la signature, solde sur justificatifs',repaymentTerms:'Différé 24 mois puis remboursement sur 5 ans',stateAidRules:'Régime de minimis',applicationProcess:'Dépôt en ligne',contact:'Service aides',minimumProjectCost:100000,maximumProjectCost:2000000,aidSplit:{subventionPercent:50,advancePercent:50},permanent:false,verification:{sourceTier:'A',fieldEvidence:[]}};
  const out=mergeAid(base,inc);
  assert.equal(out.selectionCriteria,inc.selectionCriteria);
  assert.equal(out.disbursementTerms,inc.disbursementTerms);
  assert.equal(out.repaymentTerms,inc.repaymentTerms);
  assert.equal(out.stateAidRules,inc.stateAidRules);
  assert.equal(out.applicationProcess,inc.applicationProcess);
  assert.equal(out.contact,inc.contact);
  assert.equal(out.minimumProjectCost,100000);
  assert.equal(out.maximumProjectCost,2000000);
  assert.deepEqual(out.aidSplit,inc.aidSplit);
  assert.equal(out.permanent,false);
});
