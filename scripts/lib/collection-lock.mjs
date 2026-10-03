import fs from 'node:fs/promises';
import path from 'node:path';

export async function loadCollectionLock(root){
  try{
    const raw=await fs.readFile(path.join(root,'config','collection-lock.json'),'utf8');
    return JSON.parse(raw);
  }catch{
    return {locked:false,mode:'ALL',name:'ALL',allowedSourceIds:[]};
  }
}

export function sourceCalibration(source){
  if(!source)return{calibrated:false,reason:'SOURCE_ABSENTE'};
  if(source.strategy==='control-only'||source.type==='control')return{calibrated:true,role:'CONTROL'};
  const minExpected=Number(source.minExpected);
  const minImported=Number(source.minImported);
  const minImportRatio=Number(source.minImportRatio);
  const calibrated=Number.isFinite(minExpected)&&minExpected>0
    && Number.isFinite(minImported)&&minImported>0
    && Number.isFinite(minImportRatio)&&minImportRatio>0&&minImportRatio<=1;
  return{
    calibrated,
    role:'INGESTION',
    minExpected:Number.isFinite(minExpected)?minExpected:null,
    minImported:Number.isFinite(minImported)?minImported:null,
    minImportRatio:Number.isFinite(minImportRatio)?minImportRatio:null,
    reason:calibrated?null:'SEUILS_DE_COMPLETUDE_NON_CALIBRES'
  };
}

export function validateCollectionLock(cfg,lock){
  if(!lock?.locked)return;
  if(!Array.isArray(lock.allowedSourceIds)||!lock.allowedSourceIds.length)throw new Error('Collection lock actif sans allowedSourceIds');
  const byId=new Map((cfg.sources||[]).map(s=>[s.id,s]));
  const missing=lock.allowedSourceIds.filter(id=>!byId.has(id));
  if(missing.length)throw new Error('Collection lock référence des sources absentes: '+missing.join(', '));
  const uncalibrated=lock.allowedSourceIds
    .map(id=>byId.get(id))
    .filter(s=>!sourceCalibration(s).calibrated)
    .map(s=>s.id);
  if(uncalibrated.length)throw new Error('SOURCE_NOT_CALIBRATED: calibrer minExpected, minImported et minImportRatio avant activation: '+uncalibrated.join(', '));
}

export function selectSources(cfg,lock){
  if(!lock?.locked)return cfg.sources||[];
  const allowed=new Set(lock.allowedSourceIds||[]);
  return (cfg.sources||[]).filter(s=>allowed.has(s.id));
}

export function selectedSourceSet(lock){
  return new Set(lock?.locked?(lock.allowedSourceIds||[]):[]);
}

export function aidIsSelected(aid,lock){
  if(!lock?.locked)return true;
  return selectedSourceSet(lock).has(aid?.sourceId);
}

export function lockSummary(lock){
  return lock?.locked
    ? {locked:true,mode:lock.mode||'GUICHET',name:lock.name||'?',allowedSourceIds:lock.allowedSourceIds||[],next:lock.next||null}
    : {locked:false,mode:'ALL',name:'ALL',allowedSourceIds:[]};
}
