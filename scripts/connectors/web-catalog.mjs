import { directPageId } from '../lib/direct-sources.mjs';
import * as cheerio from 'cheerio';
import { XMLParser } from 'fast-xml-parser';
import { fetchText, fetchBuffer } from '../lib/http.mjs';
import { browserHtml } from '../lib/browser.mjs';
import { extractFromHtml, extractFromPdf } from '../lib/extract.mjs';
import { mergeAid } from '../lib/merge.mjs';
import { cleanTitle, safeUrl, canonicalUrl } from '../lib/utils.mjs';
import { relevantLink, isPaginationLink } from '../lib/catalog-links.mjs';
async function getHtml(source,url){try{return (await fetchText(url,{timeoutMs:25000,retries:2})).text}catch(e){if(source.edgeFallback||source.browserFallback!==false)return (await browserHtml(url,{timeoutMs:45000})).html;throw e}}
async function sitemapLinks(source){try{const origin=new URL(source.url).origin,xml=(await fetchText(origin+'/sitemap.xml',{timeoutMs:18000,retries:1})).text,locs=[...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map(m=>m[1].replace(/&amp;/g,'&'));const candidates=[];for(const u of locs.slice(0,50000)){if(relevantLink(source,'',u))candidates.push({url:u,label:''})}return candidates}catch{return[]}}
export function parseRssLinks(xml,source){
  const feed=new XMLParser({ignoreAttributes:false}).parse(xml);
  const items=feed?.rss?.channel?.item||feed?.feed?.entry||[];
  return (Array.isArray(items)?items:[items]).map(item=>({
    url:typeof item.link==='string'?item.link:item.link?.['@_href']||'',
    label:String(item.title||'')
  })).filter(x=>x.url&&relevantLink(source,x.label,x.url));
}
async function rssLinks(source){if(!source.rssUrl)return[];try{return parseRssLinks((await fetchText(source.rssUrl,{timeoutMs:18000,retries:1})).text,source)}catch{return[]}}
async function renderedCatalogLinks(source){
  if(source.browserFallback===false)return[];
  try{
    const {html}=await browserHtml(source.url,{timeoutMs:60000});
    const $=cheerio.load(html),out=[];
    if(source.catalogLinkSelector){
      $(source.catalogLinkSelector).each((_,a)=>{
        const u=safeUrl($(a).attr('href'),source.url),label=cleanTitle($(a).text());
        if(u&&u.startsWith('http')&&u!==source.url)out.push({url:u,label});
      });
    }
    $('a[href]').each((_,a)=>{
      const u=safeUrl($(a).attr('href'),source.url),label=cleanTitle($(a).text());
      if(u&&u.startsWith('http')&&u!==source.url&&relevantLink(source,label,u))out.push({url:u,label});
    });
    return out;
  }catch{return[]}
}
function unusableTitle(v=''){
  const t=cleanTitle(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  return !t||t.length<4||/(desole.*offre.*plus disponible|offre.*plus disponible|document officiel|page introuvable|page non trouvee|erreur 404|404 not found|access denied|forbidden|service indisponible|site en maintenance)/i.test(t);
}
async function extractOne(source,l){
  const h=await getHtml(source,l.url);
  const a=extractFromHtml(h,{url:l.url,sourceTier:'B',scope:source.scope==='France'?'NATIONAL':'REGIONAL',region:source.scope==='France'?null:source.scope});
  const label=cleanTitle(l.label||'');
  if(unusableTitle(a.title)&&!unusableTitle(label))a.title=label;
  if(unusableTitle(a.title))return null;
  a.id=directPageId(source.id,canonicalUrl(l.url));
  a.canonicalId=a.id;
  a.sourceId=source.id;
  a.kind=/appel|aap|ami/i.test(`${l.label} ${a.title}`)?'AAP / AMI':'AIDE';
  a.funder=[source.name.replace(/ —.*/, '')];
  // Ne pas télécharger les PDF ici : la phase collecte doit rester exhaustive et rapide.
  // Les liens documentaires restent attachés à la fiche et seront traités par enrichAid().
  return a;
}
export async function collectWebCatalog(source,{log=console.log,maxItems=1200}={}){const links=(source.seedUrls||[]).map(url=>({url,label:''})),pageQueue=[source.url],pageSeen=new Set();while(pageQueue.length&&pageSeen.size<60){const pageUrl=pageQueue.shift();if(pageSeen.has(pageUrl))continue;pageSeen.add(pageUrl);const html=await getHtml(source,pageUrl),$=cheerio.load(html);if(source.catalogLinkSelector){$(source.catalogLinkSelector).each((_,a)=>{const u=safeUrl($(a).attr('href'),pageUrl),label=cleanTitle($(a).text());if(u&&u.startsWith('http')&&u!==pageUrl)links.push({url:u,label})})}$('a[href]').each((_,a)=>{const u=safeUrl($(a).attr('href'),pageUrl),label=cleanTitle($(a).text());if(!u||!u.startsWith('http'))return;if(relevantLink(source,label,u)&&u!==pageUrl)links.push({url:u,label});const sameOrigin=new URL(u).origin===new URL(source.url).origin,pag=isPaginationLink(label,u);if(sameOrigin&&pag&&!pageSeen.has(u))pageQueue.push(u)})}if(links.length<Math.max(5,source.minExpected||0)){const rendered=await renderedCatalogLinks(source);links.push(...rendered);if(rendered.length)log(`[${source.id}] navigateur rendu +${rendered.length}`);const sm=await sitemapLinks(source);links.push(...sm);if(sm.length)log(`[${source.id}] sitemap +${sm.length}`);const rss=await rssLinks(source);links.push(...rss);if(rss.length)log(`[${source.id}] RSS officiel +${rss.length}`)}const unique=[],seen=new Set();for(const l of links){const key=canonicalUrl(l.url);if(!key||seen.has(key))continue;seen.add(key);unique.push(l);if(unique.length>=maxItems)break}log(`[${source.id}] ${unique.length} pages candidates`);const aids=[];let cursor=0;const workers=Array.from({length:8},async()=>{while(true){const i=cursor++;if(i>=unique.length)return;const l=unique[i];try{const a=await extractOne(source,l);if(a)aids.push(a)}catch(e){log(`[${source.id}] page ignorée ${l.url}: ${e.message}`)}}});await Promise.all(workers);return{aids,discovered:unique.length,message:`${unique.length} pages candidates, ${aids.length} fiches extraites`}}

