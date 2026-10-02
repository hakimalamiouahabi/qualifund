import fs from 'node:fs';
import { buildCertificationLedger, isPublishableAid } from './lib/publication.mjs';

const cfg=JSON.parse(fs.readFileSync(new URL('../config/sources.json',import.meta.url),'utf8'));
const lib=JSON.parse(fs.readFileSync(new URL('../site/data/library.json',import.meta.url),'utf8'));
const cov=JSON.parse(fs.readFileSync(new URL('../site/data/coverage.json',import.meta.url),'utf8'));
const strategies={};for(const s of cfg.sources)strategies[s.strategy]=(strategies[s.strategy]||0)+1;
const controls=cfg.sources.filter(s=>s.strategy==='control-only');
const ingestive=cfg.sources.filter(s=>s.official&&s.strategy!=='control-only');
const suspiciousControls=controls.filter(s=>s.type==='api');
const ledger=await buildCertificationLedger(new URL('../site/data/',import.meta.url),cfg);
const configuredSourceIds=new Set(cfg.sources.map(s=>s.id));
const unlockedSourceIds=new Set(ledger.unlockedSourceIds||[]);
const raw=lib.aaps||[];
const published=raw.filter(a=>isPublishableAid(a,{configuredSourceIds,unlockedSourceIds}));
const covById=new Map((cov||[]).map(x=>[x.id,x]));
const currentLock=JSON.parse(fs.readFileSync(new URL('../config/collection-lock.json',import.meta.url),'utf8'));
const currentIds=new Set(currentLock.allowedSourceIds||[]);
const currentCoverage=(cov||[]).filter(x=>currentIds.has(x.id));
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
  currentCycleCoverage:currentCoverage.map(x=>({id:x.id,success:x.success,discovered:x.discovered,imported:x.imported})),
  configuredWithoutCoverage:ingestive.filter(s=>!covById.has(s.id)).map(s=>s.id),
  rawLibraryCount:raw.length,
  certifiedPublishedCount:published.length,
  quarantinedCount:raw.length-published.length,
  certifiedSources:[...unlockedSourceIds]
};
console.log(JSON.stringify(report,null,2));
