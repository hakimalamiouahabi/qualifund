export function assessCollection(source,result={}){
  const isControl=source?.strategy==='control-only';
  const discovered=Number(result?.discovered||0);
  const imported=Array.isArray(result?.aids)?result.aids.length:Number(result?.imported||0);
  const suspiciousVolume=source?.minExpected!=null && discovered<Number(source.minExpected);
  // Un scan d'ingestion vide n'est jamais assez probant pour invalider l'historique.
  // Les contrôles seuls peuvent légitimement ne produire aucune fiche importable.
  const emptyIngestion=!isControl && imported===0;
  const success=!suspiciousVolume && !emptyIngestion;
  const lifecycleSafe=success && !isControl && imported>0;
  const reasons=[];
  if(suspiciousVolume)reasons.push(`volume suspect (${discovered} < ${source.minExpected})`);
  if(emptyIngestion)reasons.push('scan d’ingestion vide');
  return {isControl,discovered,imported,suspiciousVolume,emptyIngestion,success,lifecycleSafe,reasons};
}
