import * as cheerio from 'cheerio';
import { readFile } from 'node:fs/promises';
import { fetchText } from '../lib/http.mjs';
import { browserHtml } from '../lib/browser.mjs';
import { extractFromHtml } from '../lib/extract.mjs';
import { directPageId } from '../lib/direct-sources.mjs';
import { canonicalUrl, cleanTitle, detectDates, norm, safeUrl, uniq } from '../lib/utils.mjs';

const REGION='Auvergne-Rhône-Alpes';
const PATH_PREFIX='/aides/';
const EUROPEAN_RX=/\b(?:FEADER|FEDER|FSE\+?|FTJ|LEADER|PEI)\b/i;
const AAP_RX=/\b(?:appel(?:s)? à projets?|appel(?:s)? a projets?|appel(?:s)? à manifestation d['’]intérêt|appel(?:s)? a manifestation d['’]interet|\bAMI\b)\b/i;
const EXCLUDED_FINANCIAL_RX=/\b(?:garantie de pr[eê]t|garantir un cr[eé]dit|fonds propres|quasi[- ]fonds propres|lev[eé]e de fonds|prise de participation|pr[eê]t croissance|pr[eê]t classique|cr[eé]dit[- ]bail)\b/i;

async function getHtml(url){
  try{
    const r=await fetchText(url,{timeoutMs:25000,retries:2,headers:{
      'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36',
      'accept-language':'fr-FR,fr;q=0.9'
    }});
    return{html:r.text,finalUrl:r.url||url,via:'http'};
  }catch{
    const r=await browserHtml(url,{timeoutMs:65000});
    return{html:r.html,finalUrl:r.url||url,via:'browser'};
  }
}

function pageText(html){
  const $=cheerio.load(html);
  $('script,style,noscript,nav,header,footer,svg').remove();
  return cleanTitle(($('main').first().length?$('main').first():$('body')).text()||'');
}

function parisToday(now=new Date()){
  return new Intl.DateTimeFormat('en-CA',{
    timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'
  }).format(now);
}

function uniqueLinks(items=[]){
  const map=new Map();
  for(const x of items){
    const url=canonicalUrl(x?.url||'');if(!url)continue;
    const prev=map.get(url)||{url,label:''};
    map.set(url,{...prev,...x,url,label:cleanTitle(x?.label||prev.label||'')});
  }
  return [...map.values()];
}

function cardClosingDate(text=''){
  const raw=String(text||'');
  const m=raw.match(/Date limite du d[eé]p[oô]t\s*:\s*([^|•]+)/i);
  const dates=detectDates(m?.[1]||raw);
  return dates.at(-1)||null;
}

export function parseAuraEnterpriseListingHtml(html,base){
  const $=cheerio.load(html),items=[];
  const body=cleanTitle($('body').text()||'');
  const countMatch=body.match(/(\d+)\s+R[eé]sultat\(s\)/i);
  const expectedCount=countMatch?Number(countMatch[1]):null;
  $('article.node--type-aid.node--view-mode-search-result').each((_,article)=>{
    const a=$(article).find('a[href*="/aides/"]').first();
    const url=safeUrl(a.attr('href'),base);
    if(!url)return;
    let ok=false;
    try{
      const u=new URL(url),b=new URL(base);
      ok=u.origin===b.origin&&u.pathname.startsWith(PATH_PREFIX)&&u.pathname!==PATH_PREFIX;
    }catch{}
    if(!ok)return;
    const raw=cleanTitle($(article).text()||'');
    const label=cleanTitle(a.text()||a.attr('title')||'');
    const kind=AAP_RX.test(label+' '+raw)?'AAP / AMI':'AIDE';
    items.push({
      url,label,kind,
      closingDate:cardClosingDate(raw),
      listingEvidence:raw.slice(0,1400)
    });
  });
  return{items:uniqueLinks(items),expectedCount};
}

export function isEuropeanFundAid(link){
  return EUROPEAN_RX.test(`${link?.label||''} ${link?.url||''} ${link?.listingEvidence||''}`);
}

async function enterpriseMaster(source,{log=console.log,maxPages=80}={}){
  const all=[],seen=new Set();
  let expectedCount=null,emptyStreak=0,pagesScanned=0;
  for(let page=0;page<maxPages;page++){
    const u=new URL(source.url);
    u.searchParams.set('f[0]','profil:3');
    u.searchParams.set('page',String(page));
    let loaded;
    try{loaded=await getHtml(u.href)}
    catch(e){
      log(`[${source.id}] page catalogue inaccessible ${u.href}: ${e.message}`);
      break;
    }
    const parsed=parseAuraEnterpriseListingHtml(loaded.html,loaded.finalUrl||u.href);
    pagesScanned++;
    if(expectedCount==null&&Number.isFinite(parsed.expectedCount))expectedCount=parsed.expectedCount;
    let added=0;
    for(const item of parsed.items){
      const k=canonicalUrl(item.url);if(seen.has(k))continue;
      seen.add(k);all.push(item);added++;
    }
    if(added===0)emptyStreak++;else emptyStreak=0;
    if(expectedCount!=null&&all.length>=expectedCount)break;
    if(emptyStreak>=2)break;
  }
  const links=uniqueLinks(all);
  log(`[${source.id}] catalogue maître Entreprise AURA: ${links.length}/${expectedCount??'?'} fiche(s), ${pagesScanned} page(s)`);
  return{links,expectedCount,pagesScanned};
}

