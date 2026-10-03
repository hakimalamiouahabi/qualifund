import * as cheerio from 'cheerio';
import { XMLParser } from 'fast-xml-parser';
import { fetchText } from '../lib/http.mjs';
import { browserHtml } from '../lib/browser.mjs';
import { extractFromHtml } from '../lib/extract.mjs';
import { directPageId } from '../lib/direct-sources.mjs';
import { canonicalUrl, cleanTitle, safeUrl, norm, uniq, detectDates } from '../lib/utils.mjs';

// Cycle verrouillé ADEME : catalogue + RSS officiels, sans agrégateur ni LLM.
const REGIONS=[
  'Auvergne-Rhône-Alpes','Bourgogne-Franche-Comté','Bretagne','Centre-Val de Loire','Corse',
  'Grand Est','Hauts-de-France','Île-de-France','Normandie','Nouvelle-Aquitaine','Occitanie',
  'Pays de la Loire',"Provence-Alpes-Côte d'Azur",'Guadeloupe','Guyane','Martinique','La Réunion','Mayotte'
];

async function getHtml(url){
  try{
    const r=await fetchText(url,{timeoutMs:30000,retries:2,headers:{
      'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36',
      'accept-language':'fr-FR,fr;q=0.9,en;q=0.7'
    }});
    return{html:r.text,finalUrl:r.url||url,via:'http'};
  }catch{
    const r=await browserHtml(url,{timeoutMs:65000});
    return{html:r.html,finalUrl:r.url||url,via:'browser'};
  }
}

function isAidUrl(raw){
  try{
    const u=new URL(raw);
    if(u.hostname!=='agirpourlatransition.ademe.fr')return false;
    const p=u.pathname.replace(/\/+$/,'');
    if(!p.startsWith('/entreprises/aides-financieres/catalogue/'))return false;
    if(p==='/entreprises/aides-financieres/catalogue')return false;
    if(p.includes('/catalogue-rex/'))return false;
    if(/\/accessibilite|\/mentions-legales|\/politique-|\/conditions-generales/i.test(p))return false;
    return true;
  }catch{return false}
}

function uniqueLinks(items=[]){
  const by=new Map();
  for(const item of items){
    const url=canonicalUrl(item?.url||'');
    if(!url||!isAidUrl(url))continue;
    const prev=by.get(url)||{url,label:''};
    by.set(url,{
      ...prev,
      ...item,
      url,
      label:cleanTitle(item?.label||prev.label||''),
      catalogueKind:item?.catalogueKind||prev.catalogueKind||null,
      catalogueStatus:item?.catalogueStatus||prev.catalogueStatus||null,
      catalogueClosingDate:item?.catalogueClosingDate||prev.catalogueClosingDate||null,
      catalogueEvidence:item?.catalogueEvidence||prev.catalogueEvidence||null
    });
  }
  return [...by.values()];
}

function parisDateIso(now=new Date()){
  return new Intl.DateTimeFormat('en-CA',{
    timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'
  }).format(now);
}

