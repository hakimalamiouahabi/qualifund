import { fetchJson } from '../lib/http.mjs';
import { htmlToText, norm, safeUrl, uniq, detectDates, detectRates, detectCurrencyAmounts, normalizeCompanyCategories, normalizeAidTypes } from '../lib/utils.mjs';
import { inferThemes } from '../lib/concepts.mjs';

const aliases={
  title:['titre','title','nom','name','intitule','intitulé','libelle','libellé','nom du dispositif','dispositif'],
  objective:['objectif','objectif txt','objet','description','presentation','présentation','resume','résumé','chapo','chapô','introduction','entete','en-tête'],
  beneficiaries:['beneficiaires','bénéficiaires','public','public cible','beneficiary','destinataires','qui','publics','cibles'],
  expenses:['depenses eligibles','dépenses éligibles','operations eligibles','opérations éligibles','depenses','dépenses'],
  conditions:['conditions','criteres','critères','eligibilite','éligibilité','engagements du beneficiaire','engagements du bénéficiaire'],
  amount:['montant','financement','taux','plafond','aide','modalite','modalité','modalites','modalités'],
  aidType:['nature','type aide','type d aide','nature aide','instrument','nature de l aide','type de dispositif','type'],
  deadline:['date fin','date_fin','cloture','clôture','date cloture','date_cloture','deadline','echeance','échéance','date limite','date de fin'],
  url:['url descriptif','url_descriptif','url','lien','link','source','page','url de l aide','url de l\'aide']
};
function pick(row,names){const entries=Object.entries(row||{});for(const a of names){const na=norm(a);const hit=entries.find(([k])=>norm(k)===na||norm(k).includes(na));if(hit&&String(hit[1]??'').trim())return hit[1]}return null}
function openDataText(value=''){
  const raw=String(value??'');
  if(/<\/?[a-z][^>]*>/i.test(raw))return htmlToText(raw);
  return raw.replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
}

export function rowToOpenDataSoftAid(row,source,idx){
  const title=openDataText(pick(row,aliases.title)||'');if(!title)return null;
  const objective=openDataText(pick(row,aliases.objective)||''),benef=openDataText(pick(row,aliases.beneficiaries)||''),expenses=openDataText(pick(row,aliases.expenses)||''),conditions=openDataText(pick(row,aliases.conditions)||''),amount=openDataText(pick(row,aliases.amount)||''),aidTypeText=openDataText(pick(row,aliases.aidType)||''),deadlineRaw=String(pick(row,aliases.deadline)||'');
  const directRaw=pick(row,aliases.url),recordId=String(row?.recordid||row?.id||'').trim(),base=baseApi(source),idBase=source.datasetId||source.id;
  const recordApiUrl=recordId&&base.includes('/api/explore/v2.1')?`${base}/catalog/datasets/${encodeURIComponent(idBase)}/records/${encodeURIComponent(recordId)}`:null;
  const url=safeUrl(directRaw||recordApiUrl||source.webEvidenceUrl||source.url,source.url)||source.url;
  const all=[title,objective,benef,expenses,conditions,amount,aidTypeText].join(' ');let aidTypes=normalizeAidTypes(`${aidTypeText} ${amount} ${title}`);
  // Une ligne issue d'un jeu officiel explicitement consacré aux aides/AAP ne doit pas être perdue
  // uniquement parce que l'instrument n'est pas textuellement indiqué dans l'Open Data.
  // Elle reste alors en AUTRE et devra être qualifiée par l'enrichissement/QA.
  if(!aidTypes.length&&/appel\s+[aà]\s+projets?|\bAAP\b|appel\s+[aà]\s+manifestation|\bAMI\b/i.test(title)) aidTypes=['SUBVENTION'];
  if(!aidTypes.length)aidTypes=['AUTRE'];
  const cats=normalizeCompanyCategories(`${benef} ${all}`),dates=detectDates(deadlineRaw),d=dates.at(-1)||null,rates=detectRates(amount),amounts=detectCurrencyAmounts(amount);
  return {id:`${source.id}_ods_${recordId||idx}`,canonicalId:`${source.id}_ods_${recordId||idx}`,sourceId:source.id,sourceRecordId:recordId||String(idx),title,kind:/appel\s+[aà]\s+projets?|\bAAP\b|appel\s+[aà]\s+manifestation|\bAMI\b/i.test(`${title} ${aidTypeText}`)?'AAP / AMI':'AIDE',objective:objective||null,beneficiaries:benef||null,companyCategories:uniq(cats),themes:inferThemes(all),scope:source.scope==='France'?'NATIONAL':'REGIONAL',regions:source.scope==='France'?['Toutes les Régions']:[source.scope],aidTypes,aidRate:{min:rates.length?Math.min(...rates):null,max:rates.length?Math.max(...rates):null,raw:amount||null,byCompanySize:[]},aidAmount:{min:amounts.length?Math.min(...amounts):null,max:amounts.length?Math.max(...amounts):null,raw:amount||null,byCompanySize:[]},projectsExpected:[],eligibleExpenses:expenses||null,openingDate:null,closingDate:d,finalClosingDate:d,deadlines:d?[{date:d,type:'CLOTURE'}]:[],permanent:false,prerequisites:conditions||null,selectionCriteria:null,attentionPoints:[],cdcLinks:[],sourceLinks:[{label:`Open Data officiel — ${idBase}`,url}],regulationLinks:[],officialPage:url,funder:[source.name.replace(/ —.*/, '')],verification:{status:'A_REVERIFIER',sourceTier:'C',lastChecked:new Date().toISOString(),fieldEvidence:[{field:'objective',sourceUrl:url,sourceTier:'C',locator:`OpenDataSoft ${idBase}`,evidenceText:objective.slice(0,650),checkedAt:new Date().toISOString()}]}};
}