async function externalAuditLinks(source,{log=console.log}={}){
  if(!source.externalAuditFile)return[];
  try{
    const root=new URL('../../',import.meta.url);
    const file=new URL(source.externalAuditFile,root);
    const audit=JSON.parse(await readFile(file,'utf8'));
    const links=uniqueLinks((audit.candidates||[]).map(x=>({url:x.url,label:x.title||'',engines:x.engines||[]})));
    log(`[${source.id}] contre-audit externe AURA: ${links.length} URL(s)`);
    return links;
  }catch(e){
    log(`[${source.id}] contre-audit externe indisponible: ${e.message}`);
    return[];
  }
}

function currentState(a,listing,now=new Date()){
  const today=parisToday(now);
  const directDates=uniq([
    ...(a?.deadlines||[]).map(x=>typeof x==='string'?x:x?.date),
    a?.finalClosingDate,a?.closingDate
  ].filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x)))).sort();
  const closing=listing?.closingDate||directDates.at(-1)||null;
  if(closing&&closing<today)return{state:'CLOSED',retain:false,closing,evidence:`Date limite du dépôt : ${closing}`};
  if(closing)return{state:'OPEN',retain:true,closing,evidence:`Date limite du dépôt : ${closing}`};
  if(a?.permanent)return{state:'PERMANENT',retain:true,closing:null,evidence:'Dispositif permanent selon la fiche officielle'};
  return{state:'OPEN_UNDATED',retain:true,closing:null,evidence:'Présent dans le catalogue officiel Entreprise courant'};
}

function targetInstrument(a,text=''){
  const actual=uniq((a?.aidTypes||[]).filter(x=>['SUBVENTION','AVANCE_REMBOURSABLE','PRET_TAUX_ZERO'].includes(x)));
  if(actual.length)return{aidTypes:actual,reason:null};
  if(EXCLUDED_FINANCIAL_RX.test(text))return{aidTypes:[],reason:'INSTRUMENT_HORS_PERIMETRE'};
  return{aidTypes:[],reason:'INSTRUMENT_CIBLE_NON_PROUVE'};
}

function directRegionEvidence(text=''){
  const raw=String(text||'');
  const m=raw.match(/.{0,160}(?:R[eé]gion Auvergne[-‑ ]Rh[oô]ne[-‑ ]Alpes|Auvergne[-‑ ]Rh[oô]ne[-‑ ]Alpes).{0,260}/i);
  return cleanTitle(m?.[0]||'');
}

async function extractOne(source,link){
  const requested=canonicalUrl(link.url);
  const loaded=await getHtml(requested);
  const resolved=canonicalUrl(loaded.finalUrl||requested);
  if(resolved!==requested)return{aid:null,excluded:{url:requested,label:link.label||'',reason:'REDIRECTION_VERS_AUTRE_PAGE',resolvedUrl:resolved}};
  const text=pageText(loaded.html);
  if(EUROPEAN_RX.test(text)||isEuropeanFundAid(link)){
    return{aid:null,excluded:{url:requested,label:link.label||'',reason:'FONDS_EUROPEEN_CYCLE_DEDIE'}};
  }
  const a=extractFromHtml(loaded.html,{url:requested,sourceTier:'B',scope:'REGIONAL',region:REGION});
  const label=cleanTitle(link.label||'');if(label.length>=4)a.title=label;
  if(!a.title||a.title.length<4)return{aid:null,excluded:{url:requested,label:label||'',reason:'TITRE_ABSENT'}};
  const state=currentState(a,link);
  if(!state.retain)return{aid:null,excluded:{url:requested,label:a.title,reason:'DISPOSITIF_CLOS',closingDate:state.closing}};
  const instrument=targetInstrument(a,text);
  if(!instrument.aidTypes.length){
    return{aid:null,excluded:{url:requested,label:a.title,reason:instrument.reason}};
  }

  const checkedAt=new Date().toISOString();
  a.id=directPageId(source.id,requested);a.canonicalId=a.id;
  a.sourceId=source.id;a.sourceRecordId=requested;
  a.kind=link.kind||'AIDE';a.catalogueKind=a.kind;
  a.scope='REGIONAL';a.regions=[REGION];
  a.aidTypes=instrument.aidTypes;
  a.sourcePortal=REGION;a.guichetVerified=REGION;
  a.catalogueVerified=true;a.sourceState=state.state;a.lifecycleStatus='ACTIVE';
  a.officialPage=requested;
  if(state.closing){
    a.closingDate=state.closing;a.finalClosingDate=state.closing;
    a.deadlines=uniq([...(a.deadlines||[]),state.closing]).sort();
  }
  if(!Array.isArray(a.funder))a.funder=[];
  const regionEv=directRegionEvidence(text);
  if(regionEv&&!a.funder.includes(REGION))a.funder=uniq([...a.funder,REGION]);
  a.sourceLinks=[{label:'Page officielle Région Auvergne-Rhône-Alpes',url:requested},...(a.sourceLinks||[]).filter(x=>x?.url&&canonicalUrl(x.url)!==requested)];
  const extra=[
    {field:'catalogueMembership',sourceUrl:source.url,sourceTier:'B',locator:'enterprise-filter-listing',evidenceText:(link.listingEvidence||'Présent dans le catalogue officiel filtré Entreprise').slice(0,850),checkedAt},
    {field:'guichet',sourceUrl:source.url,sourceTier:'B',locator:'regional-enterprise-catalogue',evidenceText:'Référencé par le catalogue officiel de la Région Auvergne-Rhône-Alpes pour le profil Entreprise',checkedAt},
    {field:'enterpriseEligibility',sourceUrl:source.url,sourceTier:'B',locator:'profile-filter:Entreprise',evidenceText:'Profil officiel : Entreprise',checkedAt},
    {field:'sourceStatus',sourceUrl:state.closing?requested:source.url,sourceTier:'B',locator:state.closing?'deadline':'current-enterprise-listing',evidenceText:state.evidence,checkedAt},
    {field:'catalogueKind',sourceUrl:source.url,sourceTier:'B',locator:'listing-card',evidenceText:a.kind,checkedAt},
    {field:'instrument',sourceUrl:requested,sourceTier:'B',locator:'direct-page-financial-terms',evidenceText:a.aidTypes.join(', '),checkedAt}
  ];
  if(regionEv)extra.push({field:'funder',sourceUrl:requested,sourceTier:'B',locator:'direct-page-region',evidenceText:regionEv.slice(0,850),checkedAt});
  a.verification={...(a.verification||{}),fieldEvidence:[...(a.verification?.fieldEvidence||[]),...extra]};
  a.guichetVerification={status:'VERIFIED',sourceUrl:source.url,evidenceText:extra[0].evidenceText,checkedAt};
  return{aid:a,excluded:null};
}

