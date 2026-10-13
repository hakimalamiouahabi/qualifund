import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const filename = new URL('../preview/Funding_Pro_Atelier.html', import.meta.url);
const page = fs.readFileSync(filename, 'utf8');
test('interface de financement présente et sans dépendances externes', () => {
  assert.match(page, /<!DOCTYPE html>/i);
  assert.match(page, /lang="fr"/);
  for (const id of ['company','siren','issuer','instrument','scheme','url','project','expenses','contributions','requested','warnings','copyPrompt','exportMd','exportJson','import']) {
    assert.ok(page.includes('id="'+id+'"'), id+' absent');
  }
  assert.doesNotMatch(page, /<script\b[^>]*\bsrc\s*=/i);
  assert.doesNotMatch(page, /<link\b[^>]*\bhref\s*=\s*["']https?:\/\//i);
});
test('le script client compile sans appels réseau ni persistance automatique', () => {
  const match=page.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(match,'script local manquant');
  new vm.Script(match[1]);
  assert.doesNotMatch(match[1], /\b(fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage)\s*[.(]/);
  assert.match(match[1], /non vérifié|NON CERTIFIÉ|NON CERTIFIÉ/i);
  assert.match(match[1], /navigator\.clipboard\.writeText/);
});
