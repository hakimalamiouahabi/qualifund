/**
 * Funding Pro — generator with explicit source/evidence gates.
 * Node 22+, no dependencies, no LLM, no network, no writes beyond an explicit output file.
 * Only subventions and avances remboursables are supported.
 */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const INSTRUMENTS = new Set(['SUBVENTION', 'AVANCE_REMBOURSABLE']);
const ISSUERS = new Set(['FEDER', 'REGION', 'BPIFRANCE', 'ADEME', 'AUTRE_PUBLIC']);
const VERIFIED = 'VERIFIED';
const money = value => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const trim = value => typeof value === 'string' ? value.trim() : '';
const md = value => trim(value).replaceAll('|', '\\|').replace(/\\r?\\n/g, ' ').replace(/[<>]/g, '');
const noGuess = value => trim(value) || 'À COMPLÉTER — aucune information fournie';
const sum = items => items.reduce((s, x) => s + x.amount_eur, 0);
const hasValidDate = value => /^\\d{4}-\\d{2}-\\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value + 'T00:00:00Z'));
const https = url => {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !u.username && !u.password && !u.hash;
  } catch { return false; }
};

export function validateDossier(data) {
  const errors = [], alerts = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { errors: ['JSON object required'], alerts, figures: null };
  const company = data.company || {}, project = data.project || {}, scheme = data.scheme || {}, budget = data.budget || {};
  if (!trim(company.name)) errors.push('company.name missing');
  if (!trim(project.name)) errors.push('project.name missing');
  if (!INSTRUMENTS.has(scheme.instrument)) errors.push('scheme.instrument must be SUBVENTION or AVANCE_REMBOURSABLE');
  if (!ISSUERS.has(scheme.issuer)) errors.push('scheme.issuer invalid');
  if (!trim(scheme.name)) errors.push('scheme.name missing');
  if (!https(scheme.official_url)) errors.push('scheme.official_url must be HTTPS');
  if (scheme.checked_on && !hasValidDate(scheme.checked_on)) errors.push('scheme.checked_on date invalid');
  if (!scheme.checked_on) alerts.push('Source non datée : relecture officielle obligatoire');
  if (scheme.verification_status !== VERIFIED) alerts.push('Dispositif non certifié : éligibilité et plafonds indéterminés');
  if (trim(company.siren) && !/^\\d{9}$/.test(company.siren)) errors.push('company.siren must have 9 digits');
  if (!Array.isArray(budget.expenses) || budget.expenses.length === 0) errors.push('budget.expenses required');
  const expenses = Array.isArray(budget.expenses) ? budget.expenses : [];
  for (const [i, x] of expenses.entries()) {
    if (!trim(x?.label) || !number(x?.amount_eur)) errors.push(`expense #${i + 1}: label and nonnegative numeric amount required`);
    if (x?.eligibility_status === VERIFIED && !https(x?.evidence_url)) {
      errors.push(`expense #${i + 1}: verified eligibility requires official HTTPS evidence_url`);
    }
    if (x?.eligibility_status !== VERIFIED) alerts.push(`Dépense #${i + 1} non confirmée éligible`);
  }
  const contributions = Array.isArray(budget.contributions) ? budget.contributions : [];
  for (const [i, x] of contributions.entries()) {
    if (!trim(x?.label) || !number(x?.amount_eur)) errors.push(`contribution #${i + 1}: invalid`);
  }
  if (budget.requested_eur !== undefined && !number(budget.requested_eur)) errors.push('budget.requested_eur invalid');
  if (scheme.rate_percent !== undefined && (!number(scheme.rate_percent) || scheme.rate_percent > 100)) errors.push('scheme.rate_percent invalid');
  if (scheme.ceiling_eur !== undefined && !number(scheme.ceiling_eur)) errors.push('scheme.ceiling_eur invalid');
  if (scheme.rate_percent !== undefined && (!https(scheme.rate_evidence_url) || scheme.rate_verification_status !== VERIFIED)) {
    alerts.push('Taux fourni sans preuve vérifiée : aucun plafond de taux calculé');
  }
  if (scheme.ceiling_eur !== undefined && (!https(scheme.ceiling_evidence_url) || scheme.ceiling_verification_status !== VERIFIED)) {
    alerts.push('Plafond fourni sans preuve vérifiée : plafond non exploitable');
  }
  const rules = Array.isArray(scheme.rules) ? scheme.rules : [];
  for (const [i, x] of rules.entries()) {
    if (!trim(x?.label)) errors.push(`rule #${i + 1}: label missing`);
    if (x?.status === VERIFIED && !https(x?.evidence_url)) errors.push(`rule #${i + 1}: verified rule missing evidence_url`);
    if (x?.status !== VERIFIED) alerts.push(`Critère #${i + 1} non vérifié`);
  }
  if (errors.length) return { errors, alerts: [...new Set(alerts)], figures: null };
  const total = sum(expenses);
  const eligible = sum(expenses.filter(x => x.eligibility_status === VERIFIED));
  const cofunding = sum(contributions);
  const requested = budget.requested_eur ?? 0;
  if (requested > eligible) alerts.push('Aide sollicitée supérieure aux dépenses documentées éligibles');
  if (requested + cofunding > total) alerts.push('Plan de financement supérieur au coût total');
  if (requested + cofunding < total) alerts.push('Plan de financement incomplet');
  const validRate = scheme.verification_status === VERIFIED && scheme.rate_verification_status === VERIFIED && https(scheme.rate_evidence_url);
  const validCeiling = scheme.verification_status === VERIFIED && scheme.ceiling_verification_status === VERIFIED && https(scheme.ceiling_evidence_url);
  const indicativeLimit = validRate ? eligible * scheme.rate_percent / 100 : null;
  const ceiling = validCeiling ? scheme.ceiling_eur : null;
  const strictCeiling = indicativeLimit === null ? ceiling : ceiling === null ? indicativeLimit : Math.min(indicativeLimit, ceiling);
  if (strictCeiling !== null && requested > strictCeiling) alerts.push('Montant sollicité supérieur au plafond théorique issu des paramètres documentés');
  if (scheme.instrument === 'AVANCE_REMBOURSABLE') alerts.push('Avance remboursable : modalités de remboursement, différé et clauses contractuelles à documenter');
  return { errors, alerts: [...new Set(alerts)], figures: { total, eligible, cofunding, requested, remaining: total - requested - cofunding, strictCeiling } };
}

