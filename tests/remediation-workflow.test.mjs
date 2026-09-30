import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('la release génère une file de remédiation avant le calcul final des gates',()=>{
  const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
  assert.match(pkg.scripts['release:verify'],/npm run remediation/);
  const yml=fs.readFileSync(new URL('../.github/workflows/update-and-deploy.yml',import.meta.url),'utf8');
  assert.match(yml,/npm run remediation/);
  assert.ok(yml.indexOf('npm run remediation')<yml.indexOf('npm run production:gates'));
  assert.match(yml,/git add package-lock\.json site\/data site\/bibliotheque site\/runtime-config\.js site\/sw\.js PRODUCTION_READINESS\.md REMEDIATION_REPORT\.md/);
});
