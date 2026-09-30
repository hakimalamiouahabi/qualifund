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

export function parseAdemeRss(xml){
  const feed=new XMLParser({ignoreAttributes:false,trimValues:true}).parse(xml);
  const items=feed?.rss?.channel?.item||[];
  return uniqueLinks((Array.isArray(items)?items:[items]).map(item=>({
    url:typeof item.link==='string'?item.link:item.link?.['#text']||'',
    label:String(item.title||'')
  })));
}

async function rssLinks(source,{log=console.log}={}){
  if(!source.rssUrl)return[];
  try{
    const xml=(await fetchText(source.rssUrl,{timeoutMs:25000,retries:2})).text;
    const links=parseAdemeRss(xml);
    log(`[${source.id}] RSS officiel ADEME: ${links.length} fiches`);
    return links;
  }catch(e){
    log(`[${source.id}] RSS indisponible: ${e.message}`);
    return[];
  }
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
    const dates=detectDates(raw);
    return{
      catalogueKind,
      catalogueStatus:status,
      catalogueClosingDate:status?(dates.at(-1)||null):null,
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
      log(\`[\${source.id}] catalogue inaccessible \${pageUrl}: \${e.message}\`);
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
          log(\`[\${source.id}] catalogue rendu navigateur \${pageUrl}: \${browserParsed.aids.length} fiche(s)\`);
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
  log(\`[\${source.id}] catalogue maître ADEME: \${links.length}/\${expectedTotal??'?'} URL(s), dont \${aapCount} AAP et \${aidCount} aides\`);
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
    /(?:appel\s+[àa]\s+projets?|appel\s+d['’]offres?|dispositif|aide)[^.;]{0,100}(?:maintenant\s+clos|est\s+clos|est\s+cl[oô]tur[eé]|n['’]est\s+plus\s+ouvert)/i,
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

async function externalAuditLinks(source,{log=console.log}={}){
  if(!source.externalAuditFile)return[];
  try{
    const root=new URL('../../',import.meta.url);
    const file=new URL(source.externalAuditFile,root);
    const {readFile}=await import('node:fs/promises');
    const audit=JSON.parse(await readFile(file,'utf8'));
    const links=uniqueLinks((audit.candidates||[]).map(x=>({url:x.url,label:x.title||''})));
    log(`[${source.id}] contre-audit multi-moteurs: ${links.length} URL(s) candidate(s)`);
    return links;
  }catch(e){
    log(`[${source.id}] contre-audit externe indisponible: ${e.message}`);
    return[];
  }
}

async function extractOne(source,link){
  const loaded=await getHtml(link.url);
  const requested=canonicalUrl(link.url),resolved=canonicalUrl(loaded.finalUrl||link.url);
  if(!isAidUrl(resolved)){
    return{aid:null,excluded:{url:link.url,label:link.label||'',reason:'REDIRECTION_HORS_FICHE',resolvedUrl:resolved||loaded.finalUrl||''}};
  }
  if(requested!==resolved){
    return{aid:null,excluded:{url:link.url,label:link.label||'',reason:'REDIRECTION_VERS_AUTRE_FICHE',resolvedUrl:resolved}};
  }
  if(!link.catalogueKind){
    return{aid:null,excluded:{url:link.url,label:link.label||'',reason:'TYPE_CATALOGUE_NON_CLASSE',resolvedUrl:resolved}};
  }

  const text=pageText(loaded.html);
  const a=extractFromHtml(loaded.html,{url:requested,sourceTier:'B',scope:'NATIONAL',region:null});
  const rawTitle=cleanTitle(a.title||'');
  if(/(?:désolé.*offre.*plus disponible|desole.*offre.*plus disponible|page introuvable|page non trouvée|erreur 404|404 not found|access denied|forbidden|service indisponible)/i.test(rawTitle)){
    return{aid:null,excluded:{url:link.url,label:link.label||'',reason:'FICHE_INDISPONIBLE',resolvedUrl:resolved}};
  }
  const label=cleanTitle(link.label||'');
  if(label&&label.length>=4)a.title=label;
  if(!a.title||a.title.length<4){
    return{aid:null,excluded:{url:link.url,label:link.label||'',reason:'TITRE_ABSENT',resolvedUrl:resolved}};
  }

  // Le catalogue Entreprises actif est le référentiel maître. La présence de la carte
  // constitue la preuve ADEME + entreprise + actif ; la fiche directe enrichit les critères.
  const directStatus=ademeStatusProof(a,text);
  if(['STATUS_CONFLICT','CLOSED_OLD','RECENTLY_CLOSED'].includes(directStatus.state)){
    return{aid:null,excluded:{url:link.url,label:a.title,reason:'CONFLIT_STATUT_CATALOGUE_FICHE',resolvedUrl:resolved,status:directStatus.state,date:directStatus.date}};
  }
  const territory=inferRegionsFromEvidence(text);
  const closing=link.catalogueClosingDate||directStatus.date||a.finalClosingDate||a.closingDate||null;
  a.id=directPageId(source.id,requested);
  a.canonicalId=a.id;
  a.sourceId=source.id;
  a.sourceRecordId=requested;
  a.kind=link.catalogueKind;
  a.funder=['ADEME'];
  a.operator='ADEME';
  a.guichetVerified='ADEME';
  a.enterpriseEligible=true;
  a.catalogueVerified=true;
  a.catalogueKind=link.catalogueKind;
  a.catalogueStatus=link.catalogueStatus||'OPEN';
  a.sourceState='OPEN';
  if(closing){
    a.finalClosingDate=closing;
    a.closingDate=closing;
    a.deadlines=uniq([...(a.deadlines||[]),closing]).sort();
  }
  a.scope=territory.regions.length?'REGIONAL':'NATIONAL';
  a.regions=territory.regions.length?territory.regions:['Toutes les Régions'];
  a.sourceLinks=[{label:'Page officielle ADEME',url:requested},...(a.sourceLinks||[]).filter(x=>x?.url&&canonicalUrl(x.url)!==requested)];
  const checkedAt=new Date().toISOString();
  const membershipEvidence=link.catalogueEvidence||(\`Présent dans le catalogue officiel ADEME Entreprises — \${link.catalogueKind}\`);
  const extra=[
    {field:'catalogueMembership',sourceUrl:source.url,sourceTier:'B',locator:'catalogue-card',evidenceText:membershipEvidence.slice(0,850),checkedAt},
    {field:'guichet',sourceUrl:source.url,sourceTier:'B',locator:'catalogue-master',evidenceText:'Catalogue officiel des aides financières de l’ADEME pour les entreprises',checkedAt},
    {field:'sourceStatus',sourceUrl:source.url,sourceTier:'B',locator:'catalogue-card-status',evidenceText:(link.catalogueEvidence||'Dispositif présent dans le catalogue actif').slice(0,850),checkedAt},
    {field:'enterpriseEligibility',sourceUrl:source.url,sourceTier:'B',locator:'catalogue-entreprises',evidenceText:'Référencé dans le catalogue ADEME Entreprises',checkedAt},
    {field:'catalogueKind',sourceUrl:source.url,sourceTier:'B',locator:'catalogue-card-type',evidenceText:link.catalogueKind,checkedAt}
  ];
  if(territory.evidence)extra.push({field:'territory',sourceUrl:requested,sourceTier:'B',locator:'page-text-match:territory',evidenceText:territory.evidence.slice(0,850),checkedAt});
  a.verification={...(a.verification||{}),fieldEvidence:[...(a.verification?.fieldEvidence||[]),...extra]};
  a.guichetVerification={status:'VERIFIED',sourceUrl:source.url,evidenceText:membershipEvidence.slice(0,850),checkedAt};
  return{aid:a,excluded:null};
}

async function extractMany(source,links,{log=console.log,workers=8}={}){
  const aids=[],errors=[],excluded=[];let cursor=0;
  const pool=Array.from({length:workers},async()=>{
    while(true){
      const i=cursor++;if(i>=links.length)return;
      const link=links[i];
      try{
        const item=await extractOne(source,link);
        if(item?.aid)aids.push(item.aid);
        else if(item?.excluded)excluded.push(item.excluded);
        else errors.push({url:link.url,label:link.label||'',reason:'EXTRACTION_VIDE'});
      }catch(e){
        errors.push({url:link.url,label:link.label||'',reason:String(e?.message||e)});
        log(`[${source.id}] fiche ignorée ${link.url}: ${e.message}`);
      }
    }
  });
  await Promise.all(pool);
  return{aids,errors,excluded};
}

export async function discoverAdeme(source,{log=console.log}={}){
  const [rss,catalogueData,externalAudit]=await Promise.all([
    rssLinks(source,{log}),
    catalogueLinks(source,{log}),
    externalAuditLinks(source,{log})
  ]);
  const catalogue=catalogueData.links;
  const master=new Set(catalogue.map(x=>canonicalUrl(x.url)));
  const rssOutsideCatalogue=rss.filter(x=>!master.has(canonicalUrl(x.url)));
  const externalOutsideCatalogue=externalAudit.filter(x=>!master.has(canonicalUrl(x.url)));
  log(\`[\${source.id}] ADEME catalogue maître: \${catalogue.length} fiche(s), dont \${catalogueData.aapCount} AAP. Contrôles: \${rssOutsideCatalogue.length} RSS hors catalogue, \${externalOutsideCatalogue.length} candidats externes hors catalogue.\`);
  return{links:catalogue,rss,catalogueData,externalAudit,rssOutsideCatalogue,externalOutsideCatalogue};
}

export async function collectAdeme(source,{log=console.log}={}){
  const discovered=await discoverAdeme(source,{log});
  const {links,rss,catalogueData,externalAudit,rssOutsideCatalogue,externalOutsideCatalogue}=discovered;
  const out=await extractMany(source,links,{log,workers:8});
  return{
    aids:out.aids,
    discovered:links.length,
    audit:{
      discovered:links.length,
      imported:out.aids.length,
      excluded:out.excluded,
      errors:out.errors,
      accounted:out.aids.length+out.excluded.length+out.errors.length,
      channels:{
        rss:rss.length,
        catalogue:links.length,
        catalogueExpected:catalogueData.expectedTotal,
        cataloguePagesScanned:catalogueData.pagesScanned,
        catalogueAap:catalogueData.aapCount,
        catalogueAid:catalogueData.aidCount,
        catalogueUnclassified:catalogueData.unclassified.length,
        catalogueDiscoveryErrors:catalogueData.discoveryErrors.length,
        externalAudit:externalAudit.length,
        rssOutsideCatalogue:rssOutsideCatalogue.length,
        externalOutsideCatalogue:externalOutsideCatalogue.length
      },
      controlGaps:{
        rssOutsideCatalogue:rssOutsideCatalogue.map(x=>({url:x.url,label:x.label||''})),
        externalOutsideCatalogue:externalOutsideCatalogue.map(x=>({url:x.url,label:x.label||''}))
      }
    },
    message:\`ADEME catalogue maître: \${links.length} dispositif(s), \${catalogueData.aapCount} AAP, \${catalogueData.aidCount} aides, \${out.aids.length} fiche(s) extraites, \${out.excluded.length} exclusion(s), \${out.errors.length} erreur(s)\`
  };
}
