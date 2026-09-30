import * as cheerio from 'cheerio';
import { XMLParser } from 'fast-xml-parser';
import { fetchText } from '../lib/http.mjs';
import { browserHtml } from '../lib/browser.mjs';
import { extractFromHtml } from '../lib/extract.mjs';
import { directPageId } from '../lib/direct-sources.mjs';
import { canonicalUrl, cleanTitle, safeUrl, norm, uniq } from '../lib/utils.mjs';

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
  const out=[],seen=new Set();
  for(const item of items){
    const url=canonicalUrl(item?.url||'');
    if(!url||!isAidUrl(url)||seen.has(url))continue;
    seen.add(url);out.push({url,label:cleanTitle(item?.label||'')});
  }
  return out;
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

export function parseAdemeCatalogueHtml(html,base){
  const $=cheerio.load(html),aids=[],pages=[];
  $('a[href]').each((_,a)=>{
    const url=safeUrl($(a).attr('href'),base);
    if(!url)return;
    const label=cleanTitle($(a).text()||$(a).attr('title')||'');
    if(isAidUrl(url))aids.push({url,label});
    try{
      const u=new URL(url),b=new URL(base);
      if(u.origin!==b.origin)return;
      if(u.pathname.replace(/\/+$/,'')!=='/entreprises/aides-financieres/catalogue')return;
      if(u.searchParams.has('page'))pages.push(u.href);
    }catch{}
  });
  return{aids:uniqueLinks(aids),pages:[...new Set(pages)]};
}

