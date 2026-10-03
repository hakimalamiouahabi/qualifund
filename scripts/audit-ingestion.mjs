import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCertificationLedger, isPublishableAid } from './lib/publication.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DATA=path.join(ROOT,'site','data');
const cfg=JSON.parse(fs.readFileSync(path.join(ROOT,'config','sources.json'),'utf8'));
const lib=JSON.parse(fs.readFileSync(path.join(DATA,'library.json'),'utf8'));
const cov=JSON.parse(fs.readFileSync(path.join(DATA,'coverage.json'),'utf8'));
const strategies={};for(const s of cfg.sources)strategies[s.strategy]=(strategies[s.strategy]||0)+1;
const controls=cfg.sources.filter(s=>s.strategy==='control-only');
const ingestive=cfg.sources.filter(s=>s.official&&s.strategy!=='control-only');
const suspiciousControls=controls.filter(s=>s.type==='api');
const ledger=await buildCertificationLedger(DATA,cfg);
const configuredSourceIds=new Set(cfg.sources.map(s=>s.id));
const unlockedSourceIds=new Set(ledger.unlockedSourceIds||[]);
const raw=lib.aaps||[];
const published=raw.filter(a=>isPublishableAid(a,{configuredSourceIds,unlockedSourceIds}));
const covById=new Map((cov||[]).map(x=>[x.id,x]));
const currentLock=JSON.parse(fs.readFileSync(path.join(ROOT,'config','collection-lock.json'),'utf8'));
const currentIds=new Set(currentLock.allowedSourceIds||[]);
const currentCycleId=lib.meta?.collectionCycleId||null;
const generatedAtMs=Date.parse(lib.meta?.generatedAt||'');
const fresh=x=>{
  if(currentCycleId&&x?.cycleId)return String(x.cycleId)===String(currentCycleId);
  const checked=Date.parse(x?.checkedAt||'');
  return Number.isFinite(checked)&&Number.isFinite(generatedAtMs)&&Math.abs(generatedAtMs-checked)<=6*3600*1000;
};
const currentCoverage=(cov||[]).filter(x=>currentIds.has(x.id));
const freshCurrentCoverage=currentCoverage.filter(fresh);
const report={
  version:cfg.version,
  policy:'DIRECT_OFFICIAL_ONLY',
  sourcesConfigured:cfg.sources.length,
  strategies,
  ingestiveSources:ingestive.length,
  controlOnlySources:controls.length,
  apiStillControlOnly:suspiciousControls.map(s=>s.id),
  lastCycleSources:cov.length,
  lastCycleSuccess:cov.filter(x=>x.success).length,
  currentLock:{name:currentLock.name||null,mode:currentLock.mode||null,sourceIds:[...currentIds]},
  collectionCycleId:currentCycleId,
  currentCycleCoverage:currentCoverage.map(x=>({id:x.id,success:x.success,discovered:x.discovered,imported:x.imported,cycleId:x.cycleId||null,checkedAt:x.checkedAt||null,fresh:fresh(x)})),
  freshCurrentCoverageCount:freshCurrentCoverage.length,
  configuredWithoutCoverage:ingestive.filter(s=>!covById.has(s.id)).map(s=>s.id),
  rawLibraryCount:raw.length,
  certifiedPublishedCount:published.length,
  quarantinedCount:raw.length-published.length,
  certifiedSources:[...unlockedSourceIds]
};
console.log(JSON.stringify(report,null,2));
