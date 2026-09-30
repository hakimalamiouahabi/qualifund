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

test('les pages France 2030 directes déjà documentées conservent l’opérateur Bpifrance',()=>{
  for(const id of [
    'bfc_france2030_innovation_direct',
    'bretagne_france2030_innovation_direct',
    'pdl_france2030_innovation_direct',
    'nouvelle_aquitaine_france2030_innovation',
    'nouvelle_aquitaine_france2030_filieres',
    'nouvelle_aquitaine_france2030_idemo'
  ]) assert.equal(cfg.sources.find(s=>s.id===id)?.operator,'Bpifrance',id);
});
