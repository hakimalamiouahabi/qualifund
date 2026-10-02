import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadCertifiedSources, writeCertifiedSourcesArtifact, aidIsCertified } from '../scripts/lib/certified-sources.mjs';

async function fixture(){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'funding-radar-cert-'));
  await fs.mkdir(path.join(root,'site','data'),{recursive:true});
  const cfg={sources:[{id:'bpifrance_aap'},{id:'ademe'},{id:'aura'}]};
  await fs.writeFile(path.join(root,'site','data','bpifrance-certification.json'),JSON.stringify({
    status:'PASS',generatedAt:'2026-10-01T00:00:00Z',
    lock:{name:'Bpifrance',allowedSourceIds:['bpifrance_aap']}
  }));
  await fs.writeFile(path.join(root,'site','data','active-source-certification.json'),JSON.stringify({
    status:'PASS',generatedAt:'2026-10-01T00:00:00Z',
    lock:{name:'Bpifrance',allowedSourceIds:['bpifrance_aap']}
  }));
  await fs.writeFile(path.join(root,'site','data','ademe-certification.json'),JSON.stringify({
    status:'FAIL',lock:{name:'ADEME',allowedSourceIds:['ademe']}
  }));
  await fs.writeFile(path.join(root,'site','data','legacy-certification.json'),JSON.stringify({
    status:'PASS',lock:{name:'Legacy',allowedSourceIds:['source_supprimee']}
  }));
  return{root,cfg};
}

test('le registre public ne retient que les cycles PASS encore configurés',async()=>{
  const {root,cfg}=await fixture();
  const state=await loadCertifiedSources(root,cfg);
  assert.deepEqual([...state.ids],['bpifrance_aap']);
  assert.deepEqual([...state.guichets],['Bpifrance']);
  assert.equal(state.certificates.length,1);
  assert.equal(aidIsCertified({sourceId:'bpifrance_aap'},state.ids),true);
  assert.equal(aidIsCertified({sourceId:'ademe'},state.ids),false);
  await fs.rm(root,{recursive:true,force:true});
});

test('l’artefact certified-sources est généré sans doublon active/spécifique',async()=>{
  const {root,cfg}=await fixture();
  const out=await writeCertifiedSourcesArtifact(root,cfg);
  assert.deepEqual(out.sourceIds,['bpifrance_aap']);
  assert.deepEqual(out.guichets,['Bpifrance']);
  assert.equal(out.certificates.length,1);
  const saved=JSON.parse(await fs.readFile(path.join(root,'site','data','certified-sources.json'),'utf8'));
  assert.deepEqual(saved.sourceIds,['bpifrance_aap']);
  await fs.rm(root,{recursive:true,force:true});
});