async function extractMany(source,links,{log=console.log,workers=12}={}){
  const aids=[],excluded=[],errors=[];let cursor=0;
  const pool=Array.from({length:workers},async()=>{
    while(true){
      const i=cursor++;if(i>=links.length)return;
      const link=links[i];
      try{
        const out=await extractOne(source,link);
        if(out?.aid)aids.push(out.aid);
        else if(out?.excluded)excluded.push(out.excluded);
        else errors.push({url:link.url,label:link.label||'',reason:'EXTRACTION_VIDE'});
      }catch(e){
        errors.push({url:link.url,label:link.label||'',reason:String(e?.message||e)});
        log(`[${source.id}] fiche ignorée ${link.url}: ${e.message}`);
      }
    }
  });
  await Promise.all(pool);
  return{aids,excluded,errors};
}

export async function discoverAura(source,{log=console.log}={}){
  const [master,external]=await Promise.all([
    enterpriseMaster(source,{log}),
    externalAuditLinks(source,{log})
  ]);
  const masterSet=new Set(master.links.map(x=>canonicalUrl(x.url)));
  const externalOutside=external.filter(x=>!masterSet.has(canonicalUrl(x.url)));
  return{...master,external,externalOutside};
}

export async function collectAura(source,{log=console.log}={}){
  const discovered=await discoverAura(source,{log});
  const nonEuropean=discovered.links.filter(x=>!isEuropeanFundAid(x));
  const european=discovered.links.filter(isEuropeanFundAid);
  const out=await extractMany(source,nonEuropean,{log,workers:12});
  const excluded=[...european.map(x=>({url:x.url,label:x.label||'',reason:'FONDS_EUROPEEN_CYCLE_DEDIE'})),...out.excluded];
  return{
    aids:out.aids,
    discovered:discovered.links.length,
    audit:{
      discovered:discovered.links.length,
      imported:out.aids.length,
      excluded,
      errors:out.errors,
      accounted:out.aids.length+excluded.length+out.errors.length,
      channels:{
        enterpriseCatalogue:discovered.links.length,
        enterpriseExpected:discovered.expectedCount,
        pagesScanned:discovered.pagesScanned,
        externalAudit:discovered.external.length,
        externalOutsideCatalogue:discovered.externalOutside.length,
        europeanExcluded:european.length
      },
      externalDisposition:{
        outsideCatalogue:discovered.externalOutside.map(x=>({url:x.url,label:x.label||'',engines:x.engines||[]}))
      },
      controlGaps:{
        externalOutsideCatalogue:discovered.externalOutside.map(x=>({url:x.url,label:x.label||'',engines:x.engines||[]}))
      }
    },
    message:`AURA v1: ${discovered.links.length}/${discovered.expectedCount??'?'} dispositifs Entreprise comptabilisés, ${out.aids.length} aides/AAP cible(s) importés, ${excluded.length} exclusion(s), ${out.errors.length} erreur(s)`
  };
}
