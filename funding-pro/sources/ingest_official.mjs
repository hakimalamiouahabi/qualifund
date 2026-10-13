/**
 * Funding Pro — collecte de références publiques seulement.
 * Ne certifie ni appel ouvert, ni taux, ni eligibilite.
 * Sans API IA, cle secrete, modification Cloudflare ou dossier client.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY = path.join(ROOT, 'registry.json');
const ALLOWED_SOURCE_IDS = new Set(['datagouv','ademe_data','aides_territoires']);
const now = () => new Date().toISOString();
function httpsUrl(raw) {
  if (typeof raw !== 'string') return null;
  try { const u=new URL(raw); return u.protocol==='https:' ? u.href : null; } catch { return null; }
}
function excerpt(s, max=230) { return typeof s==='string'?s.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,max):''; }
function entry(source_id, external_id, title, url, category, extra={}) {
  if(!external_id || !title || !httpsUrl(url)) return null;
  return { source_id, external_id:String(external_id), title:excerpt(title,190), url:httpsUrl(url),
    category, instrument:'NON_DETERMINE', status:'A_VERIFIER', eligibility:'NON_ETABLIE',
    eligible_spending:null, funding_rate:null, funding_cap:null, deadline:null,
    updated_at:extra.updated_at||null, issuer:extra.issuer||null, territory:extra.territory||null,
    description:excerpt(extra.description||''), documents:extra.documents||[], provenance:extra.provenance||'CATALOGUE_NON_CERTIFIANT' };
}
export function normalizeDataGouv(payload) {
  const items=Array.isArray(payload?.data)?payload.data:[];
  return items.map(d=> {
    const docs=(d.resources||[]).filter(r=>/^(pdf|docx?|xlsx?|odt|ods)$/i.test(r.format||'') && httpsUrl(r.url))
      .slice(0,12).map(r=>({title:excerpt(r.title)||'Document public',url:httpsUrl(r.url),format:(r.format||'').toLowerCase(),review:'A_VERIFIER'}));
    return entry('datagouv',d.id,d.title,d.page,'JEU_DE_DONNEES',{
      updated_at:d.last_update,issuer:d.organization?.name,
      description:d.description_short||d.description,documents:docs,
      provenance:'METADONNEES_DATA_GOUV_NON_PREUVE_AIDE'});
  }).filter(Boolean);
}
export function normalizeAdeme(payload) {
  const items=Array.isArray(payload?.results)?payload.results:Array.isArray(payload?.data)?payload.data:
    Array.isArray(payload)?payload:[];
  return items.map(d=>entry('ademe_data',d.id,d.title||d.name,d.href||d.url||('https://data.ademe.fr/datasets/'+encodeURIComponent(d.id||'')),
    'JEU_DE_DONNEES',{updated_at:d.updatedAt||d.updated_at,description:d.description,
    issuer:'ADEME',provenance:'CATALOGUE_DATA_ADEME_NON_PREUVE_APPEL_OUVERT'})).filter(Boolean);
}
export function normalizeAidesTerritoires(payload) {
  const items=Array.isArray(payload?.results)?payload.results:Array.isArray(payload?.['hydra:member'])?payload['hydra:member']:[];
  return items.map(d=>{
    const raw=typeof d.url==='string'?d.url:'';
    const url=raw.startsWith('/aides/')?'https://aides-territoires.beta.gouv.fr'+raw:
      (httpsUrl(raw)?.startsWith('https://aides-territoires.beta.gouv.fr/')?raw:null);
    // Type exact et statut restent inconnus sans validation de l'autorite emettrice.
    return entry('aides_territoires',d.id||d.slug,d.name||d.title,url,'AIDE_A_QUALIFIER',{
      description:d.description||d.description_short,issuer:typeof d.backer==='string'?d.backer:null,
      provenance:'FICHE_AGREGATEUR_OFFICIEL_A_VALIDER_CHEZ_FINANCEUR'});
  }).filter(Boolean);
}
export function staticReferences(registry) {
  const refs=[];
  for(const s of registry.sources.filter(x=>x.kind==='official_portal')){
    const e=entry(s.id,'portail',s.name,s.base_url,'PORTAIL_OFFICIEL',{
      description:s.note,provenance:'PORTE_ENTREE_OFFICIELLE_NON_CANDIDATURE'});
    if(e) refs.push(e);
  }
  for(const d of registry.document_references){
    const isPdf=/\.pdf(?:[?#]|$)/i.test(d.url);
    const e=entry(d.source_id,'reference:'+d.url,d.title,d.url,
      isPdf?'DOCUMENT_PDF_OFFICIEL':'DOCUMENT_SOURCE_OFFICIELLE',{
      description:d.note,provenance:'DOCUMENT_REFERENCEMENT_LIEN_SEULEMENT',
      documents:isPdf?[{title:d.title,url:d.url,format:'pdf',review:'A_VERIFIER'}]:[]});
    if(e)refs.push(e);
  }
  return refs;
}
function sourceUrl(registry,id) {
  const s=registry.sources.find(x=>x.id===id);
  if(!s || !ALLOWED_SOURCE_IDS.has(id))throw Error('Source inconnue ou desactivee : '+id);
  const u=new URL(s.base_url);
  if(u.protocol!=='https:'||!['www.data.gouv.fr','data.ademe.fr','aides-territoires.beta.gouv.fr'].includes(u.hostname))
    throw Error('Hote hors liste blanche');
  return u;
}
async function download(url,fetcher) {
  const r=await fetcher(url.toString(),{
    headers:{Accept:'application/json','User-Agent':'FundingProOfficialMetadata/0.2 (+GitHub read-only prototype)'},
    redirect:'error',signal:AbortSignal.timeout(15000)
  });
  if(!r.ok)throw Error('HTTP '+r.status);
  const ct=r.headers?.get?.('content-type')||'application/json';
  if(!ct.toLowerCase().includes('json'))throw Error('Content-type JSON attendu');
  return await r.json();
}
export async function collectLive(registry,{fetcher=fetch,maxPerQuery=5,includeAT=false}={}) {
  const records=staticReferences(registry), source_runs=[], at=now();
  const push=(id,q,recordsFound)=>source_runs.push({source:id,query:q,status:'OK',count:recordsFound.length});
  const fail=(id,q,error)=>source_runs.push({source:id,query:q,status:'ERREUR',error:excerpt(error.message,180),count:0});
  for(const q of (registry.sources.find(s=>s.id==='datagouv')?.queries||[]).slice(0,6)){
    try {const u=sourceUrl(registry,'datagouv');u.searchParams.set('q',q);u.searchParams.set('page_size',String(maxPerQuery));
      const r=normalizeDataGouv(await download(u,fetcher));records.push(...r);push('datagouv',q,r);
    } catch(error){ fail('datagouv',q,error); }
  }
  try {const u=sourceUrl(registry,'ademe_data');u.searchParams.set('size',String(maxPerQuery));
    const r=normalizeAdeme(await download(u,fetcher)); records.push(...r);push('ademe_data','catalogue',r);
  }catch(error){fail('ademe_data','catalogue',error);}
  if(includeAT) {
    try {const u=sourceUrl(registry,'aides_territoires');u.searchParams.set('page','1');
      const r=normalizeAidesTerritoires(await download(u,fetcher));records.push(...r.slice(0,Math.min(maxPerQuery,20)));
      push('aides_territoires','page 1',r.slice(0,Math.min(maxPerQuery,20)));
    }catch(error){fail('aides_territoires','page 1',error);}
  } else source_runs.push({source:'aides_territoires',status:'NON_TESTE',count:0,note:'Activer explicitement --include-at, compatibilite et nature financiere non verifiees'});
  return {schema_version:1,generated_at:at,collection_mode:'LIVE_METADATA_AND_REFERENCES',
    notice:'Ni eligibilite, ni taux, ni disponibilite verifies. Verification humaine sur la page du financeur obligatoire.',
    runs:source_runs,records:unique(records)};
}
function unique(arr) {const m=new Map();for(const r of arr) if(r)m.set(r.source_id+'|'+r.external_id,r);return [...m.values()];}
export function collectOffline(registry) {
  return {schema_version:1,generated_at:now(),collection_mode:'OFFLINE_REFERENCES_ONLY',
    notice:'Aucune API distante interrogee, portails officiels et documents references uniquement.',
    runs:[],records:unique(staticReferences(registry))};
}
function parse(args) {
  const out={mode:'offline',out:null,includeAT:false,max:5};
  for(let i=0;i<args.length;i++){const a=args[i];
    if(a==='--live')out.mode='live';
    else if(a==='--offline')out.mode='offline';
    else if(a==='--include-at')out.includeAT=true;
    else if(a==='--out')out.out=args[++i];
    else if(a==='--max')out.max=Number(args[++i]);
    else throw Error('Argument inconnu : '+a);
  }
  if(!Number.isInteger(out.max)||out.max<1||out.max>20)throw Error('--max doit etre compris entre 1 et 20');
  if(!out.out)throw Error('Chemin --out requis');
  if(out.includeAT && out.mode!=='live')throw Error('--include-at requiert --live');
  return out;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try {
    const a=parse(process.argv.slice(2)),registry=JSON.parse(fs.readFileSync(REGISTRY,'utf8'));
    const result=a.mode==='live'?await collectLive(registry,{maxPerQuery:a.max,includeAT:a.includeAT}):collectOffline(registry);
    fs.mkdirSync(path.dirname(path.resolve(a.out)),{recursive:true});
    fs.writeFileSync(a.out,JSON.stringify(result,null,2)+'\n','utf8');
    console.log(JSON.stringify({mode:result.collection_mode,records:result.records.length,runs:result.runs},null,2));
    if(a.mode==='live'&&!result.runs.some(r=>r.status==='OK'))process.exitCode=2;
  }catch(error){console.error('Collecte impossible : '+error.message);process.exitCode=1;}
}
