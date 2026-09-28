import test from 'node:test';
import assert from 'node:assert/strict';
import { regulatoryFallbacks } from '../scripts/lib/regulatory-fallbacks.mjs';

test('fallback réglementaire extrait versement, remboursement, sélection et de minimis sans headings',()=>{
  const t=`Les projets seront évalués selon une grille de sélection et une notation sur 100. Le versement de l'aide intervient à 50 % à la notification, puis le solde sur justificatifs. L'avance remboursable bénéficie d'un différé de 24 mois puis d'un remboursement sur 5 ans. Ce dispositif relève du régime de minimis et peut être cumulé sous réserve du plafond applicable.`;
  const x=regulatoryFallbacks(t);
  assert.match(x.selectionCriteria,/notation sur 100/i);
  assert.match(x.disbursementTerms,/versement/i);
  assert.match(x.repaymentTerms,/24 mois/i);
  assert.match(x.stateAidRules,/de minimis/i);
});
