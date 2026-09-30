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

export function validateCollectionLock(cfg,lock){
  if(!lock?.locked)return;
  if(!Array.isArray(lock.allowedSourceIds)||!lock.allowedSourceIds.length)throw new Error('Collection lock actif sans allowedSourceIds');
  const ids=new Set((cfg.sources||[]).map(s=>s.id));
  const missing=lock.allowedSourceIds.filter(id=>!ids.has(id));
  if(missing.length)throw new Error('Collection lock référence des sources absentes: '+missing.join(', '));
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