async function catalogueLinks(source,{log=console.log,maxPages=80}={}){
  const queue=[source.url],seenPages=new Set(),found=[];
  while(queue.length&&seenPages.size<maxPages){
    const pageUrl=queue.shift();
    if(seenPages.has(pageUrl))continue;
    seenPages.add(pageUrl);
    let loaded;
    try{loaded=await getHtml(pageUrl)}
    catch(e){log(`[${source.id}] catalogue ignoré ${pageUrl}: ${e.message}`);continue}
    let parsed=parseAdemeCatalogueHtml(loaded.html,loaded.finalUrl||pageUrl);
    if(!parsed.aids.length){
      try{
        const rendered=await browserHtml(pageUrl,{
          timeoutMs:65000,
          waitForSelector:'a[href*="/entreprises/aides-financieres/catalogue/"]',
          waitAfterMs:1800
        });
        const browserParsed=parseAdemeCatalogueHtml(rendered.html,rendered.url||pageUrl);
        if(browserParsed.aids.length||browserParsed.pages.length){
          parsed=browserParsed;
          log(`[${source.id}] catalogue rendu navigateur ${pageUrl}: ${browserParsed.aids.length} fiche(s)`);
        }
      }catch(e){
        log(`[${source.id}] rendu navigateur catalogue indisponible ${pageUrl}: ${e.message}`);
      }
    }
    const {aids,pages}=parsed;
    found.push(...aids);
    for(const u of pages)if(!seenPages.has(u))queue.push(u);
    if(seenPages.size===1&&!pages.length){
      // Drupal expose parfois la pagination uniquement après rendu JS.
      for(let p=0;p<12;p++)queue.push(source.url+(source.url.includes('?')?'&':'?')+'page='+p);
    }
  }
  const out=uniqueLinks(found);
  log(`[${source.id}] catalogue officiel ADEME: ${out.length} URLs uniques`);
  return out;
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
    if(delta!=null&&delta>=-60)return{state:'RECENTLY_CLOSED',date:last,evidence:closed,retain:true};
    return{state:'CLOSED_OLD',date:last,evidence:closed,retain:false};
  }
  if(delta!=null&&delta>=0)return{state:'OPEN',date:last,evidence:open||('Échéance officielle '+last),retain:true};
  if(delta!=null&&delta>=-60)return{state:'RECENTLY_CLOSED',date:last,evidence:open||('Échéance officielle '+last),retain:true};
  if(permanent&&a?.permanent)return{state:'PERMANENT',date:null,evidence:permanent,retain:true};
  if(open)return{state:'OPEN_UNDATED',date:null,evidence:open,retain:true};
  if(delta!=null)return{state:'CLOSED_OLD',date:last,evidence:'Échéance officielle '+last,retain:false};
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
    log(\`[\${source.id}] contre-audit multi-moteurs: \${links.length} URL(s) candidate(s)\`);
    return links;
  }catch(e){
    log(\`[\${source.id}] contre-audit externe indisponible: \${e.message}\`);
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

  const attribution=ademeAttributionEvidence(text);
  if(!attribution){
    return{aid:null,excluded:{url:link.url,label:a.title,reason:'ATTRIBUTION_ADEME_NON_PROUVEE',resolvedUrl:resolved}};
  }
  const beneficiary=beneficiaryEvidence(a,text);
  if(!beneficiary){
    return{aid:null,excluded:{url:link.url,label:a.title,reason:'HORS_CIBLE_ENTREPRISE',resolvedUrl:resolved}};
  }
  const status=ademeStatusProof(a,text);
  if(!status.retain){
    return{aid:null,excluded:{url:link.url,label:a.title,reason:status.state==='CLOSED_OLD'?'CLOTURE_HORS_FENETRE_J60':'STATUT_ACTUEL_NON_PROUVE',resolvedUrl:resolved,status:status.state,date:status.date}};
  }

  const territory=inferRegionsFromEvidence(text);
  a.id=directPageId(source.id,requested);
  a.canonicalId=a.id;
  a.sourceId=source.id;
  a.sourceRecordId=requested;
  a.kind=/\/aap\//i.test(requested)||/\b(?:aap|ami|appel a projets?|appel à projets?|appel a manifestation|appel à manifestation|appel d'offres)\b/i.test(a.title)?'AAP / AMI':'AIDE';
  a.funder=['ADEME'];
  a.operator='ADEME';
  a.guichetVerified='ADEME';
  a.enterpriseEligible=true;
  a.sourceState=status.state;
  a.scope=territory.regions.length?'REGIONAL':'NATIONAL';
  a.regions=territory.regions.length?territory.regions:['Toutes les Régions'];
  a.sourceLinks=[{label:'Page officielle ADEME',url:requested},...(a.sourceLinks||[]).filter(x=>x?.url&&canonicalUrl(x.url)!==requested)];
  const extra=[
    {field:'guichet',sourceUrl:requested,sourceTier:'B',locator:'page-text-match:ademe-attribution',evidenceText:attribution.slice(0,850),checkedAt:new Date().toISOString()},
    {field:'sourceStatus',sourceUrl:requested,sourceTier:'B',locator:'page-text-match:status',evidenceText:String(status.evidence||status.state).slice(0,850),checkedAt:new Date().toISOString()},
    {field:'enterpriseEligibility',sourceUrl:requested,sourceTier:'B',locator:'section:beneficiaries',evidenceText:String(beneficiary).slice(0,850),checkedAt:new Date().toISOString()}
  ];
  if(territory.evidence)extra.push({field:'territory',sourceUrl:requested,sourceTier:'B',locator:'page-text-match:territory',evidenceText:territory.evidence.slice(0,850),checkedAt:new Date().toISOString()});
  a.verification={...(a.verification||{}),fieldEvidence:[...(a.verification?.fieldEvidence||[]),...extra]};
  a.guichetVerification={status:'VERIFIED',sourceUrl:requested,evidenceText:attribution.slice(0,850),checkedAt:new Date().toISOString()};
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
  const [rss,catalogue,externalAudit]=await Promise.all([
    rssLinks(source,{log}),
    catalogueLinks(source,{log}),
    externalAuditLinks(source,{log})
  ]);
  const links=uniqueLinks([...catalogue,...rss,...externalAudit]);
  log(`[${source.id}] ADEME v2: ${links.length} URL(s) officielles candidates (${rss.length} RSS, ${catalogue.length} catalogue, ${externalAudit.length} contre-audit)`);
  return{links,rss,catalogue,externalAudit};
}

export async function collectAdeme(source,{log=console.log}={}){
  const discovered=await discoverAdeme(source,{log});
  const {links,rss,catalogue,externalAudit}=discovered;
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
      channels:{rss:rss.length,catalogue:catalogue.length,externalAudit:externalAudit.length}
    },
    message:`ADEME v2: ${links.length} URL(s) candidates, ${out.aids.length} fiche(s) validée(s), ${out.excluded.length} exclusion(s) motivée(s), ${out.errors.length} erreur(s)`
  };
}
