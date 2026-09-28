import { fetchJson } from '../lib/http.mjs';
import { fromAidesEntreprises } from '../lib/records.mjs';

const DEFAULT_STOCK_URL='https://data.aides-entreprises.fr/files/aides.json';

function rowsFromStock(json){
  if(Array.isArray(json)) return json;
  if(Array.isArray(json?.data)) return json.data;
  if(Array.isArray(json?.results)) return json.results;
  if(Array.isArray(json?.aides)) return json.aides;
  return [];
}

async function collectFromStock(source,{log=console.log}={}){
  const stockUrl=source.stockUrl||DEFAULT_STOCK_URL;
  const {json}=await fetchJson(stockUrl,{timeoutMs:Number(source.stockTimeoutMs||120000),retries:2});
  const rows=rowsFromStock(json),out=[];
  for(const raw of rows){
    if(Number(raw?.status??1)!==1) continue;
    const a=fromAidesEntreprises(raw);
    if(a) out.push(a);
  }
  log(`[Aides Entreprises/stock] ${rows.length} enregistrements lus, ${out.length} fiches Qualifund avant filtre thématique`);
  return {aids:out,discovered:rows.length,message:`Stock officiel complet: ${rows.length} enregistrements lus, ${out.length} fiches Qualifund`};
}

async function collectFromApi(source,{log=console.log}={}){
  const out=[];let offset=0;const limit=500;let total=0;
  while(true){
    const u=new URL(source.url);u.searchParams.set('status','1');u.searchParams.set('clean_html','true');u.searchParams.set('show_indexation','true');u.searchParams.set('limit',String(limit));u.searchParams.set('offset',String(offset));u.searchParams.set('order','id_aid');u.searchParams.set('by','asc');
    const {json}=await fetchJson(u.href,{timeoutMs:30000,retries:3});const batch=Array.isArray(json)?json:(json.data||[]);total=Number(json?.meta?.total||0);for(const raw of batch){const a=fromAidesEntreprises(raw);if(a)out.push(a)}
    log(`[Aides Entreprises/API] ${offset+batch.length}${total?'/'+total:''} lus, ${out.length} Qualifund`);if(!batch.length||batch.length<limit||(total&&offset+batch.length>=total))break;offset+=limit;if(offset>25000)break;
  }
  return {aids:out,discovered:total||out.length,message:`API REST: ${total||out.length} enregistrements lus, ${out.length} fiches Qualifund`};
}

export async function collectAidesEntreprises(source,ctx={}){
  // Le stock JSON public est la voie primaire et complète. L'API REST officielle
  // nécessite une authentification : elle ne doit jamais être tentée implicitement.
  try{return await collectFromStock(source,ctx)}
  catch(e){
    throw new Error(`Stock officiel Aides Entreprises indisponible: ${e.message}. API REST non utilisée automatiquement (authentification requise).`);
  }
}

export { rowsFromStock };
