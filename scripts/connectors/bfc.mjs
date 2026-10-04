import * as cheerio from 'cheerio';
import { fetchText } from '../lib/http.mjs';
import { extractFromHtml } from '../lib/extract.mjs';
import { directPageId } from '../lib/direct-sources.mjs';
import { canonicalUrl, cleanTitle, detectDates, norm, normalizeAidTypes, uniq } from '../lib/utils.mjs';

const REGION='Bourgogne-Franche-Comté';
const GUICHET='Bourgogne-Franche-Comté';
const PRIVATE_FILTER='87';
const EUROPEAN_RX=/\b(?:FEADER|FEDER(?:-FSE)?|FSE\+?|FTJ|LEADER|INTERREG|PEI)\b/i;
const AAP_RX=/\b(?:appel(?:s)? à projets?|appel(?:s)? a projets?|appel(?:s)? à manifestation d['’]?intérêt|appel(?:s)? a manifestation d['’]?interet|\bAMI\b)\b/i;
const OUT_SCOPE_RX=/\b(?:garantie de pr[eê]t|garantie bancaire|fonds propres|quasi[- ]fonds propres|augmentation de capital|prise de participation|capital-investissement|pr[eê]t classique|cr[eé]dit[- ]bail)\b/i;
const ENTERPRISE_RX=/\b(?:entreprise(?:s)?|pme|tpe|eti|start[- ]?up|micro[- ]?entreprise|artisan(?:s)?|commerçant(?:s)?|exploitant(?:e)?s? agricole(?:s)?|société(?:s)? commerciale(?:s)?|scop|scic)\b/i;
const NON_ENTERPRISE_RX=/\b(?:association(?:s)?|collectivité(?:s)?|commune(?:s)?|epci|établissement(?:s)? public(?:s)?|organisme(?:s)? public(?:s)?)\b/i;

async function getHtml(url){
  const r=await fetchText(url,{timeoutMs:12000,retries:1,headers:{
    'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36',
    'accept-language':'fr-FR,fr;q=0.9'
  }});
  return{html:r.text,finalUrl:r.url||url};
}

function pageText(html=''){
  const $=cheerio.load(html);
  $('script,style,noscript,nav,header,footer,svg').remove();
  return cleanTitle(($('main').first().length?$('main').first():$('body')).text()||'');
}

function canonicalDetail(raw=''){
  try{
    const u=new URL(raw,'https://www.bourgognefranchecomte.fr');
    u.pathname=u.pathname.replace(/^\/index\.php\/node\/(\d+)/,'/node/$1');
    u.search='';u.hash='';
    return canonicalUrl(u.href);
  }catch{return ''}
}

function privateMasterUrl(source,page=0){
  const u=new URL(source.url);
  u.searchParams.set('field_domaine_target_id','All');
  u.searchParams.set('field_vous_etes_target_id',PRIVATE_FILTER);
  u.searchParams.set('field_types_value','All');
  u.searchParams.set('page',String(page));
  return u.href;
}

function listingEvidence($,a){
  let el=$(a).parent(),best='';
  for(let i=0;i<7&&el.length;i++){
    const raw=cleanTitle(el.text()||'');
    if(raw&&raw.length<2800)best=raw;
    if(/Organisme privé|TAG FEADER|TAG FEDER|TAG Interreg/i.test(raw)&&/Plus de détails/i.test(raw))break;
    el=el.parent();
  }
  return best;
}

export function parseBfcPrivatePage(html,base){
  const $=cheerio.load(html),items=[];
  const body=cleanTitle($('body').text()||'');
  const expectedOccurrences=Number(body.match(/(\d+)\s+aide\(s\)\s*&\s*service\(s\)/i)?.[1]||0)||null;
  $('a[href]').each((_,a)=>{
    const label=cleanTitle($(a).text()||'');
    if(!/^Plus de détails$/i.test(label))return;
    const href=$(a).attr('href')||'',url=canonicalDetail(new URL(href,base).href);
    if(!url)return;
    items.push({url,listingEvidence:listingEvidence($,a)});
  });
  return{items,expectedOccurrences};
}

export function bfcBeneficiarySection(text=''){
  return cleanTitle(String(text).match(/Vous êtes\s+([\s\S]{0,1800}?)(?=\s+Vous voulez\s+|\s+Ce qu.il faut savoir\s+|\s+Date\(s\) limite)/i)?.[1]||'');
}

export function classifyBfcInstrument(title='',text=''){
  const types=normalizeAidTypes(text);
  const isAap=AAP_RX.test(`${title} ${text}`);
  const outOfScope=OUT_SCOPE_RX.test(text);
  if(outOfScope&&!types.includes('PRET_TAUX_ZERO'))return{aidTypes:[],reason:'INSTRUMENT_HORS_PERIMETRE'};
  const aidTypes=uniq([...types,...(isAap?['APPEL_A_PROJET']:[])]);
  return aidTypes.length?{aidTypes,reason:null}:{aidTypes:[],reason:'INSTRUMENT_CIBLE_NON_PROUVE'};
}

