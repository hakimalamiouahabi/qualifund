export function assessCollection(source,result={}){
  const isControl=source?.strategy==='control-only';
  const discovered=Number(result?.discovered||0);
  const imported=Array.isArray(result?.aids)?result.aids.length:Number(result?.imported||0);
  const importRatio=discovered>0?imported/discovered:(imported>0?1:0);
  const suspiciousVolume=!isControl && source?.minExpected!=null && discovered<Number(source.minExpected);
  const lowImportedCount=!isControl && source?.minImported!=null && imported<Number(source.minImported);
  const lowImportRatio=!isControl && source?.minImportRatio!=null && discovered>0 && importRatio<Number(source.minImportRatio);
  // Un scan d'ingestion vide ou très incomplet n'est jamais assez probant pour invalider l'historique.
  // Une source de contrôle ne produit pas de fiches, mais son accessibilité technique
  // reste suivie séparément afin de ne jamais afficher un faux "OK".
  const emptyIngestion=!isControl && imported===0;
  const controlReachable=isControl ? result?.reachable!==false : true;
  const success=isControl
    ? controlReachable
    : (!suspiciousVolume && !emptyIngestion && !lowImportedCount && !lowImportRatio);
  const lifecycleSafe=success && !isControl && imported>0;
  const reasons=[];
  if(suspiciousVolume)reasons.push(`volume découvert suspect (${discovered} < ${source.minExpected})`);
  if(lowImportedCount)reasons.push(`volume importé suspect (${imported} < ${source.minImported})`);
  if(lowImportRatio)reasons.push(`rendement d'extraction suspect (${imported}/${discovered} = ${(importRatio*100).toFixed(1)} % < ${(Number(source.minImportRatio)*100).toFixed(1)} %)`);
  if(emptyIngestion)reasons.push('scan d’ingestion vide');
  if(isControl&&!controlReachable)reasons.push('source de contrôle inaccessible lors du dernier cycle');
  return {isControl,discovered,imported,importRatio,suspiciousVolume,lowImportedCount,lowImportRatio,emptyIngestion,success,lifecycleSafe,reasons};
}
