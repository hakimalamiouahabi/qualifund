export function assessCollection(source,result={}){
  const isControl=source?.strategy==='control-only';
  const discovered=Number(result?.discovered||0);
  const imported=Array.isArray(result?.aids)?result.aids.length:Number(result?.imported||0);
  const suspiciousVolume=!isControl && source?.minExpected!=null && discovered<Number(source.minExpected);
  // Un scan d'ingestion vide n'est jamais assez probant pour invalider l'historique.
  // Une source de contrôle ne produit pas de fiches, mais son accessibilité technique
  // reste suivie séparément afin de ne jamais afficher un faux "OK".
  const emptyIngestion=!isControl && imported===0;
  const controlReachable=isControl ? result?.reachable!==false : true;
  const success=isControl ? controlReachable : (!suspiciousVolume && !emptyIngestion);
  const lifecycleSafe=success && !isControl && imported>0;
  const reasons=[];
  if(suspiciousVolume)reasons.push(`volume suspect (${discovered} < ${source.minExpected})`);
  if(emptyIngestion)reasons.push('scan d’ingestion vide');
  if(isControl&&!controlReachable)reasons.push('source de contrôle inaccessible lors du dernier cycle');
  return {isControl,discovered,imported,suspiciousVolume,emptyIngestion,success,lifecycleSafe,reasons};
}