function instrumentEvidence(text='',types=[]){
  const sentences=String(text).replace(/\s+/g,' ').split(/(?<=[.;:])\s+/).map(x=>x.trim()).filter(Boolean);
  const rx={
    SUBVENTION:/\b(?:subvention|aide non remboursable|dotation)\b/i,
    AVANCE_REMBOURSABLE:/\b(?:avance remboursable|avance récupérable|avance recuperable)\b/i,
    PRET_TAUX_ZERO:/\b(?:pr[eê]t (?:d['’]honneur )?(?:à|a) taux (?:z[eé]ro|0)|sans int[eé]r[eê]t|taux d['’]int[eé]r[eê]t (?:z[eé]ro|0))\b/i,
    APPEL_A_PROJET:AAP_RX
  };
  const proofs=[];
  for(const type of types){
    const hit=sentences.find(s=>rx[type]?.test(s));
    if(hit)proofs.push(`${type}: ${hit}`);
  }
  return proofs.join(' • ').slice(0,850);
}

function currentState(text=''){
  const n=norm(text);
  if(/dispositif clos|appel.{0,30}clos|aide.{0,30}close|cloture|n.est plus ouvert/.test(n))return{retain:false,state:'CLOSED',closing:null,evidence:'La fiche officielle indique que le dispositif est clos.'};
  const section=String(text).match(/Date\(s\) limite\(s\) de dépôt[\s:–-]*([\s\S]{0,700})/i)?.[1]||'';
  const dates=detectDates(section),closing=dates.at(-1)||null;
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if(closing&&closing<today)return{retain:false,state:'CLOSED',closing,evidence:`Date limite du dépôt : ${closing}`};
  if(closing)return{retain:true,state:'OPEN',closing,evidence:`Date limite du dépôt : ${closing}`};
  return{retain:true,state:'OPEN_UNDATED',closing:null,evidence:'Présent dans le guide officiel Organisme privé courant, sans date limite échue détectée.'};
}

async function enterpriseMaster(source,{log=console.log,maxPages=60}={}){
  const unique=new Map();let expectedOccurrences=null,observedOccurrences=0,pagesScanned=0,empty=0;
  for(let page=0;page<maxPages;page++){
    const url=privateMasterUrl(source,page),loaded=await getHtml(url);
    const parsed=parseBfcPrivatePage(loaded.html,loaded.finalUrl||url);
    if(expectedOccurrences==null&&parsed.expectedOccurrences)expectedOccurrences=parsed.expectedOccurrences;
    if(!parsed.items.length){empty++;if(empty>=1&&page>2)break}else empty=0;
    for(const item of parsed.items){
      observedOccurrences++;
      const prev=unique.get(item.url);
      unique.set(item.url,{url:item.url,listingEvidence:cleanTitle([prev?.listingEvidence||'',item.listingEvidence||''].join(' '))});
    }
    pagesScanned++;
    if(expectedOccurrences&&observedOccurrences>=expectedOccurrences)break;
  }
  log(`[bfc] master Organisme privé: ${observedOccurrences}/${expectedOccurrences??'?'} occurrence(s), ${unique.size} dispositif(s) unique(s), ${pagesScanned} page(s)`);
  return{links:[...unique.values()],expectedOccurrences,observedOccurrences,pagesScanned};
}

async function extractOne(source,link){
  if(EUROPEAN_RX.test(link.listingEvidence||''))return{aid:null,excluded:{url:link.url,reason:'FONDS_EUROPEEN_CYCLE_DEDIE'}};
  const loaded=await getHtml(link.url),resolved=canonicalDetail(loaded.finalUrl||link.url);
  if(resolved!==canonicalDetail(link.url))return{aid:null,excluded:{url:link.url,reason:'REDIRECTION_VERS_AUTRE_PAGE',resolvedUrl:resolved}};
  const text=pageText(loaded.html),$=cheerio.load(loaded.html),title=cleanTitle($('h1').first().text()||'');
  if(!title)return{aid:null,excluded:{url:link.url,reason:'TITRE_ABSENT'}};
  const state=currentState(text);
  if(!state.retain)return{aid:null,excluded:{url:link.url,label:title,reason:'DISPOSITIF_CLOS',closingDate:state.closing}};
  const beneficiary=bfcBeneficiarySection(text);
  if(!ENTERPRISE_RX.test(beneficiary))return{aid:null,excluded:{url:link.url,label:title,reason:beneficiary&&NON_ENTERPRISE_RX.test(beneficiary)?'HORS_CIBLE_ENTREPRISE':'ELIGIBILITE_ENTREPRISE_NON_PROUVEE'}};
  const instrument=classifyBfcInstrument(title,text);
  if(!instrument.aidTypes.length)return{aid:null,excluded:{url:link.url,label:title,reason:instrument.reason}};
  const a=extractFromHtml(loaded.html,{url:link.url,sourceTier:'B',scope:'REGIONAL',region:REGION});
  const kind=AAP_RX.test(`${title} ${text}`)?'AAP / AMI':'AIDE',checkedAt=new Date().toISOString();
  a.id=directPageId(source.id,link.url);a.canonicalId=a.id;a.title=title;
  a.sourceId=source.id;a.sourceRecordId=link.url;a.kind=kind;a.catalogueKind=kind;
  a.scope='REGIONAL';a.regions=[REGION];a.aidTypes=instrument.aidTypes;
  a.sourcePortal=REGION;a.guichetVerified=GUICHET;a.enterpriseEligible=true;a.catalogueVerified=true;
  a.sourceState=state.state;a.lifecycleStatus='ACTIVE';a.officialPage=link.url;
  if(state.closing){a.closingDate=state.closing;a.finalClosingDate=state.closing;a.deadlines=uniq([...(a.deadlines||[]),state.closing]).sort()}
  if(!Array.isArray(a.funder))a.funder=[];
  if(/R[eé]gion Bourgogne[- ]Franche[- ]Comt[eé]/i.test(text)&&!a.funder.includes(REGION))a.funder=uniq([...a.funder,REGION]);
  a.sourceLinks=[{label:'Page officielle Région Bourgogne-Franche-Comté',url:link.url},...(a.sourceLinks||[]).filter(x=>x?.url&&canonicalDetail(x.url)!==link.url)];
  const master=privateMasterUrl(source,0),proof=instrumentEvidence(text,instrument.aidTypes);
  const extra=[
    {field:'catalogueMembership',sourceUrl:master,sourceTier:'B',locator:'bfc-private-filter:87',evidenceText:'Présent dans le Guide officiel des aides, filtre Organisme privé (87).',checkedAt},
    {field:'guichet',sourceUrl:master,sourceTier:'B',locator:'regional-private-catalogue',evidenceText:'Dispositif référencé dans le Guide officiel des aides de la Région Bourgogne-Franche-Comté.',checkedAt},
    {field:'enterpriseEligibility',sourceUrl:link.url,sourceTier:'B',locator:'section:Vous êtes',evidenceText:beneficiary.slice(0,850),checkedAt},
    {field:'sourceStatus',sourceUrl:state.closing?link.url:master,sourceTier:'B',locator:state.closing?'deadline':'current-private-listing',evidenceText:state.evidence,checkedAt},
    {field:'catalogueKind',sourceUrl:link.url,sourceTier:'B',locator:'direct-page-title',evidenceText:kind,checkedAt},
    {field:'instrument',sourceUrl:link.url,sourceTier:'B',locator:'direct-page-financial-terms',evidenceText:(proof||instrument.aidTypes.join(', ')).slice(0,850),checkedAt}
  ];
  a.verification={...(a.verification||{}),status:'VERIFIE',sourceTier:'B',lastChecked:checkedAt,fieldEvidence:[...(a.verification?.fieldEvidence||[]),...extra]};
  a.guichetVerification={status:'VERIFIED',sourceUrl:master,evidenceText:extra[1].evidenceText,checkedAt};
  return{aid:a,excluded:null};
}

async function extractMany(source,links,{log=console.log,workers=10}={}){
  const aids=[],excluded=[],errors=[];let cursor=0;
  await Promise.all(Array.from({length:workers},async()=>{while(true){
    const i=cursor++;if(i>=links.length)return;const link=links[i];
    try{const out=await extractOne(source,link);if(out.aid)aids.push(out.aid);else if(out.excluded)excluded.push(out.excluded)}
    catch(e){errors.push({url:link.url,reason:String(e?.message||e)});log(`[bfc] erreur fiche ${link.url}: ${e.message}`)}
  }}));
  return{aids,excluded,errors};
}

export async function discoverBfc(source,{log=console.log}={}){return enterpriseMaster(source,{log})}

export async function collectBfc(source,{log=console.log}={}){
  const master=await discoverBfc(source,{log});
  const out=await extractMany(source,master.links,{log,workers:10});
  return{
    aids:out.aids,discovered:master.links.length,
    audit:{
      discovered:master.links.length,imported:out.aids.length,excluded:out.excluded,errors:out.errors,
      accounted:out.aids.length+out.excluded.length+out.errors.length,
      channels:{
        enterpriseCatalogue:master.links.length,
        enterpriseOccurrences:master.observedOccurrences,
        enterpriseOccurrencesExpected:master.expectedOccurrences,
        pagesScanned:master.pagesScanned,
        duplicateOccurrences:Math.max(0,master.observedOccurrences-master.links.length),
        europeanExcluded:out.excluded.filter(x=>x.reason==='FONDS_EUROPEEN_CYCLE_DEDIE').length
      }
    },
    message:`BFC v1: ${master.observedOccurrences}/${master.expectedOccurrences??'?'} occurrence(s), ${master.links.length} dispositif(s) unique(s), ${out.aids.length} retenu(s), ${out.excluded.length} exclusion(s), ${out.errors.length} erreur(s)`
  };
}
