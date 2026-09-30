import * as cheerio from 'cheerio';
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

export async function discoverBpifranceCurrentAaps(source,{log=console.log,maxPages=50}={}){
  const prefix='/nos-appels-a-projets-concours';
  const all=[];let previous='',empty=0;
  for(let page=0;page<maxPages;page++){
    const url=source.url+(source.url.includes('?')?'&':'?')+'page='+page;
    const html=await getHtml(url);
    const links=linksWithPrefix(html,url,prefix);
    const sig=pageSignature(links);
    if(!links.length){empty++;if(empty>=2)break;continue}
    empty=0;
    all.push(...links);
    if(sig&&sig===previous&&page>1)break;
    previous=sig;
    const $=cheerio.load(html);
    const hasNext=$('a[href]').toArray().some(a=>{
      const href=safeUrl($(a).attr('href'),url)||'';
      return href.includes('page='+(page+1));
    });
    if(!hasNext&&page>0)break;
  }
  const out=uniqueLinks(all);
  log(`[${source.id}] ${out.length} AAP/AMI/concours uniques actuellement publiés`);
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
  const html=await getHtml(source.url);
  let links=sectionLinks(html,source.url,source.catalogueSection||'Subventions et avances remboursables');
  if(links.length<10){
    const $=cheerio.load(html);
    const candidates=[];
    $('a[href]').each((_,a)=>{
      const url=safeUrl($(a).attr('href'),source.url),label=cleanTitle($(a).text());
      if(!url)return;
      const u=new URL(url);
      if(u.origin!==new URL(source.url).origin||!u.pathname.startsWith('/catalogue-offres/')||u.pathname==='/catalogue-offres/')return;
      const s=norm(label+' '+u.pathname);
      if(/aide|subvention|avance innovation|bourse french tech|pret a taux zero|ptzi|pi rd|innovation rd|concours innovation|france 2030 regionalise|eureka|eurostars|innowwide|horizon europe|french tech tremplin/.test(s))candidates.push({url,label});
    });
    links=uniqueLinks(candidates);
  }
  log(`[${source.id}] ${links.length} aides Bpifrance détectées dans le catalogue officiel`);
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

async function extractMany(source,links,kind,{log=console.log,workers=8}={}){
  const aids=[];let cursor=0;
  const pool=Array.from({length:workers},async()=>{
    while(true){
      const i=cursor++;if(i>=links.length)return;
      try{const a=await extractOne(source,links[i],kind);if(a)aids.push(a)}
      catch(e){log(`[${source.id}] page ignorée ${links[i].url}: ${e.message}`)}
    }
  });
  await Promise.all(pool);
  return aids;
}

export async function collectBpifranceAaps(source,{log=console.log}={}){
  const links=await discoverBpifranceCurrentAaps(source,{log});
  const aids=await extractMany(source,links,'AAP / AMI',{log});
  return {aids,discovered:links.length,message:`Bpifrance AAP: ${links.length} publiés, ${aids.length} extraits`};
}

export async function collectBpifranceAids(source,{log=console.log}={}){
  const links=await discoverBpifranceCatalogueAids(source,{log});
  const aids=await extractMany(source,links,'AIDE',{log});
  return {aids,discovered:links.length,message:`Bpifrance aides: ${links.length} publiées, ${aids.length} extraites`};
}
