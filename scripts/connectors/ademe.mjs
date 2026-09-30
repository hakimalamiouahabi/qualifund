import * as cheerio from 'cheerio';
import { XMLParser } from 'fast-xml-parser';
import { fetchText } from '../lib/http.mjs';
import { browserHtml } from '../lib/browser.mjs';
import { extractFromHtml } from '../lib/extract.mjs';
import { directPageId } from '../lib/direct-sources.mjs';
import { canonicalUrl, cleanTitle, safeUrl, norm, uniq } from '../lib/utils.mjs';

const REGIONS=[
  'Auvergne-Rhône-Alpes','Bourgogne-Franche-Comté','Bretagne','Centre-Val de Loire','Corse',
  'Grand Est','Hauts-de-France','Île-de-France','Normandie','Nouvelle-Aquitaine','Occitanie',
  'Pays de la Loire',"Provence-Alpes-Côte d'Azur",'Guadeloupe','Guyane','Martinique','La Réunion','Mayotte'
];

async function getHtml(url){
  try{return (await fetchText(url,{timeoutMs:30000,retries:2})).text}
  catch{return (await browserHtml(url,{timeoutMs:65000})).html}
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

function pageLinks(html,base){
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
    let html;
    try{html=await getHtml(pageUrl)}
    catch(e){log(`[${source.id}] catalogue ignoré ${pageUrl}: ${e.message}`);continue}
    const {aids,pages}=pageLinks(html,pageUrl);
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

function inferRegions(a){
  const text=norm([a.title,a.objective,a.beneficiaries,a.prerequisites,a.selectionCriteria,...(a.projectsExpected||[])].filter(Boolean).join(' '));
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
    ['Guadeloupe',['guadeloupe']],
    ['Guyane',['guyane']],
    ['Martinique',['martinique']],
    ['La Réunion',['la reunion','reunion']],
    ['Mayotte',['mayotte']]
  ];
  return uniq(aliases.filter(([,xs])=>xs.some(x=>text.includes(x))).map(([r])=>r)).filter(r=>REGIONS.includes(r));
}

async function extractOne(source,link){
  const html=await getHtml(link.url);
  const a=extractFromHtml(html,{url:link.url,sourceTier:'B',scope:'NATIONAL',region:null});
  const label=cleanTitle(link.label||'');
  if((!a.title||a.title.length<4)&&label)a.title=label;
  if(!a.title||a.title.length<4)return null;
  const regions=inferRegions(a);
  a.id=directPageId(source.id,canonicalUrl(link.url));
  a.canonicalId=a.id;
  a.sourceId=source.id;
  a.sourceRecordId=canonicalUrl(link.url);
  a.kind=/\/aap\//i.test(link.url)||/\b(?:aap|ami|appel a projets?|appel à projets?|appel a manifestation|appel à manifestation|appel d'offres)\b/i.test(a.title)?'AAP / AMI':'AIDE';
  a.funder=['ADEME'];
  a.operator='ADEME';
  a.scope=regions.length?'REGIONAL':'NATIONAL';
  a.regions=regions.length?regions:['Toutes les Régions'];
  a.sourceLinks=[{label:'Page officielle ADEME',url:link.url},...(a.sourceLinks||[]).filter(x=>x?.url&&canonicalUrl(x.url)!==canonicalUrl(link.url))];
  return a;
}

async function extractMany(source,links,{log=console.log,workers=8}={}){
  const aids=[],errors=[];let cursor=0;
  const pool=Array.from({length:workers},async()=>{
    while(true){
      const i=cursor++;if(i>=links.length)return;
      const link=links[i];
      try{
        const a=await extractOne(source,link);
        if(a)aids.push(a);else errors.push({url:link.url,label:link.label||'',reason:'EXTRACTION_VIDE'});
      }catch(e){
        errors.push({url:link.url,label:link.label||'',reason:String(e?.message||e)});
        log(`[${source.id}] fiche ignorée ${link.url}: ${e.message}`);
      }
    }
  });
  await Promise.all(pool);
  return{aids,errors};
}

export async function discoverAdeme(source,{log=console.log}={}){
  const [rss,catalogue]=await Promise.all([rssLinks(source,{log}),catalogueLinks(source,{log})]);
  const links=uniqueLinks([...catalogue,...rss]);
  log(`[${source.id}] ADEME: ${links.length} fiches officielles uniques découvertes (${rss.length} via RSS, ${catalogue.length} via catalogue)`);
  return links;
}

export async function collectAdeme(source,{log=console.log}={}){
  const links=await discoverAdeme(source,{log});
  const out=await extractMany(source,links,{log,workers:8});
  return{
    aids:out.aids,
    discovered:links.length,
    audit:{
      discovered:links.length,
      imported:out.aids.length,
      excluded:[],
      errors:out.errors,
      accounted:out.aids.length+out.errors.length
    },
    message:`ADEME officiel: ${links.length} fiches découvertes, ${out.aids.length} extraites, ${out.errors.length} erreurs`
  };
}
