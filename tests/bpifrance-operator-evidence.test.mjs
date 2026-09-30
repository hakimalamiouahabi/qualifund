import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { extractFromHtml } from '../scripts/lib/extract.mjs';
import { isDirectAid } from '../scripts/lib/direct-sources.mjs';

const cfg=JSON.parse(fs.readFileSync(new URL('../config/sources.json',import.meta.url),'utf8'));

test('une preuve explicite opéré par Bpifrance produit un opérateur Bpifrance',()=>{
  const html='<main><h1>Projet innovation</h1><p>Ce dispositif est financé par l’État et la Région et mis en œuvre par Bpifrance, opérateur de ce volet.</p></main>';
  const a=extractFromHtml(html,{url:'https://region.example.fr/aide',scope:'REGIONAL',region:'Bretagne'});
  assert.equal(a.operator,'Bpifrance');
  assert.ok(a.verification.fieldEvidence.some(e=>e.field==='operator'&&e.evidenceText.includes('Bpifrance')));
});

test('une simple mention de Bpifrance ne crée pas un opérateur',()=>{
  const html='<main><h1>Aide régionale</h1><p>Le projet peut être cofinancé par la Région, le FEDER ou Bpifrance.</p></main>';
  const a=extractFromHtml(html,{url:'https://region.example.fr/aide',scope:'REGIONAL',region:'Bretagne'});
  assert.equal(a.operator,null);
  assert.ok(!a.verification.fieldEvidence.some(e=>e.field==='operator'));
});

test('Rebond Industriel est une source Bpifrance directe admissible',()=>{
  const source=cfg.sources.find(s=>s.id==='bpifrance_rebond_industriel');
  assert.ok(source);
  assert.equal(source.operator,'Bpifrance');
  const aid={id:'bpifrance_rebond_industriel_official',sourceId:source.id,officialPage:source.url};
  assert.equal(isDirectAid(aid,cfg),true);
});

test('les dispositifs régionaux France 2030 ne sont pas assimilés au verrou national Bpifrance',()=>{
  const lock=JSON.parse(fs.readFileSync(new URL('../config/collection-lock.json',import.meta.url),'utf8'));
  assert.ok(!lock.allowedSourceIds.includes('bpifrance_projets_international'));
  assert.ok(!cfg.sources.some(s=>s.id==='bpifrance_projets_international'));
});
