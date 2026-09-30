import { fetchText } from '../lib/http.mjs';
import { browserHtml } from '../lib/browser.mjs';
import { extractFromHtml } from '../lib/extract.mjs';
import { uniq } from '../lib/utils.mjs';

async function getHtml(source){
  try{return (await fetchText(source.url,{timeoutMs:30000,retries:2})).text}
  catch(e){if(source.browserFallback!==false)return (await browserHtml(source.url,{timeoutMs:45000})).html;throw e}
}

export async function collectOfficialPage(source,{log=console.log}={}){
  const html=await getHtml(source);
  const scope=source.scope==='France'?'NATIONAL':'REGIONAL';
  const rec=extractFromHtml(html,{url:source.url,sourceTier:'B',scope,region:scope==='REGIONAL'?source.scope:null});
  if(source.titleOverride)rec.title=source.titleOverride;
  if(source.forceAidType)rec.aidTypes=uniq([...(rec.aidTypes||[]),source.forceAidType]);
  if(source.forceCompanyCategories)rec.companyCategories=uniq([...(rec.companyCategories||[]),...source.forceCompanyCategories]);
  if(source.operator)rec.operator=source.operator;
  rec.id=`${source.id}_official`;
  rec.canonicalId=rec.id;
  rec.sourceId=source.id;
  rec.sourceRecordId='official';
  rec.kind=source.kindOverride||rec.kind||'AIDE';
  rec.funder=uniq([source.funder||source.name.replace(/ —.*/,''),...(rec.funder||[])]);
  rec.officialPage=source.url;
  rec.sourceLinks=uniq([source.url,...(rec.sourceLinks||[]).map(x=>x?.url).filter(Boolean)]).map((url,i)=>({label:i?'Source officielle complémentaire':'Page officielle',url}));
  rec.verification={...(rec.verification||{}),sourceTier:'B',lastChecked:new Date().toISOString()};
  log(`[${source.id}/official-page] 1 page officielle -> ${rec.aidTypes?.join(', ')||'type non détecté'}`);
  return {aids:[rec],discovered:1,message:`Page officielle analysée: ${rec.title}`};
}
