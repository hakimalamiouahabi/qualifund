import { collectWebCatalog } from './web-catalog.mjs';
import { collectDataGouv } from './data-gouv.mjs';
import { collectOpenDataSoft } from './opendatasoft.mjs';

export async function collectRegionHybrid(source,ctx={}){
  const all=[];const messages=[];let discovered=0;
  try{
    const d=String(source.api||'').includes('/api/explore/v2.1/')
      ? await collectOpenDataSoft(source,ctx)
      : await collectDataGouv({...source,query:`${source.name} aides appels projets entreprises`},ctx);
    all.push(...d.aids);discovered+=d.discovered;messages.push(`OpenData ${d.aids.length}`);
  }catch(e){messages.push('OpenData indisponible: '+e.message)}
  try{const w=await collectWebCatalog({...source,browserFallback:true},{...ctx,maxItems:160});all.push(...w.aids);discovered+=w.discovered;messages.push('Web '+w.aids.length)}catch(e){messages.push('Web indisponible: '+e.message)}
  return{aids:all,discovered,message:messages.join(' • ')};
}
