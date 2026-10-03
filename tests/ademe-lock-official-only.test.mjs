import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('le verrou ADEME v13 certifié reste strictement official-only et publication-ready',()=>{
  const lock=JSON.parse(fs.readFileSync(new URL('../config/collection-lock.json',import.meta.url),'utf8'));
  const raw=JSON.stringify(lock);
  assert.equal(lock.name,'ADEME');
  assert.equal(lock.version,13);
  assert.deepEqual(lock.allowedSourceIds,['ademe']);
  assert.equal(lock.next,'AURA');
  assert.equal(lock.certification?.requirePublicationReady,true);
  assert.equal(lock.certification?.sourceRules?.ademe?.requireMasterMembership,true);
  assert.deepEqual(lock.certification?.allowedHosts,['agirpourlatransition.ademe.fr']);
  assert.doesNotMatch(raw,/Exa|Tavily|Parallel|Firecrawl|TinyFish|OpenAI|Anthropic|Gemini|externalAudit|aides-entreprises|aides-territoires/i);
  assert.match(lock.notes,/1er et le 15/);
});
