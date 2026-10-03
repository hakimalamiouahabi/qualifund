import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('le certificat ADEME v13 reste PASS, fingerprinté et official-only après passage à AURA',()=>{
  const cert=JSON.parse(fs.readFileSync(new URL('../site/data/ademe-certification.json',import.meta.url),'utf8'));
  const raw=JSON.stringify(cert);
  assert.equal(cert.status,'PASS');
  assert.equal(cert.lock?.name,'ADEME');
  assert.equal(cert.lock?.version,13);
  assert.deepEqual(cert.configuredSources,['ademe']);
  assert.ok(cert.sourceConfigFingerprint);
  assert.ok(cert.certificationBasisFingerprint);
  assert.ok(cert.certifiedDataFingerprint);
  assert.equal(cert.problems?.length,0);
  assert.doesNotMatch(raw,/Exa|Tavily|Parallel|Firecrawl|TinyFish|OpenAI|Anthropic|Gemini|externalAudit|aides-entreprises|aides-territoires/i);
});