export function renderDossier(data) {
  const report = validateDossier(data);
  if (report.errors.length) throw new Error(report.errors.join('; '));
  const { company, project, scheme, budget } = data;
  const f = report.figures;
  const contributions = Array.isArray(budget.contributions) ? budget.contributions : [];
  const rules = Array.isArray(scheme.rules) ? scheme.rules : [];
  const table = lines => lines.length ? lines.join('\\n') : '| Aucun élément documenté |';
  const output = [
    '# DOSSIER DE FINANCEMENT PUBLIC — BROUILLON NON CERTIFIÉ',
    '',
    '> Document de travail : aucune éligibilité, attribution, intensité d’aide ni date limite n’est présumée.',
    '',
    `Établi le : ${new Date().toISOString().slice(0,10)}`,
    '',
    '## 1. Identification du bénéficiaire',
    `- Entreprise : ${md(company.name)}`,
    `- SIREN : ${md(company.siren) || 'À VÉRIFIER'}`,
    `- Région : ${md(company.region) || 'À COMPLÉTER'}`,
    `- Activité : ${md(company.activity) || 'À COMPLÉTER'}`,
    '',
    '## 2. Dispositif visé et pièces de référence',
    `- Financeur/cadre : ${md(scheme.issuer)}`,
    `- Nom : ${md(scheme.name)}`,
    `- Instrument : ${scheme.instrument === 'SUBVENTION' ? 'Subvention' : 'Avance remboursable'}`,
    `- Source officielle déclarée : ${scheme.official_url}`,
    `- Consultation : ${scheme.checked_on || 'À VÉRIFIER'}`,
    `- Vérification humaine : ${scheme.verification_status === VERIFIED ? 'Déclarée effectuée — contrôler les preuves' : 'NON VÉRIFIÉE'}`,
    '',
    '## 3. Résumé exécutif',
    noGuess(project.summary),
    '',
    '## 4. Problématique et justification du besoin',
    noGuess(project.problem),
    '',
    '## 5. Caractère innovant et objectifs',
    noGuess(project.innovation),
    '',
    '## 6. Programme de travail et livrables',
    noGuess(project.workplan),
    '',
    '## 7. Retombées attendues et indicateurs mesurables',
    noGuess(project.impact),
    '',
    '## 8. Calendrier, jalons et gouvernance',
    noGuess(project.schedule),
    '',
    '## 9. Budget de projet',
    '| Poste de dépenses | Montant HT/à qualifier | Éligibilité | Référence |',
    '|---|---:|---|---|',
    ...budget.expenses.map(x => `| ${md(x.label)} | ${money(x.amount_eur)} | ${x.eligibility_status === VERIFIED ? 'Déclarée vérifiée' : 'À vérifier'} | ${https(x.evidence_url) ? x.evidence_url : '—'} |`),
    `**Total projet : ${money(f.total)}. Dépenses documentées comme éligibles : ${money(f.eligible)}.**`,
    '',
    '## 10. Plan de financement prévisionnel',
    '| Financement | Montant |',
    '|---|---:|',
    `| Aide publique sollicitée (${scheme.instrument}) | ${money(f.requested)} |`,
    ...contributions.map(x => `| ${md(x.label)} | ${money(x.amount_eur)} |`),
    `| Reste à financer / écart de bouclage | ${money(f.remaining)} |`,
    `- Plafond théorique documenté : ${f.strictCeiling === null ? 'NON CALCULABLE (preuves insuffisantes)' : money(f.strictCeiling)}`,
    '- Attention : les montants sont des projections, pas une décision d’attribution.',
    '',
    '## 11. Critères réglementaires et statut des vérifications',
    '| Critère déclaré | Statut | Source |',
    '|---|---|---|',
    ...rules.map(x => `| ${md(x.label)} | ${x.status === VERIFIED ? 'Preuve déclarée vérifiée' : 'À vérifier'} | ${https(x.evidence_url) ? x.evidence_url : '—'} |`),
    '',
    '## 12. Risques et mesures d’atténuation',
    noGuess(project.risks),
    '',
    '## 13. Alertes bloquantes avant dépôt',
    ...report.alerts.map(x => '- ' + x),
    '',
    '## 14. Pièces à collecter et validation',
    '- Justificatifs légaux, financiers, techniques et aides antérieures selon les textes officiels applicables.',
    '- Vérification de la date limite, des bénéficiaires admissibles, du calendrier d’incitativité et du cumul d’aides.',
    '- Validation juridique, budgétaire et métier par le responsable du dossier.',
    '',
    '**STATUT FINAL : BROUILLON — AUCUNE SOUMISSION AUTOMATIQUE.**',
    ''
  ];
  return output.join('\\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [input, output] = process.argv.slice(2);
    if (!input || !output) throw new Error('Usage: node engine.mjs input.json output.md');
    const data = JSON.parse(fs.readFileSync(input, 'utf8'));
    const rendered = renderDossier(data);
    fs.writeFileSync(output, rendered, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    console.log('Brouillon généré : ' + output);
  } catch (error) {
    console.error('Échec sécurisé : ' + error.message);
    process.exitCode = 1;
  }
}
