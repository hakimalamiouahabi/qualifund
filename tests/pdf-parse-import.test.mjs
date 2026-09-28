import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('PDF extraction bypasses pdf-parse demo entrypoint', () => {
  const src = fs.readFileSync(new URL('../scripts/lib/extract.mjs', import.meta.url), 'utf8');
  assert.match(src, /pdf-parse\/lib\/pdf-parse\.js/);
  assert.doesNotMatch(src, /from\s+['"]pdf-parse['"]/);
});
