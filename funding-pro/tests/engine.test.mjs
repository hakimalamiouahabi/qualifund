import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateDossier, renderDossier } from '../engine.mjs';

const original = JSON.parse(fs.readFileSync(new URL('../fixtures/fictional-case.json', import.meta.url), 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));

test('dossier fictif : budget et alertes prudentes', () => {
  const result = validateDossier(original);
  assert.equal(result.errors.length, 0);
  assert.equal(result.figures.total, 130000);
  assert.equal(result.figures.eligible, 0);
  assert.equal(result.figures.remaining, 0);
  assert.equal(result.figures.strictCeiling, null);
  assert.ok(result.alerts.some(x => x.includes('non certifié')));
  const output = renderDossier(original);
  assert.match(output, /BROUILLON NON CERTIFIÉ/);
  assert.match(output, /AVANCE REMBOURSABLE|Subvention/);
  assert.match(output, /AUCUNE SOUMISSION AUTOMATIQUE/);
});

test('refuse aides hors subventions et AR', () => {
  const d = clone(original); d.scheme.instrument = 'PRET_COMMERCIAL';
  assert.ok(validateDossier(d).errors.some(x => x.includes('scheme.instrument')));
  assert.throws(() => renderDossier(d));
});

test('taux non sourcé jamais transformé en plafond', () => {
  const d = clone(original); d.scheme.rate_percent = 80;
  assert.equal(validateDossier(d).figures.strictCeiling, null);
});

test('taux certifié et plafond certifié : limite arithmétique', () => {
  const d = clone(original); d.scheme.verification_status = 'VERIFIED';
  d.scheme.rate_percent = 50; d.scheme.rate_verification_status = 'VERIFIED';
  d.scheme.rate_evidence_url = 'https://agirpourlatransition.ademe.fr/';
  d.scheme.ceiling_eur = 40000; d.scheme.ceiling_verification_status = 'VERIFIED';
  d.scheme.ceiling_evidence_url = 'https://agirpourlatransition.ademe.fr/';
  for (const row of d.budget.expenses) {
    row.eligibility_status = 'VERIFIED';
    row.evidence_url = 'https://agirpourlatransition.ademe.fr/';
  }
  assert.equal(validateDossier(d).figures.strictCeiling, 40000);
});

test('dépense prétendue éligible sans preuve rejetée', () => {
  const d = clone(original);
  d.budget.expenses[0].eligibility_status = 'VERIFIED';
  assert.ok(validateDossier(d).errors.some(x => x.includes('official HTTPS')));
});

test('avance remboursable exige une alerte contractuelle', () => {
  const d = clone(original); d.scheme.instrument = 'AVANCE_REMBOURSABLE';
  assert.ok(validateDossier(d).alerts.some(x => x.includes('modalités de remboursement')));
});

test('données invalides exclues : montants et SIREN', () => {
  const d = clone(original); d.budget.expenses[0].amount_eur = -5; d.company.siren = '1234';
  const { errors } = validateDossier(d);
  assert.ok(errors.some(x => x.includes('expense #1')));
  assert.ok(errors.some(x => x.includes('siren')));
});
