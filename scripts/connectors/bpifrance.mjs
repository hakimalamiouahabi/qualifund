import * as cheerio from 'cheerio';
import { XMLParser } from 'fast-xml-parser';
import { fetchText } from '../lib/http.mjs';
import { browserHtml } from '../lib/browser.mjs';
import { extractFromHtml } from '../lib/extract.mjs';
import { directPageId } from '../lib/direct-sources.mjs';
import { canonicalUrl, cleanTitle, safeUrl, norm } from '../lib/utils.mjs';

async function getHtml(url){
  try{return (await fetchText(url,{timeoutMs:30000,retries:2})).text}
  catch{return (await browserHtml(url,{timeoutMs:60000})).html}
}
function uniqueLinks(items=[]){
  const out=[],seen=new Set();
  for(const item of items){
    const url=canonicalUrl(item?.url||'');
    if(!url||seen.has(url))continue;
    seen.add(url);out.push({...item,url});
  }
  return out;
}
function linksWithPrefix(html,base,prefix){
  const $=cheerio.load(html),out=[];
  $('a[href]').each((_,a)=>{
    const url=safeUrl($(a).attr('href'),base);
    if(!url)return;
    const u=new URL(url);
    if(u.origin!==new URL(base).origin)return;
    const p=u.pathname.replace(/\/+$/,'');
    if(!p.startsWith(prefix)||p===prefix)return;
    out.push({url,label:cleanTitle($(a).text())});
  });
  return uniqueLinks(out);
}
function pageSignature(links=[]){return links.map(x=>x.url).sort().join('|')}
async function sitemapUrls(source,{log=console.log,maxSitemaps=80,maxUrls=50000}={}){
  const start=source.sitemapUrl||new URL('/sitemap.xml',source.url).href;
  const queue=[start],seenMaps=new Set(),urls=[];
  while(queue.length&&seenMaps.size<maxSitemaps&&urls.length<maxUrls){
    const mapUrl=queue.shift();if(seenMaps.has(mapUrl))continue;seenMaps.add(mapUrl);
    try{
      const xml=(await fetchText(mapUrl,{timeoutMs:25000,retries:2})).text;
      const locs=[...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map(m=>m[1].replace(/&amp;/g,'&').trim()).filter(Boolean);
      const child=/<sitemapindex\b/i.test(xml);
      if(child){for(const u of locs)if(!seenMaps.has(u))queue.push(u)}
      else urls.push(...locs);
    }catch(e){log(`[${source.id}] sitemap ignoré ${mapUrl}: ${e.message}`)}
  }
  return [...new Set(urls)].slice(0,maxUrls);
}

async function pagedPrefixLinks(source,prefix,{log=console.log,maxPages=80}={}){
  const all=[];let previous='',empty=0;
  for(let page=0;page<maxPages;page++){
    const url=source.url+(source.url.includes('?')?'&':'?')+'page='+page;
    const html=await getHtml(url),links=linksWithPrefix(html,url,prefix),sig=pageSignature(links);
    if(!links.length){empty++;if(empty>=2)break;continue}
    empty=0;all.push(...links);
    if(sig&&sig===previous&&page>1)break;
    previous=sig;
    const $=cheerio.load(html);
    const hasNext=$('a[href]').toArray().some(a=>{
      const href=safeUrl($(a).attr('href'),url)||'';
      return href.includes('page='+(page+1));
    });
    if(!hasNext&&page>0)break;
  }
  return uniqueLinks(all);
}

export async function discoverBpifranceCurrentAaps(source,{log=console.log,maxPages=50}={}){
  const prefix='/nos-appels-a-projets-concours';
  const listing=await pagedPrefixLinks(source,prefix,{log,maxPages});
  const sitemap=(await sitemapUrls(source,{log})).filter(u=>{
    try{const x=new URL(u);return x.hostname.endsWith('bpifrance.fr')&&x.pathname.startsWith(prefix+'/')}catch{return false}
  }).map(url=>({url,label:''}));
  const out=uniqueLinks([...listing,...sitemap]);
  log(`[${source.id}] ${out.length} AAP/AMI/concours uniques publiés (listing + sitemap officiel)`);
  return out;
}

function sectionLinks(html,base,sectionLabel){
  const $=cheerio.load(html),target=norm(sectionLabel),out=[];
  const headings=$('h1,h2,h3,h4').toArray();
  let h=headings.find(el=>norm($(el).text())===target||norm($(el).text()).includes(target));
  if(!h)return[];
  const level=Number(String(h.tagName||'h2').slice(1))||2;
  let node=$(h);
  while(true){
    node=node.next();
    if(!node.length)break;
    if(/^h[1-4]$/i.test(node[0]?.tagName||'')){
      const nextLevel=Number(String(node[0].tagName).slice(1))||9;
      if(nextLevel<=level)break;
    }
    node.find('a[href]').addBack('a[href]').each((_,a)=>{
      const url=safeUrl($(a).attr('href'),base);
      if(!url)return;
      const u=new URL(url),b=new URL(base);
      if(u.origin!==b.origin)return;
      if(!u.pathname.startsWith('/catalogue-offres/')||u.pathname==='/catalogue-offres/')return;
      out.push({url,label:cleanTitle($(a).text())});
    });
  }
  return uniqueLinks(out);
}

export async function discoverBpifranceCatalogueAids(source,{log=console.log}={}){
  const prefix='/catalogue-offres';
  const html=await getHtml(source.url);
  const section=sectionLinks(html,source.url,source.catalogueSection||'Subventions et avances remboursables');
  const paged=await pagedPrefixLinks(source,prefix,{log,maxPages:100});
  const sitemap=(await sitemapUrls(source,{log})).filter(u=>{
    try{const x=new URL(u);return x.hostname.endsWith('bpifrance.fr')&&x.pathname.startsWith(prefix+'/')}catch{return false}
  }).map(url=>({url,label:''}));
  const links=uniqueLinks([...section,...paged,...sitemap]);
  log(`[${source.id}] ${links.length} pages du catalogue officiel Bpifrance candidates avant qualification financière`);
  return links;
}

async function extractOne(source,link,kind){
  const html=await getHtml(link.url);
  const a=extractFromHtml(html,{url:link.url,sourceTier:'B',scope:'NATIONAL',region:null});
  const label=cleanTitle(link.label||'');
  if((!a.title||a.title.length<4)&&label)a.title=label;
  if(!a.title||a.title.length<4)return null;
  a.id=directPageId(source.id,canonicalUrl(link.url));
  a.canonicalId=a.id;
  a.sourceId=source.id;
  a.sourceRecordId=canonicalUrl(link.url);
  a.kind=kind;
  a.funder=['Bpifrance'];
  a.operator='Bpifrance';
  a.sourceLinks=[{label:'Page officielle Bpifrance',url:link.url},...(a.sourceLinks||[]).filter(x=>x?.url&&canonicalUrl(x.url)!==canonicalUrl(link.url))];
  return a;
}

async function extractMany(source,links,kind,{log=console.log,workers=8,predicate=null,excludeReason='hors périmètre'}={}){
  const aids=[],excluded=[],errors=[];let cursor=0;
  const pool=Array.from({length:workers},async()=>{
    while(true){
      const i=cursor++;if(i>=links.length)return;
      const link=links[i];
      try{
        const a=await extractOne(source,link,kind);
        if(!a){errors.push({url:link.url,label:link.label||'',reason:'EXTRACTION_VIDE'});continue}
        if(!predicate||predicate(a))aids.push(a);
        else excluded.push({url:link.url,title:a.title,aidTypes:a.aidTypes||[],reason:excludeReason});
      }catch(e){
        errors.push({url:link.url,label:link.label||'',reason:String(e?.message||e)});
        log(`[${source.id}] page ignorée ${link.url}: ${e.message}`);
      }
    }
  });
  await Promise.all(pool);
  return {aids,excluded,errors};
}

export async function collectBpifranceAaps(source,{log=console.log}={}){
  const links=await discoverBpifranceCurrentAaps(source,{log});
  const out=await extractMany(source,links,'AAP / AMI',{log});
  return {
    aids:out.aids,
    discovered:links.length,
    audit:{discovered:links.length,imported:out.aids.length,excluded:out.excluded,errors:out.errors,accounted:out.aids.length+out.excluded.length+out.errors.length},
    message:`Bpifrance AAP: ${links.length} publiés, ${out.aids.length} extraits, ${out.errors.length} erreurs`
  };
}

export async function collectBpifranceAids(source,{log=console.log}={}){
  const links=await discoverBpifranceCatalogueAids(source,{log});
  const target=new Set(['SUBVENTION','AVANCE_REMBOURSABLE','PRET_TAUX_ZERO']);
  const out=await extractMany(source,links,'AIDE',{
    log,
    predicate:a=>a.aidTypes?.some(t=>target.has(t)),
    excludeReason:'INSTRUMENT_HORS_PERIMETRE_SUB_AR_PTZ'
  });
  return {
    aids:out.aids,
    discovered:links.length,
    audit:{discovered:links.length,imported:out.aids.length,excluded:out.excluded,errors:out.errors,accounted:out.aids.length+out.excluded.length+out.errors.length},
    message:`Bpifrance catalogue: ${links.length} pages officielles inspectées, ${out.aids.length} aides retenues, ${out.excluded.length} hors périmètre, ${out.errors.length} erreurs`
  };
}
