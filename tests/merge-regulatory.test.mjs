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

test('une annexe PDF générique ne remplace ni le nom ni la page officielle du dispositif',()=>{
  const base={title:'Projet d’innovation France 2030',officialPage:'https://example.fr/appel',verification:{sourceTier:'B',fieldEvidence:[]}};
  const pdf={title:'Document officiel',officialPage:'https://example.fr/reglement.pdf',objective:'Texte enrichi',verification:{sourceTier:'A',fieldEvidence:[]}};
  const out=mergeAid(base,pdf);
  assert.equal(out.title,'Projet d’innovation France 2030');
  assert.equal(out.officialPage,'https://example.fr/appel');
  assert.equal(out.objective,'Texte enrichi');
});


test('un lien officiel spécifique remplace un lien générique lors de la fusion',()=>{
  const base={title:'Aide innovation',officialPage:'https://data.aides-entreprises.fr/stock',verification:{sourceTier:'C',fieldEvidence:[]}};
  const inc={title:'Aide innovation',officialPage:'https://www.bpifrance.fr/catalogue-offres/aide-pour-le-developpement-de-linnovation',verification:{sourceTier:'B',fieldEvidence:[]}};
  const out=mergeAid(base,inc);
  assert.equal(out.officialPage,inc.officialPage);
});
