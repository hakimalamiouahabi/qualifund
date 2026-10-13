/**
 * Validate the EXISTING 700-role catalog from a separately checked-out public repository.
 * Never modifies, instantiates or launches roles. Fail closed on drift.
 */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const LEVEL_COUNTS = { dsi: 5, senior_manager: 30, manager: 60, team_leader: 60, expert: 545 };
const PARENT = { senior_manager: 'dsi', manager: 'senior_manager', team_leader: 'manager', expert: 'team_leader' };

export function verifyExistingRoster(manifestFile, referenceFile) {
  const ref = JSON.parse(fs.readFileSync(referenceFile, 'utf8'));
  const raw = fs.readFileSync(manifestFile);
  const sha = createHash('sha1').update(Buffer.from('blob ' + raw.length + '\0')).update(raw).digest('hex');
  if (sha !== ref.verified_blob_sha) throw new Error('BLOQUÉ : empreinte Git des 700 profils différente du référentiel autorisé');
  const roster = JSON.parse(raw.toString('utf8'));
  if (!Array.isArray(roster.profiles) || roster.profiles.length !== 700) throw new Error('BLOQUÉ : les 700 profils attendus sont absents');
  const byId = new Map();
  const counts = Object.fromEntries(Object.keys(LEVEL_COUNTS).map(x => [x, 0]));
  for (const p of roster.profiles) {
    if (typeof p.id !== 'string' || !p.title || byId.has(p.id) || !(p.level in counts)) throw new Error('BLOQUÉ : doublon ou profil incohérent');
    byId.set(p.id, p);
    counts[p.level] += 1;
  }
  for (const [key, expected] of Object.entries(LEVEL_COUNTS)) {
    if (counts[key] !== expected) throw new Error('BLOQUÉ : hiérarchie différente, rôle ' + key);
  }
  for (const p of roster.profiles) {
    if (p.level === 'dsi') {
      if (p.parent_id !== 'OWNER') throw new Error('BLOQUÉ : un DSI doit dépendre du propriétaire');
    } else {
      if (!byId.has(p.parent_id) || byId.get(p.parent_id).level !== PARENT[p.level]) throw new Error('BLOQUÉ : lien hiérarchique non conforme');
    }
  }
  return { status: 'PASS', loaded_roles: byId.size, breakdown: counts, running_agents: 0, verified_blob_sha: sha, note: 'Référentiel attesté, rôles non exécutés' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [roster, reference] = process.argv.slice(2);
    if (!roster || !reference) throw new Error('Usage: node agentgrid.mjs <catalogue-700.json> <ref.json>');
    console.log(JSON.stringify(verifyExistingRoster(roster, reference), null, 2));
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}
