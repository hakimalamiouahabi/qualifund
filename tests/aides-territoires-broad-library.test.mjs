import test from 'node:test';
import assert from 'node:assert/strict';
import { fromAidesTerritoires } from '../scripts/connectors/aides-territoires.mjs';

test('Aides Territoires conserve un dispositif privé national/régional même hors SUB/AR/PTZ', () => {
  const aid=fromAidesTerritoires({
    id: 424242,
    name: 'Garantie pour entreprises',
    description: 'Garantie financière destinée aux PME et entreprises privées.',
    eligibility: 'Entreprises privées',
    targeted_audiences: ['private_sector'],
    aid_types: ['Guarantee'],
    perimeter: 'France entière',
    is_call_for_project: false,
    url: '/aides/garantie-entreprises/'
  });
  assert.ok(aid);
  assert.equal(aid.scope,'NATIONAL');
  assert.ok(aid.aidTypes.includes('GARANTIE'));
  assert.ok(aid.companyCategories.includes('PME'));
});
