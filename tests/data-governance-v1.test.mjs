import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCertificationLedger, publicationReason, targetFunding } from '../scripts/lib/publication.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

test('la publication refuse une source non certifiée et un instrument hors périmètre',()=>{
  const base={
    id:'x',sourceId:'aura',title:'Aide à l’investissement',lifecycleStatus:'ACTIVE',
    officialPage:'https://www.auvergnerhonealpes.fr/aides/demo',
    aidTypes:['SUBVENTION']
  };
  const configured=new Set(['aura']);
  assert.equal(publicationReason(base,{configuredSourceIds:configured,unlockedSourceIds:new Set()}),'SOURCE_NOT_CERTIFIED');
  assert.equal(publicationReason({...base,aidTypes:['AUTRE']},{configuredSourceIds:configured,unlockedSourceIds:new Set(['aura'])}),'OUT_OF_TARGET_INSTRUMENT');
  assert.equal(publicationReason(base,{configuredSourceIds:configured,unlockedSourceIds:new Set(['aura'])}),null);
  assert.equal(targetFunding({...base,kind:'AAP / AMI',aidTypes:['AUTRE']}),true);
});

test('une archive ancienne n’est pas publiée mais une clôture J-60 peut l’être',()=>{
  const opts={configuredSourceIds:new Set(['s']),unlockedSourceIds:new Set(['s']),now:new Date('2026-10-03T00:00:00Z')};
  const base={id:'x',sourceId:'s',title:'Dispositif test',officialPage:'https://example.fr/aide/x',aidTypes:['SUBVENTION'],lifecycleStatus:'ARCHIVE'};
  assert.equal(publicationReason({...base,closingDate:'2026-06-01'},opts),'INACTIVE_OR_STALE');
  assert.equal(publicationReason({...base,closingDate:'2026-09-20'},opts),null);
});

test('le ledger ne déverrouille que les certificats PASS encore présents dans le registre',async()=>{
  const dir=await fsp.mkdtemp(path.join(os.tmpdir(),'qf-ledger-'));
  try{
    await fsp.writeFile(path.join(dir,'ademe-certification.json'),JSON.stringify({status:'PASS',generatedAt:'2026-10-01T00:00:00Z',lock:{name:'ADEME'},configuredSources:['ademe']}));
    await fsp.writeFile(path.join(dir,'aura-certification.json'),JSON.stringify({status:'FAIL',generatedAt:'2026-10-02T00:00:00Z',lock:{name:'Auvergne-Rhône-Alpes'},configuredSources:['aura']}));
    await fsp.writeFile(path.join(dir,'legacy-certification.json'),JSON.stringify({status:'PASS',generatedAt:'2026-10-01T00:00:00Z',lock:{name:'Legacy'},configuredSources:['removed']}));
    const ledger=await buildCertificationLedger(dir,{version:'x',sources:[{id:'ademe'},{id:'aura'}]});
    assert.deepEqual(ledger.unlockedSourceIds,['ademe']);
    assert.deepEqual(ledger.guichets,['ADEME']);
  }finally{await fsp.rm(dir,{recursive:true,force:true})}
});

test('l’interface déverrouille les guichets depuis le ledger et filtre le hors-périmètre',()=>{
  const app=fs.readFileSync(path.join(ROOT,'site/app.js'),'utf8');
  assert.match(app,/certification-ledger\.json/);
  assert.match(app,/applyCertificationLedger/);
  assert.match(app,/CERTIFIED_SOURCE_NAMES/);
  assert.match(app,/targetFundingAid/);
  assert.doesNotMatch(app,/const PUBLIC_UNLOCKED_SOURCE_IDS=new Set\(\['bpifrance_aap'/);
});

test('les artefacts lourds et audits historiques obsolètes ont disparu du dépôt',()=>{
  for(const p of [
    'site/data/bootstrap.js','site/data/library.previous.json',
    'SOURCE_LINK_AUDIT_v8.5.md','SOURCE_LINK_AUDIT_v9.3.md','SOURCE_ROLE_AUDIT_v11.1.2.md'
  ])assert.equal(fs.existsSync(path.join(ROOT,p)),false,p);
});

test('les audits d’ingestion n’utilisent plus les stratégies tierces historiques',()=>{
  for(const p of ['scripts/audit-ingestion.mjs','scripts/production-gates.mjs']){
    const src=fs.readFileSync(path.join(ROOT,p),'utf8');
    assert.doesNotMatch(src,/aides-entreprises|aides-territoires|data-gouv-query/);
  }
});