export function ademeKindFromOfficialUrl(url=''){
  try{
    const p=new URL(url).pathname;
    if(p.includes('/entreprises/aides-financieres/catalogue/aap/'))return 'AAP / AMI';
    if(/\/entreprises\/aides-financieres\/catalogue\/20\d{2}\//.test(p))return 'AIDE';
    return null;
  }catch{return null}
}

function rssMeta(item,now=new Date()){
  const url=typeof item.link==='string'?item.link:item.link?.['#text']||'';
  const description=String(item.description||'');
  const plain=cleanTitle(description);
  const dates=detectDates(plain);
  const openingDate=dates[0]||null;
  const closingDate=dates.length>1?dates.at(-1):(dates[0]||null);
  const today=parisDateIso(now);
  const active=Boolean(closingDate&&closingDate>=today&&(!openingDate||openingDate<=today));
  return{
    url,
    label:String(item.title||''),
    rssSummary:plain.replace(/^Délai de dépôt des dossiers\s*:\s*/i,'').slice(0,1800),
    rssOpeningDate:openingDate,
    rssClosingDate:closingDate,
    rssActive:active,
    catalogueKind:ademeKindFromOfficialUrl(url),
    catalogueStatus:active?'OPEN':'CLOSED',
    catalogueClosingDate:closingDate,
    catalogueEvidence:plain.slice(0,1200),
    inventoryMode:'RSS'
  };
}

export function parseAdemeRss(xml,{now=new Date()}={}){
  const feed=new XMLParser({ignoreAttributes:false,trimValues:true}).parse(xml);
  const items=feed?.rss?.channel?.item||[];
  return uniqueLinks((Array.isArray(items)?items:[items]).map(item=>rssMeta(item,now)));
}

async function rssLinks(source,{log=console.log}={}){
  if(!source.rssUrl)return[];
  try{
    const xml=(await fetchText(source.rssUrl,{timeoutMs:25000,retries:2})).text;
    const links=parseAdemeRss(xml);
    const active=links.filter(x=>x.rssActive);
    log(`[${source.id}] RSS officiel ADEME: ${links.length} fiches, dont ${active.length} actives`);
    return links;
  }catch(e){
    log(`[${source.id}] RSS indisponible: ${e.message}`);
    return[];
  }
}

function catalogueClosingDate(text=''){
  const months={janvier:1,fevrier:2,'février':2,mars:3,avril:4,mai:5,juin:6,juillet:7,aout:8,'août':8,septembre:9,octobre:10,novembre:11,decembre:12,'décembre':12};
  const m=String(text).match(/ouvert jusqu['’]au\s+(0?[1-9]|[12]\d|3[01])\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(20\d{2})/i);
  if(m){
    const mm=String(months[m[2].toLowerCase()]).padStart(2,'0');
    const dd=String(Number(m[1])).padStart(2,'0');
    return `${m[3]}-${mm}-${dd}`;
  }
  return detectDates(text).at(-1)||null;
}

function catalogueCardMeta($,anchor,base){
  let node=$(anchor);
  for(let depth=0;depth<7;depth++){
    node=node.parent();
    if(!node.length)break;
    const aidLinks=node.find('a[href]').toArray().filter(x=>isAidUrl(safeUrl($(x).attr('href'),base)));
    if(aidLinks.length!==1)continue;
    const raw=cleanTitle(node.text()||'');
    const n=norm(raw);
    if(!raw||raw.length>1800)continue;
    if(!/ouvert jusqu['’]au/i.test(raw))continue;
    const aapPos=n.indexOf('appel a projet');
    const aidePos=n.indexOf('aide');
    let catalogueKind=null;
    if(aapPos>=0&&aapPos<140)catalogueKind='AAP / AMI';
    else if(aidePos>=0&&aidePos<80)catalogueKind='AIDE';
    if(!catalogueKind)continue;
    const status=/ouvert jusqu['’]au/i.test(raw)?'OPEN':null;
    return{
      catalogueKind,
      catalogueStatus:status,
      catalogueClosingDate:status?catalogueClosingDate(raw):null,
      catalogueEvidence:raw.slice(0,1200)
    };
  }
  return{catalogueKind:null,catalogueStatus:null,catalogueClosingDate:null,catalogueEvidence:null};
}

export function parseAdemeCatalogueHtml(html,base){
  const $=cheerio.load(html),aids=[],pages=[];
  const bodyText=cleanTitle($('body').text()||'');
  const totalMatch=bodyText.match(/(\d+)\s+dispositifs?\s+d['’]aide\s+correspondent/i);
  const totalCount=totalMatch?Number(totalMatch[1]):null;
  $('a[href]').each((_,a)=>{
    const url=safeUrl($(a).attr('href'),base);
    if(!url)return;
    const label=cleanTitle($(a).text()||$(a).attr('title')||'');
    if(isAidUrl(url))aids.push({url,label,...catalogueCardMeta($,a,base)});
    try{
      const u=new URL(url),b=new URL(base);
      if(u.origin!==b.origin)return;
      if(u.pathname.replace(/\/+$/,'')!=='/entreprises/aides-financieres/catalogue')return;
      if(u.searchParams.has('page'))pages.push(u.href);
    }catch{}
  });
  const unique=uniqueLinks(aids);
  return{
    aids:unique,
    pages:[...new Set(pages)],
    totalCount,
    aapCount:unique.filter(x=>x.catalogueKind==='AAP / AMI').length,
    aidCount:unique.filter(x=>x.catalogueKind==='AIDE').length,
    unclassifiedCount:unique.filter(x=>!x.catalogueKind).length
  };
}

async function catalogueLinks(source,{log=console.log,maxPages=100}={}){
  const queue=[source.url],seenPages=new Set(),found=[],discoveryErrors=[];
  let expectedTotal=null,pagesScanned=0;
  while(queue.length&&seenPages.size<maxPages){
    const pageUrl=queue.shift();
    if(seenPages.has(pageUrl))continue;
    seenPages.add(pageUrl);
    let loaded;
    try{loaded=await getHtml(pageUrl)}
    catch(e){
      discoveryErrors.push({url:pageUrl,reason:e.message});
      log(`[${source.id}] catalogue inaccessible ${pageUrl}: ${e.message}`);
      continue;
    }
    let parsed=parseAdemeCatalogueHtml(loaded.html,loaded.finalUrl||pageUrl);
    if(!parsed.aids.length){
      try{
        const rendered=await browserHtml(pageUrl,{
          timeoutMs:65000,
          waitForSelector:'a[href*="/entreprises/aides-financieres/catalogue/"]',
          waitAfterMs:1800
        });
        const browserParsed=parseAdemeCatalogueHtml(rendered.html,rendered.url||pageUrl);
        if(browserParsed.aids.length||browserParsed.pages.length||browserParsed.totalCount!=null){
          parsed=browserParsed;
          log(`[${source.id}] catalogue rendu navigateur ${pageUrl}: ${browserParsed.aids.length} fiche(s)`);
        }
      }catch(e){
        // Une page vide après la dernière page est normale. La complétude est contrôlée
        // par le compteur officiel du catalogue, pas par un nombre de pages codé en dur.
      }
    }
    pagesScanned++;
    if(expectedTotal==null&&Number.isFinite(parsed.totalCount))expectedTotal=parsed.totalCount;
    found.push(...parsed.aids);
    for(const u of parsed.pages)if(!seenPages.has(u))queue.push(u);

    // Fallback déterministe Drupal : la pagination est zéro-indexée. On avance jusqu'à
    // la première page sans fiche, au lieu de supposer qu'il existe toujours 8/12 pages.
    if(!parsed.pages.length&&parsed.aids.length){
      const u=new URL(pageUrl);
      const current=Number(u.searchParams.get('page')||0);
      u.searchParams.set('page',String(current+1));
      if(!seenPages.has(u.href))queue.push(u.href);
    }
  }
  const links=uniqueLinks(found);
  const aapCount=links.filter(x=>x.catalogueKind==='AAP / AMI').length;
  const aidCount=links.filter(x=>x.catalogueKind==='AIDE').length;
  const unclassified=links.filter(x=>!x.catalogueKind);
  log(`[${source.id}] catalogue maître ADEME: ${links.length}/${expectedTotal??'?'} URL(s), dont ${aapCount} AAP et ${aidCount} aides`);
  return{links,expectedTotal,pagesScanned,aapCount,aidCount,unclassified,discoveryErrors};
}

function pageText(html){
  const $=cheerio.load(html);
  $('script,style,noscript,nav,header,footer,svg').remove();
  return cleanTitle(($('main').first().length?$('main').first():$('body')).text()||'');
}

function evidence(text,patterns=[]){
  const raw=String(text||'');
  for(const rx of patterns){
    const m=raw.match(rx);
    if(!m)continue;
    const i=Math.max(0,(m.index||0)-160),j=Math.min(raw.length,(m.index||0)+m[0].length+260);
    return cleanTitle(raw.slice(i,j));
  }
  return null;
}

export function ademeAttributionEvidence(text=''){
  return evidence(text,[
    /l['’]\s*ADEME\s+(?:vous\s+)?(?:accompagne|soutient|finance|cofinance|attribue|accorde|lance|pilote|instruit|juge)/i,
    /(?:aide|soutien|financement)s?\s+(?:accord[eé]s?\s+)?(?:par|de)\s+l['’]\s*ADEME/i,
    /(?:pilot[eé]|op[eé]r[eé]|g[eé]r[eé]|instruit)\s+par\s+(?:l['’]\s*)?ADEME/i,
    /(?:contrat|convention)\s+d['’]\s*aide[^.;]{0,160}\bADEME\b/i,
    /fonds[^.;]{0,120}\bde\s+l['’]\s*ADEME\b/i,
    /\bADEME\b[^.;]{0,120}\b(?:finance|cofinance|soutient|accompagne|attribue|accorde)\b/i
  ]);
}

function beneficiaryEvidence(a,text=''){
  const section=cleanTitle(a?.beneficiaries||'');
  const cat=(a?.companyCategories||[]).join(' ');
  const enterprise=/\b(?:entreprises?|tpe|pme|eti|grandes?\s+entreprises?|start[- ]?ups?|soci[eé]t[eé]s?|acteurs?\s+[ée]conomiques?)\b/i;
  if(enterprise.test(section)||enterprise.test(cat))return section||cat;
  const ctx=evidence(text,[
    /(?:ce dispositif|cette aide|cet appel|l['’]aide)\s+s['’]adresse[^.;]{0,420}/i,
    /(?:b[eé]n[eé]ficiaires?|[êe]tes-vous concern[eé]s?|pour qui)[^.;]{0,420}/i
  ]);
  return ctx&&enterprise.test(ctx)?ctx:null;
}

function nonEnterpriseBeneficiaryEvidence(a,text=''){
  const section=cleanTitle(a?.beneficiaries||'');
  const enterprise=/\b(?:entreprises?|tpe|pme|eti|grandes?\s+entreprises?|start[- ]?ups?|soci[eé]t[eé]s?|acteurs?\s+[ée]conomiques?)\b/i;
  const nonEnterprise=/\b(?:collectivit[eé]s?|communes?|intercommunalit[eé]s?|associations?|particuliers?|m[eé]nages?|[ée]tablissements?\s+publics?|syndicats?\s+publics?)\b/i;
  if(section&&nonEnterprise.test(section)&&!enterprise.test(section))return section;
  const ctx=evidence(text,[
    /(?:ce dispositif|cette aide|cet appel|l['’]aide)\s+s['’]adresse[^.;]{0,420}/i,
    /(?:b[eé]n[eé]ficiaires?|[êe]tes-vous concern[eé]s?|pour qui)[^.;]{0,420}/i
  ]);
  return ctx&&nonEnterprise.test(ctx)&&!enterprise.test(ctx)?ctx:null;
}

function regionEvidence(text=''){
  return evidence(text,[
    /quel(?:le)?\(?(?:s)?\)?\s+r[eé]gion(?:s)?\s+ou\s+pays\s+proposent\s+ce\s+dispositif[^#]{0,800}/i,
    /r[eé]gion(?:s)?\s+ou\s+pays\s+proposent\s+ce\s+dispositif[^#]{0,800}/i
  ]);
}

function inferRegionsFromEvidence(text=''){
  const block=regionEvidence(text);
  if(!block)return{regions:[],allRegions:false,evidence:null};
  const n=norm(block);
  if(/toutes les regions|toute la france/.test(n))return{regions:[],allRegions:true,evidence:block};
  const aliases=[
    ['Auvergne-Rhône-Alpes',['auvergne rhone alpes','aura']],
    ['Bourgogne-Franche-Comté',['bourgogne franche comte']],
    ['Bretagne',['bretagne']],
    ['Centre-Val de Loire',['centre val de loire']],
    ['Corse',['corse']],
    ['Grand Est',['grand est']],
    ['Hauts-de-France',['hauts de france']],
    ['Île-de-France',['ile de france']],
    ['Normandie',['normandie']],
    ['Nouvelle-Aquitaine',['nouvelle aquitaine']],
    ['Occitanie',['occitanie']],
    ['Pays de la Loire',['pays de la loire']],
    ["Provence-Alpes-Côte d'Azur",['provence alpes cote d azur','region sud','paca']],
    ['Guadeloupe',['guadeloupe']],['Guyane',['guyane']],['Martinique',['martinique']],
    ['La Réunion',['la reunion','reunion']],['Mayotte',['mayotte']]
  ];
  return{
    regions:uniq(aliases.filter(([,xs])=>xs.some(x=>n.includes(x))).map(([r])=>r)).filter(r=>REGIONS.includes(r)),
    allRegions:false,
    evidence:block
  };
}

function isoDaysFromToday(d,now=new Date()){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(d||'')))return null;
  const a=new Date(String(d)+'T00:00:00Z');
  const b=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
  return Math.floor((a-b)/86400000);
}

export function ademeStatusProof(a,text='',now=new Date()){
  const closed=evidence(text,[
    /(?:appel\s+[àa]\s+projets?|appel\s+d['’]offres?|dispositif|aide)[^.;]{0,120}(?:maintenant\s+clos|est\s+clos|est\s+cl[oô]tur[eé]|n['’]est\s+plus\s+ouvert)/i,
    /\bappel\s+[àa]\s+projets?\s+(?:est\s+)?(?:maintenant\s+)?clos\b/i,
    /\bappel\s+[àa]\s+projets?\s+clos\b/i,
    /(?:candidatures?|d[eé]p[oô]ts?)[^.;]{0,80}(?:sont\s+clos|sont\s+ferm[eé]s)/i
  ]);
  const open=evidence(text,[
    /(?:appel\s+[àa]\s+projets?|dispositif|aide)[^.;]{0,100}(?:en\s+cours|est\s+ouvert|ouverte\s+jusqu)/i,
    /les\s+demandes\s+d['’]aide\s+peuvent\s+[êe]tre\s+soumises/i
  ]);
  const permanent=evidence(text,[
    /(?:d[eé]p[oô]t|candidature|demandes?\s+d['’]aide)[^.;]{0,100}(?:au\s+fil\s+de\s+l['’]eau|en\s+continu)/i,
    /(?:dispositif|aide)[^.;]{0,80}(?:permanent|sans\s+date\s+limite)/i
  ]);
  const dates=uniq([
    ...(a?.deadlines||[]).map(x=>typeof x==='string'?x:x?.date),
    a?.finalClosingDate,a?.closingDate
  ].filter(Boolean)).sort();
  const last=dates.at(-1)||null,delta=last?isoDaysFromToday(last,now):null;
  if(closed){
    if(delta!=null&&delta>0)return{state:'STATUS_CONFLICT',date:last,evidence:closed,retain:false};
    if(delta!=null&&delta>=-60)return{state:'RECENTLY_CLOSED',date:last,evidence:closed,retain:true};
    return{state:'CLOSED_OLD',date:last,evidence:closed,retain:false};
  }
  if(delta!=null&&delta>=0)return{state:'OPEN',date:last,evidence:open||('Échéance officielle '+last),retain:true};
  if(delta!=null&&delta>=-60)return{state:'RECENTLY_CLOSED',date:last,evidence:open||('Échéance officielle '+last),retain:true};
  if(delta!=null&&delta<-60){
    if(open)return{state:'STATUS_CONFLICT',date:last,evidence:open,retain:false};
    return{state:'CLOSED_OLD',date:last,evidence:'Échéance officielle '+last,retain:false};
  }
  if(permanent&&a?.permanent)return{state:'PERMANENT',date:null,evidence:permanent,retain:true};
  if(open)return{state:'OPEN_UNDATED',date:null,evidence:open,retain:true};
  return{state:'UNKNOWN',date:null,evidence:null,retain:false};
}

function directKindFromText(text=''){
  const n=norm(text);
  if(/appel a projet (?:en cours|clos)/.test(n)||/appel a manifestation d['’]?interet/.test(n))return 'AAP / AMI';
  if(/\baide (?:en cours|close|cloturee)\b/.test(n))return 'AIDE';
  return null;
}

const ADEME_TARGET_INSTRUMENTS=new Set(['SUBVENTION','AVANCE_REMBOURSABLE','PRET_TAUX_ZERO']);
export function ademeInstrumentEvidence(text='',aidTypes=[]){
  const wanted=(Array.isArray(aidTypes)?aidTypes:[]).filter(x=>ADEME_TARGET_INSTRUMENTS.has(x));
  if(!wanted.length)return null;
  const sentences=String(text||'').replace(/\s+/g,' ').split(/(?<=[.;:])\s+/).map(x=>x.trim()).filter(Boolean);
  const patterns={
    SUBVENTION:/\b(?:subvention|aide non remboursable|dotation)\b/i,
    AVANCE_REMBOURSABLE:/\b(?:avance remboursable|avance r[eé]cup[eé]rable)\b/i,
    PRET_TAUX_ZERO:/\b(?:pr[eê]t (?:d['’]honneur )?(?:à|a) taux (?:z[eé]ro|0)|sans int[eé]r[eê]t|taux d['’]int[eé]r[eê]t (?:z[eé]ro|0))\b/i
  };
  const proofs=[];
  for(const type of wanted){
    const hit=sentences.find(s=>patterns[type]?.test(s));
    if(hit)proofs.push(`${type}: ${hit}`);
  }
  return proofs.length?proofs.join(' • ').slice(0,850):null;
}

function hasUsefulAidDetail(html=''){
  const text=pageText(html);
  if(text.length<500)return false;
  return /(?:appel\s+[àa]\s+projets?|aide|dispositif)[^.;]{0,140}(?:clos|cl[oô]tur[eé]|ouvert|en\s+cours)|d[eé]lai\s+de\s+d[eé]p[oô]t|heure\s+de\s+cl[oô]ture|b[eé]n[eé]ficiaires?|[êe]tes-vous\s+concern[eé]s?/i.test(text);
}

async function getDetailHtml(url){
  try{
    const r=await fetchText(url,{timeoutMs:15000,retries:1,headers:{
      'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36',
      'accept-language':'fr-FR,fr;q=0.9,en;q=0.7'
    }});
    const body=String(r.text||'');
    if(body.length>=1200&&hasUsefulAidDetail(body)){
      return{html:body,finalUrl:r.url||url,via:'http'};
    }
  }catch{}
  try{
    const r=await browserHtml(url,{timeoutMs:65000});
    const body=String(r.html||'');
    if(body.length>=1200&&hasUsefulAidDetail(body)){
      return{html:body,finalUrl:r.url||url,via:'browser'};
    }
  }catch{}
  return null;
}

function baseAidFromInventory(source,link){
  const url=canonicalUrl(link.url),now=new Date().toISOString();
  return{
    id:directPageId(source.id,url),
    canonicalId:directPageId(source.id,url),
    sourceId:source.id,
    sourceRecordId:url,
    title:cleanTitle(link.label||'Dispositif ADEME'),
    kind:link.catalogueKind||ademeKindFromOfficialUrl(url)||'AIDE',
    programme:null,
    operator:null,
    objective:link.rssSummary||null,
    beneficiaries:null,
    companyCategories:[],
    themes:[],
    scope:'NATIONAL',
    regions:[],
    aidTypes:(link.catalogueKind||ademeKindFromOfficialUrl(url))==='AAP / AMI'?['APPEL_A_PROJET']:['AUTRE'],
    openingDate:link.rssOpeningDate||null,
    closingDate:link.catalogueClosingDate||link.rssClosingDate||null,
    finalClosingDate:link.catalogueClosingDate||link.rssClosingDate||null,
    deadlines:link.catalogueClosingDate||link.rssClosingDate?[link.catalogueClosingDate||link.rssClosingDate]:[],
    permanent:false,
    cdcLinks:[],
    sourceLinks:[{label:'Page officielle ADEME',url}],
    regulationLinks:[],
    formLinks:[],
    officialPage:url,
    funder:[],
    lifecycleStatus:'ACTIVE',
    verification:{status:'A_REVERIFIER',sourceTier:'B',lastChecked:now,fieldEvidence:[]}
  };
}

async function extractOne(source,link){
  const requested=canonicalUrl(link.url);
  if(!isAidUrl(requested)){
    return{aid:null,excluded:{url:link.url,label:link.label||'',reason:'URL_HORS_CATALOGUE_ADEME'}};
  }
  if(!link.catalogueKind){
    return{aid:null,excluded:{url:link.url,label:link.label||'',reason:'TYPE_OFFICIEL_NON_CLASSE'}};
  }

  const loaded=await getDetailHtml(requested);
  let text='',a=baseAidFromInventory(source,link),detailWarning=null;
  if(loaded){
    const resolved=canonicalUrl(loaded.finalUrl||requested);
    if(!isAidUrl(resolved)||resolved!==requested){
      return{aid:null,excluded:{url:link.url,label:link.label||'',reason:'REDIRECTION_HORS_FICHE',resolvedUrl:resolved}};
    }
    text=pageText(loaded.html);
    const parsed=extractFromHtml(loaded.html,{url:requested,sourceTier:'B',scope:'NATIONAL',region:null});
    a={...a,...parsed,id:a.id,canonicalId:a.canonicalId,sourceId:source.id,sourceRecordId:requested,officialPage:requested};
    const directKind=directKindFromText(text);
    if(directKind&&directKind!==link.catalogueKind){
      return{aid:null,excluded:{url:link.url,label:link.label||a.title,reason:'CONFLIT_TYPE_OFFICIEL',rssKind:link.catalogueKind,directKind}};
    }
    const directStatus=ademeStatusProof(a,text);
    if(['STATUS_CONFLICT','CLOSED_OLD','RECENTLY_CLOSED'].includes(directStatus.state)){
      return{aid:null,excluded:{url:link.url,label:a.title,reason:'CONFLIT_STATUT_OFFICIEL',status:directStatus.state,date:directStatus.date}};
    }
  }else{
    detailWarning={url:requested,label:link.label||'',reason:'FICHE_DIRECTE_NON_LUEE_RSS_OFFICIEL_CONSERVE'};
  }

  const label=cleanTitle(link.label||'');
  if(label&&label.length>=4)a.title=label;
  if(!a.title||a.title.length<4){
    return{aid:null,excluded:{url:link.url,label:link.label||'',reason:'TITRE_ABSENT'}};
  }

  const territory=text?inferRegionsFromEvidence(text):{regions:[],allRegions:false,evidence:null};
  const closing=link.catalogueClosingDate||link.rssClosingDate||a.finalClosingDate||a.closingDate||null;
  a.id=directPageId(source.id,requested);
  a.canonicalId=a.id;
  a.sourceId=source.id;
  a.sourceRecordId=requested;
  a.kind=link.catalogueKind;
  a.guichetVerified='ADEME';
  a.sourcePortal='ADEME';
  a.enterpriseEligible=true;
  a.catalogueVerified=true;
  a.catalogueKind=link.catalogueKind;
  a.catalogueStatus='OPEN';
  a.catalogueInventoryMode=link.inventoryMode||'CATALOGUE_HTML';
  a.sourceState='OPEN';
  a.lifecycleStatus='ACTIVE';
  a.officialPage=requested;
  a.openingDate=link.rssOpeningDate||a.openingDate||null;
  if(closing){
    a.finalClosingDate=closing;
    a.closingDate=closing;
    a.deadlines=uniq([...(a.deadlines||[]),closing]).sort();
  }
  if(territory.regions.length){
    a.scope='REGIONAL';a.regions=territory.regions;
  }else if(!Array.isArray(a.regions)||!a.regions.length){
    a.scope='NATIONAL';a.regions=[];
  }
  if(!Array.isArray(a.companyCategories))a.companyCategories=[];
  if(!Array.isArray(a.aidTypes)||!a.aidTypes.length)a.aidTypes=link.catalogueKind==='AAP / AMI'?['APPEL_A_PROJET']:['AUTRE'];
  if(link.catalogueKind==='AAP / AMI'&&!a.aidTypes.includes('APPEL_A_PROJET'))a.aidTypes=uniq([...a.aidTypes,'APPEL_A_PROJET']);
  if(!Array.isArray(a.funder))a.funder=[];
  // Ne jamais déduire financeur/opérateur du simple hébergement sur le portail.
  const attribution=text?ademeAttributionEvidence(text):null;
  if(attribution){
    if(!a.funder.includes('ADEME'))a.funder=uniq([...a.funder,'ADEME']);
    if(!a.operator)a.operator='ADEME';
  }
  a.sourceLinks=[{label:'Page officielle ADEME',url:requested},...(a.sourceLinks||[]).filter(x=>x?.url&&canonicalUrl(x.url)!==requested)];

  const checkedAt=new Date().toISOString();
  const membershipSource=(link.inventoryMode==='RSS_ACTIVE_MIRROR'?source.rssUrl:source.url);
  const membershipEvidence=link.catalogueEvidence||(`Inventaire officiel ADEME Entreprises — ${link.catalogueKind}`);
  const extra=[
    {field:'catalogueMembership',sourceUrl:membershipSource,sourceTier:'B',locator:link.inventoryMode==='RSS_ACTIVE_MIRROR'?'rss-active-item':'catalogue-card',evidenceText:membershipEvidence.slice(0,850),checkedAt},
    {field:'guichet',sourceUrl:membershipSource,sourceTier:'B',locator:'ademe-enterprises-inventory',evidenceText:'Référencé par le portail officiel ADEME Entreprises',checkedAt},
    {field:'sourceStatus',sourceUrl:membershipSource,sourceTier:'B',locator:link.inventoryMode==='RSS_ACTIVE_MIRROR'?'rss-deadline':'catalogue-card-status',evidenceText:(link.catalogueEvidence||(`Échéance officielle ${closing||'active'}`)).slice(0,850),checkedAt},
    {field:'enterpriseEligibility',sourceUrl:source.url,sourceTier:'B',locator:'catalogue-entreprises',evidenceText:'Référencé dans le catalogue ADEME Entreprises',checkedAt},
    {field:'catalogueKind',sourceUrl:loaded?requested:membershipSource,sourceTier:'B',locator:loaded?'direct-page-type':'official-url-taxonomy',evidenceText:link.catalogueKind,checkedAt}
  ];
  if(territory.evidence)extra.push({field:'territory',sourceUrl:requested,sourceTier:'B',locator:'page-text-match:territory',evidenceText:territory.evidence.slice(0,850),checkedAt});
  const instrumentEvidence=loaded?ademeInstrumentEvidence(text,a.aidTypes):null;
  if(instrumentEvidence)extra.push({field:'instrument',sourceUrl:requested,sourceTier:'B',locator:'page-text-match:instrument',evidenceText:instrumentEvidence,checkedAt});
  a.verification={...(a.verification||{}),status:loaded?'VERIFIE':'A_REVERIFIER',sourceTier:'B',lastChecked:checkedAt,fieldEvidence:[...(a.verification?.fieldEvidence||[]),...extra]};
  a.guichetVerification={status:'VERIFIED',sourceUrl:membershipSource,evidenceText:membershipEvidence.slice(0,850),checkedAt};
  return{aid:a,excluded:null,detailWarning};
}

async function extractMany(source,links,{log=console.log,workers=12}={}){
  const aids=[],errors=[],excluded=[],detailWarnings=[];let cursor=0;
  const pool=Array.from({length:workers},async()=>{
    while(true){
      const i=cursor++;if(i>=links.length)return;
      const link=links[i];
      try{
        const item=await extractOne(source,link);
        if(item?.aid){
          aids.push(item.aid);
          if(item.detailWarning)detailWarnings.push(item.detailWarning);
        }else if(item?.excluded)excluded.push(item.excluded);
        else errors.push({url:link.url,label:link.label||'',reason:'EXTRACTION_VIDE'});
      }catch(e){
        errors.push({url:link.url,label:link.label||'',reason:String(e?.message||e)});
        log(`[${source.id}] fiche ignorée ${link.url}: ${e.message}`);
      }
    }
  });
  await Promise.all(pool);
  return{aids,errors,excluded,detailWarnings};
}

export function selectAdemeInventory(source,rss,catalogueRaw){
  const rssActive=(rss||[]).filter(x=>x.rssActive);
  const rssWithoutClosing=(rss||[]).filter(x=>!x.rssClosingDate);
  const htmlExpected=Number(catalogueRaw?.expectedTotal||0);
  const htmlFound=Number(catalogueRaw?.links?.length||0);
  const htmlComplete=htmlFound>0&&(
    (htmlExpected>0&&htmlFound>=htmlExpected)||
    (htmlExpected<=0&&htmlFound>=Number(source.minExpected||1))
  );

  if(htmlComplete){
    const inventoryMode='CATALOGUE_HTML';
    const rssByUrl=new Map((rss||[]).map(x=>[canonicalUrl(x.url),x]));
    const catalogue=catalogueRaw.links.map(x=>({
      ...rssByUrl.get(canonicalUrl(x.url)),
      ...x,
      inventoryMode
    }));
    return{
      catalogue,
      inventoryMode,
      catalogueData:{...catalogueRaw,inventoryMode,rssActiveCount:rssActive.length,rssWithoutClosing:rssWithoutClosing.length}
    };
  }

  const inventoryMode='RSS_ACTIVE_MIRROR';
  const catalogue=rssActive.map(x=>({
    ...x,
    catalogueKind:x.catalogueKind||ademeKindFromOfficialUrl(x.url),
    catalogueStatus:'OPEN',
    catalogueClosingDate:x.rssClosingDate,
    catalogueEvidence:x.catalogueEvidence||(`Flux RSS officiel ADEME — échéance ${x.rssClosingDate||'non renseignée'}`),
    inventoryMode
  }));
  return{
    catalogue,
    inventoryMode,
    catalogueData:{
      ...(catalogueRaw||{}),
      links:catalogue,
      inventoryMode,
      htmlFound,
      htmlExpected:htmlExpected||null,
      expectedTotal:catalogue.length,
      rssActiveCount:rssActive.length,
      rssWithoutClosing:rssWithoutClosing.length,
      aapCount:catalogue.filter(x=>x.catalogueKind==='AAP / AMI').length,
      aidCount:catalogue.filter(x=>x.catalogueKind==='AIDE').length,
      unclassified:catalogue.filter(x=>!x.catalogueKind),
      pagesScanned:Number(catalogueRaw?.pagesScanned||0),
      discoveryErrors:Array.isArray(catalogueRaw?.discoveryErrors)?catalogueRaw.discoveryErrors:[]
    }
  };
}

export async function discoverAdeme(source,{log=console.log}={}){
  const [rss,catalogueRaw]=await Promise.all([
    rssLinks(source,{log}),
    catalogueLinks(source,{log})
  ]);

  const {catalogue,inventoryMode,catalogueData}=selectAdemeInventory(source,rss,catalogueRaw);
  if(inventoryMode==='RSS_ACTIVE_MIRROR'){
    log(`[${source.id}] catalogue HTML indisponible/incomplet (${catalogueData.htmlFound}/${catalogueData.htmlExpected||'?'}). Fallback officiel RSS actif: ${catalogue.length} dispositif(s).`);
  }
  const rssActive=rss.filter(x=>x.rssActive);
  const master=new Set(catalogue.map(x=>canonicalUrl(x.url)));
  const rssOutsideCatalogue=rssActive.filter(x=>!master.has(canonicalUrl(x.url)));
  log(`[${source.id}] ADEME inventaire officiel ${inventoryMode}: ${catalogue.length} fiche(s), dont ${catalogueData.aapCount} AAP et ${catalogueData.aidCount} aides. Contrôle RSS officiel: ${rssOutsideCatalogue.length} actif(s) hors inventaire.`);
  return{links:catalogue,rss,catalogueData,rssOutsideCatalogue,inventoryMode};
}

export async function collectAdeme(source,{log=console.log}={}){
  const discovered=await discoverAdeme(source,{log});
  const {links,rss,catalogueData,rssOutsideCatalogue,inventoryMode}=discovered;
  const out=await extractMany(source,links,{log,workers:12});
  return{
    aids:out.aids,
    discovered:links.length,
    audit:{
      discovered:links.length,
      imported:out.aids.length,
      excluded:out.excluded,
      errors:out.errors,
      detailWarnings:out.detailWarnings,
      accounted:out.aids.length+out.excluded.length+out.errors.length,
      channels:{
        rss:rss.length,
        rssActive:catalogueData.rssActiveCount||rss.filter(x=>x.rssActive).length,
        rssWithoutClosing:catalogueData.rssWithoutClosing||0,
        catalogue:links.length,
        catalogueMode:inventoryMode,
        catalogueExpected:catalogueData.expectedTotal,
        catalogueHtmlFound:catalogueData.htmlFound??catalogueData.links?.length??0,
        catalogueHtmlExpected:catalogueData.htmlExpected??null,
        cataloguePagesScanned:catalogueData.pagesScanned,
        catalogueAap:catalogueData.aapCount,
        catalogueAid:catalogueData.aidCount,
        catalogueUnclassified:catalogueData.unclassified.length,
        catalogueDiscoveryErrors:catalogueData.discoveryErrors.length,
        rssOutsideCatalogue:rssOutsideCatalogue.length,
        detailWarnings:out.detailWarnings.length
      },
      controlGaps:{rssOutsideCatalogue:rssOutsideCatalogue.map(x=>({url:x.url,label:x.label||''}))}
    },
    message:`ADEME ${inventoryMode}: ${links.length} dispositif(s) actifs, ${catalogueData.aapCount} AAP, ${catalogueData.aidCount} aides, ${out.aids.length} fiche(s) importée(s), ${out.excluded.length} exclusion(s), ${out.errors.length} erreur(s), ${out.detailWarnings.length} fiche(s) non enrichie(s)`
  };
}
