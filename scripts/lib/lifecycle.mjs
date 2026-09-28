const arr=v=>Array.isArray(v)?v:(v==null?[]:[v]);

export function sourceOwnsAid(aid,sourceId){
  if(!aid||!sourceId)return false;
  return aid.sourceId===sourceId || arr(aid.sourceAliases).includes(sourceId);
}

export function shouldMarkStale({aid,sourceId,key,seenBySource,seenInCycle,existedBefore}){
  return Boolean(
    existedBefore &&
    sourceOwnsAid(aid,sourceId) &&
    !seenBySource?.has?.(key) &&
    !seenInCycle?.has?.(key)
  );
}