function baseApi(source){return String(source.api||source.url||'').replace(/\/+$/,'')}
async function discoverDatasetId(source){
  if(source.datasetId) return source.datasetId;
  const base=baseApi(source);if(!base.includes('/api/explore/v2.1')) return null;
  const {json}=await fetchJson(`${base}/catalog/datasets?limit=100`,{timeoutMs:30000,retries:2});
  const rows=json.results||json.datasets||[];const wanted=new RegExp(source.datasetInclude||'aides|appels|interventions','i');
  const hit=rows.find(d=>wanted.test(`${d.dataset_id||d.datasetid||''} ${d.metas?.default?.title||d.metas?.title||d.title||''} ${d.metas?.default?.description||d.description||''}`));
  return hit?.dataset_id||hit?.datasetid||hit?.id||null;
}

export async function collectOpenDataSoft(source,{log=console.log,maxRows=10000}={}){
  const base=baseApi(source),datasetId=await discoverDatasetId(source);if(!datasetId)throw new Error(`dataset OpenDataSoft introuvable pour ${source.id}`);
  const aids=[];let offset=0,total=0,rowsSeen=0;
  while(rowsSeen<maxRows){
    const u=`${base}/catalog/datasets/${encodeURIComponent(datasetId)}/records?limit=100&offset=${offset}`;
    const {json}=await fetchJson(u,{timeoutMs:30000,retries:2});const rows=json.results||json.records||[];total=Number(json.total_count||json.nhits||total||0);
    for(const rec of rows){const row=rec?.record?.fields||rec?.fields||rec;const a=rowToOpenDataSoftAid({...row,recordid:rec?.recordid||rec?.record?.id},source,rowsSeen);rowsSeen++;if(a)aids.push(a)}
    if(!rows.length||rows.length<100||(total&&rowsSeen>=total))break;offset+=rows.length;
  }
  log(`[${source.id}/OpenDataSoft] ${rowsSeen}${total?'/'+total:''} lignes, ${aids.length} fiches financières`);
  return {aids,discovered:total||rowsSeen,message:`OpenDataSoft ${datasetId}: ${rowsSeen} lignes, ${aids.length} fiches financières`};
}
