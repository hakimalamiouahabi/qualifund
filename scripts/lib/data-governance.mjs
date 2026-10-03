export const TARGET_AID_TYPES=new Set([
  'SUBVENTION','AVANCE_REMBOURSABLE','PRET_TAUX_ZERO','APPEL_A_PROJET'
]);

export function isControlSource(source){
  return source?.strategy==='control-only'||source?.type==='control';
}

export function isIngestiveSource(source){
  return Boolean(source)&&!isControlSource(source);
}

export function selectedSources(cfg={},lock={}){
  const sources=Array.isArray(cfg.sources)?cfg.sources:[];
  const allowed=new Set(Array.isArray(lock?.allowedSourceIds)?lock.allowedSourceIds:[]);
  if(lock?.locked&&allowed.size)return sources.filter(s=>allowed.has(s.id));
  return sources.filter(isIngestiveSource);
}

export function selectedSourceIds(cfg={},lock={}){
  return new Set(selectedSources(cfg,lock).map(s=>s.id));
}

export function isTargetFunding(aid){
  if(!aid)return false;
  if(aid.kind==='AAP / AMI')return true;
  const types=Array.isArray(aid.aidTypes)?aid.aidTypes:[];
  return types.some(t=>TARGET_AID_TYPES.has(t));
}

export function isPublicationCandidate(aid){
  if(!aid||!isTargetFunding(aid))return false;
  const life=String(aid.lifecycleStatus||'ACTIVE').toUpperCase();
  return !['STALE','CLOSED','CLOS','EXPIRED'].includes(life);
}

export function isActiveRecord(aid){
  return String(aid?.lifecycleStatus||'').toUpperCase()==='ACTIVE';
}

export function isScopedRecord(aid,sourceIds){
  return sourceIds instanceof Set&&sourceIds.size?sourceIds.has(aid?.sourceId):true;
}

export function normalizeOfficialUrl(raw=''){
  try{
    const u=new URL(raw);
    u.hash='';
    for(const k of [...u.searchParams.keys()])if(/^utm_|^pk_|^fbclid$/i.test(k))u.searchParams.delete(k);
    u.pathname=u.pathname.replace(/\/+$/,'')||'/';
    return u.href.replace(/\/$/,'');
  }catch{return ''}
}
