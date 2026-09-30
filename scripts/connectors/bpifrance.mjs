import * as cheerio from 'cheerio';
import { fetchText } from '../lib/http.mjs';
import { browserHtml } from '../lib/browser.mjs';
import { extractFromHtml } from '../lib/extract.mjs';
import { directPageId } from '../lib/direct-sources.mjs';
import { canonicalUrl, cleanTitle, safeUrl, norm, uniq, detectDates } from '../lib/utils.mjs';

const AAP_PREFIX='/nos-appels-a-projets-concours';
const CATALOGUE_PREFIX='/catalogue-offres';

async function getHtml(url){
  try{
    const r=await fetchText(url,{timeoutMs:25000,retries:2,headers:{
      'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36',
      'accept-language':'fr-FR,fr;q=0.9'
    }});
    return{html:r.text,finalUrl:r.url||url,via:'http'};
  }catch{
    const r=await browserHtml(url,{timeoutMs:60000});
    return{html:r.html,finalUrl:r.url||url,via:'browser'};
  }
}

function uniqueLinks(items=[]){
  const by=new Map();
  for(const item of items){
    const url=canonicalUrl(item?.url||'');
    if(!url)continue;
    const prev=by.get(url)||{url,label:''};
    by.set(url,{
      ...prev,...item,url,
      label:cleanTitle(item?.label||prev.label||''),
      openingDate:item?.openingDate||prev.openingDate||null,
      closingDate:item?.closingDate||prev.closingDate||null,
      listingEvidence:item?.listingEvidence||prev.listingEvidence||null
    });
  }
  return [...by.values()];
}

function parisDateIso(now=new Date()){
  return new Intl.DateTimeFormat('en-CA',{
    timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'
  }).format(now);
}

function pageText(html){
  const $=cheerio.load(html);
  $('script,style,noscript,nav,header,footer,svg').remove();
  return cleanTitle(($('main').first().length?$('main').first():$('body')).text()||'');
}

function listingMeta($,anchor){
  let node=$(anchor);
  for(let depth=0;depth<8;depth++){
    node=node.parent();
    if(!node.length)break;
    const raw=cleanTitle(node.text()||'');
    if(!raw||raw.length>2500)continue;
    const slashDates=[...raw.matchAll(/\b(0?[1-9]|[12]\d|3[01])\/(0?[1-9]|1[0-2])\/(20\d{2})\b/g)]
      .map(m=>`${m[3]}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[1])).padStart(2,'0')}`);
    const dates=slashDates.length?slashDates:detectDates(raw);
    if(dates.length>=2){
      return{
        openingDate:dates[0],
        closingDate:dates.at(-1),
        listingEvidence:raw.slice(0,1200)
      };
    }
  }
  return{openingDate:null,closingDate:null,listingEvidence:null};
}

export function parseBpifranceAapListingHtml(html,base){
  const $=cheerio.load(html),items=[],pages=[];
  $('a[href]').each((_,a)=>{
    const url=safeUrl($(a).attr('href'),base);
    if(!url)return;
    try{
      const u=new URL(url),b=new URL(base);
      if(u.origin!==b.origin)return;
      const p=u.pathname.replace(/\/+$/,'');
      if(p.startsWith(AAP_PREFIX+'/')){
        items.push({url,label:cleanTitle($(a).text()||$(a).attr('title')||''),...listingMeta($,a)});
      }else if(p===AAP_PREFIX&&u.searchParams.has('page'))pages.push(u.href);
    }catch{}
  });
  return{items:uniqueLinks(items),pages:[...new Set(pages)]};
}

async function activeAapListing(source,{log=console.log,maxPages=60}={}){
  const all=[],seen=new Set();
  let noNew=0;
  for(let page=0;page<maxPages;page++){
    const url=source.url+(source.url.includes('?')?'&':'?')+'page='+page;
    let loaded;
    try{loaded=await getHtml(url)}catch(e){
      log(`[${source.id}] listing inaccessible ${url}: ${e.message}`);
      break;
    }
    const parsed=parseBpifranceAapListingHtml(loaded.html,loaded.finalUrl||url);
    let added=0;
    for(const item of parsed.items){
      const k=canonicalUrl(item.url);
      if(seen.has(k))continue;
      seen.add(k);all.push(item);added++;
    }
    if(added===0)noNew++;else noNew=0;
    if(noNew>=2)break;
  }
  const today=parisDateIso();
  const active=uniqueLinks(all).filter(x=>!x.closingDate||x.closingDate>=today);
  log(`[${source.id}] listing maître Bpifrance: ${active.length} AAP/AMI/concours actifs (${all.length} URL(s) uniques observées)`);
  return active;
}

async function sitemapUrls(source,{log=console.log,maxSitemaps=80,maxUrls=50000}={}){
  const start=source.sitemapUrl||new URL('/sitemap.xml',source.url).href;
  const queue=[start],seenMaps=new Set(),urls=[];
  while(queue.length&&seenMaps.size<maxSitemaps&&urls.length<maxUrls){
    const mapUrl=queue.shift();if(seenMaps.has(mapUrl))continue;seenMaps.add(mapUrl);
    try{
      const xml=(await fetchText(mapUrl,{timeoutMs:25000,retries:2})).text;
      const locs=[...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map(m=>m[1].replace(/&amp;/g,'&').trim()).filter(Boolean);
      if(/<sitemapindex\b/i.test(xml)){for(const u of locs)if(!seenMaps.has(u))queue.push(u)}
      else urls.push(...locs);
    }catch(e){log(`[${source.id}] sitemap ignoré ${mapUrl}: ${e.message}`)}
  }
  return [...new Set(urls)].slice(0,maxUrls);
}

function sectionLinks(html,base,sectionLabel){
  const $=cheerio.load(html),target=norm(sectionLabel),out=[];
  const headings=$('h1,h2,h3,h4').toArray();
  const h=headings.find(el=>norm($(el).text())===target||norm($(el).text()).includes(target));
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
      const url=safeUrl($(a).attr('href'),base);if(!url)return;
      const u=new URL(url),b=new URL(base);
      if(u.origin!==b.origin)return;
      const p=u.pathname.replace(/\/+$/,'');
      if(!p.startsWith(CATALOGUE_PREFIX+'/'))return;
      out.push({url,label:cleanTitle($(a).text()||$(a).attr('title')||''),listingEvidence:cleanTitle(node.text()||'').slice(0,1200)});
    });
  }
  return uniqueLinks(out);
}

async function catalogueMaster(source,{log=console.log}={}){
  const loaded=await getHtml(source.url);
  const links=sectionLinks(loaded.html,loaded.finalUrl||source.url,source.catalogueSection||'Subventions et avances remboursables');
  log(`[${source.id}] section maître "${source.catalogueSection}": ${links.length} offre(s) officielles`);
  return links;
}

async function externalAuditLinks(source,family,{log=console.log}={}){
  if(!source.externalAuditFile)return[];
  try{
    const root=new URL('../../',import.meta.url);
    const file=new URL(source.externalAuditFile,root);
    const {readFile}=await import('node:fs/promises');
    const audit=JSON.parse(await readFile(file,'utf8'));
    const links=uniqueLinks((audit.candidates||[]).filter(x=>x.family===family).map(x=>({url:x.url,label:x.title||'',engines:x.engines||[]})));
    log(`[${source.id}] contre-audit ${family}: ${links.length} URL(s) candidate(s)`);
    return links;
  }catch(e){
    log(`[${source.id}] contre-audit externe indisponible: ${e.message}`);
    return[];
  }
}

function bpifranceRoleEvidence(text=''){
  const raw=String(text||'');
  const patterns=[
    /(?:op[eé]r[eé]|mis en œuvre|mis en oeuvre|g[eé]r[eé]|instruit)\s+par\s+Bpifrance/i,
    /Bpifrance[^.;]{0,140}(?:finance|cofinance|accorde|attribue|soutient|instruit)/i,
    /(?:financ[eé]|soutenu|accord[eé])[^.;]{0,140}par\s+Bpifrance/i,
    /(?:contrat|convention|dossier)[^.;]{0,160}Bpifrance/i
  ];
  for(const rx of patterns){
    const m=raw.match(rx);if(!m)continue;
    const i=Math.max(0,(m.index||0)-140),j=Math.min(raw.length,(m.index||0)+m[0].length+220);
    return cleanTitle(raw.slice(i,j));
  }
  return null;
}

export function classifyBpifranceInstrument(text='',title=''){
  const raw=cleanTitle(`${title} ${text}`);
  const n=norm(raw);
  if(/bpifrance ne finance pas directement/i.test(raw))return{aidTypes:[],reason:'BPIFRANCE_NON_FINANCEUR_DIRECT',evidence:'Bpifrance ne finance pas directement'};
  const aidTypes=[];
  if(/pret a taux zero|taux 0\s*%|\bptzi\b/.test(n))aidTypes.push('PRET_TAUX_ZERO');
  if(/avance recuperable|avance remboursable/.test(n))aidTypes.push('AVANCE_REMBOURSABLE');
  if(/\bsubvention\b|\bbourse french tech\b|aide au developpement deeptech/.test(n))aidTypes.push('SUBVENTION');
  const evidence=aidTypes.length?raw.match(/.{0,120}(?:subvention|avance (?:r[eé]cup[eé]rable|remboursable)|pr[êe]t [àa] taux z[eé]ro|taux 0\s*%).{0,180}/i)?.[0]||title:null;
  return{aidTypes:uniq(aidTypes),reason:aidTypes.length?null:'INSTRUMENT_HORS_PERIMETRE_SUB_AR_PTZ',evidence:cleanTitle(evidence||'')||null};
}

function directStatus(a,text='',now=new Date()){
  const today=parisDateIso(now);
  if(/(?:appel|concours|ami)[^.;]{0,100}(?:est|maintenant)\s+(?:clos|cl[oô]tur[eé])|candidatures?[^.;]{0,80}(?:closes?|ferm[eé]es?)/i.test(text)){
    return{state:'CLOSED',retain:false,evidence:'Page directe indiquée close'};
  }
  const dates=uniq([
    ...(a?.deadlines||[]).map(x=>typeof x==='string'?x:x?.date),
    a?.finalClosingDate,a?.closingDate
  ].filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x)))).sort();
  const last=dates.at(-1)||null;
  if(last&&last<today)return{state:'CLOSED',retain:false,evidence:`Échéance ${last}`,date:last};
  if(last)return{state:'OPEN',retain:true,evidence:`Échéance ${last}`,date:last};
  return{state:'OPEN_UNDATED',retain:true,evidence:'Présent dans l’inventaire officiel courant',date:null};
}

async function extractDirect(source,link,kind,{requireTargetInstrument=false}={}){
  const loaded=await getHtml(link.url);
  const requested=canonicalUrl(link.url),resolved=canonicalUrl(loaded.finalUrl||link.url);
  if(requested!==resolved)return{aid:null,excluded:{url:link.url,label:link.label||'',reason:'REDIRECTION_VERS_AUTRE_PAGE',resolvedUrl:resolved}};
  const text=pageText(loaded.html);
  const a=extractFromHtml(loaded.html,{url:requested,sourceTier:'B',scope:'NATIONAL',region:null});
  const label=cleanTitle(link.label||'');if(label&&label.length>=4)a.title=label;
  if(!a.title||a.title.length<4)return{aid:null,excluded:{url:requested,label:label||'',reason:'TITRE_ABSENT'}};

  const status=directStatus(a,text);
  if(kind==='AAP / AMI'&&!status.retain)return{aid:null,excluded:{url:requested,title:a.title,reason:'AAP_CLOS',status:status.state}};
  const financial=classifyBpifranceInstrument(text,a.title);
  if(requireTargetInstrument&&!financial.aidTypes.length){
    return{aid:null,excluded:{url:requested,title:a.title,aidTypes:[],reason:financial.reason||'INSTRUMENT_HORS_PERIMETRE_SUB_AR_PTZ'}};
  }

  const checkedAt=new Date().toISOString();
  a.id=directPageId(source.id,requested);
  a.canonicalId=a.id;a.sourceId=source.id;a.sourceRecordId=requested;
  a.kind=kind;a.sourcePortal='Bpifrance';a.guichetVerified='Bpifrance';a.catalogueVerified=true;
  a.sourceState=kind==='AAP / AMI'?status.state:'OPEN_UNDATED';
  a.lifecycleStatus='ACTIVE';a.officialPage=requested;
  if(kind==='AAP / AMI'){
    a.aidTypes=uniq(['APPEL_A_PROJET',...(financial.aidTypes||[]),...(a.aidTypes||[])]);
  }else a.aidTypes=financial.aidTypes;
  if(link.openingDate&&!a.openingDate)a.openingDate=link.openingDate;
  if(link.closingDate){
    a.closingDate=link.closingDate;a.finalClosingDate=link.closingDate;
    a.deadlines=uniq([...(a.deadlines||[]),link.closingDate]).sort();
  }
  if(!Array.isArray(a.funder))a.funder=[];
  const role=bpifranceRoleEvidence(text);
  if(role&&!a.operator)a.operator='Bpifrance';
  a.sourceLinks=[{label:'Page officielle Bpifrance',url:requested},...(a.sourceLinks||[]).filter(x=>x?.url&&canonicalUrl(x.url)!==requested)];
  const masterSource=kind==='AAP / AMI'
    ?'https://www.bpifrance.fr/nos-appels-a-projets-concours'
    :'https://www.bpifrance.fr/catalogue-offres';
  const extra=[
    {field:'catalogueMembership',sourceUrl:masterSource,sourceTier:'B',locator:kind==='AAP / AMI'?'active-listing':'catalogue-section',evidenceText:(link.listingEvidence||`Présent dans l’inventaire officiel Bpifrance — ${kind}`).slice(0,850),checkedAt},
    {field:'guichet',sourceUrl:masterSource,sourceTier:'B',locator:'bpifrance-official-inventory',evidenceText:'Référencé sur le portail officiel Bpifrance',checkedAt},
    {field:'sourceStatus',sourceUrl:kind==='AAP / AMI'?requested:masterSource,sourceTier:'B',locator:kind==='AAP / AMI'?'direct-page-calendar':'catalogue-current-section',evidenceText:String(status.evidence||a.sourceState).slice(0,850),checkedAt},
    {field:'catalogueKind',sourceUrl:masterSource,sourceTier:'B',locator:kind==='AAP / AMI'?'aap-listing':'catalogue-section',evidenceText:kind,checkedAt}
  ];
  if(financial.evidence)extra.push({field:'instrument',sourceUrl:requested,sourceTier:'B',locator:'direct-page-financial-terms',evidenceText:financial.evidence.slice(0,850),checkedAt});
  if(role)extra.push({field:'operator',sourceUrl:requested,sourceTier:'B',locator:'direct-page-role',evidenceText:role.slice(0,850),checkedAt});
  a.verification={...(a.verification||{}),fieldEvidence:[...(a.verification?.fieldEvidence||[]),...extra]};
  a.guichetVerification={status:'VERIFIED',sourceUrl:masterSource,evidenceText:extra[0].evidenceText,checkedAt};
  return{aid:a,excluded:null};
}

async function extractMany(source,links,kind,{log=console.log,workers=10,requireTargetInstrument=false}={}){
  const aids=[],excluded=[],errors=[];let cursor=0;
  const pool=Array.from({length:workers},async()=>{
    while(true){
      const i=cursor++;if(i>=links.length)return;
      const link=links[i];
      try{
        const item=await extractDirect(source,link,kind,{requireTargetInstrument});
        if(item?.aid)aids.push(item.aid);
        else if(item?.excluded)excluded.push(item.excluded);
        else errors.push({url:link.url,label:link.label||'',reason:'EXTRACTION_VIDE'});
      }catch(e){
        errors.push({url:link.url,label:link.label||'',reason:String(e?.message||e)});
        log(`[${source.id}] page ignorée ${link.url}: ${e.message}`);
      }
    }
  });
  await Promise.all(pool);
  return{aids,excluded,errors};
}

async function classifyExternalAapGaps(source,master,external,{log=console.log}={}){
  const known=new Set(master.map(x=>canonicalUrl(x.url)));
  const pending=external.filter(x=>!known.has(canonicalUrl(x.url)));
  const active=[],closed=[],unknown=[];let cursor=0;
  const pool=Array.from({length:10},async()=>{
    while(true){
      const i=cursor++;if(i>=pending.length)return;
      const x=pending[i];
      try{
        const loaded=await getHtml(x.url),text=pageText(loaded.html);
        const a=extractFromHtml(loaded.html,{url:x.url,sourceTier:'B',scope:'NATIONAL',region:null});
        const st=directStatus(a,text);
        if(st.state==='CLOSED')closed.push({url:x.url,title:a.title||x.label||'',reason:st.evidence});
        else if(st.state==='OPEN')active.push({url:x.url,title:a.title||x.label||'',reason:st.evidence});
        else unknown.push({url:x.url,title:a.title||x.label||'',reason:'STATUT_NON_DATE'});
      }catch(e){unknown.push({url:x.url,title:x.label||'',reason:String(e?.message||e)})}
    }
  });
  await Promise.all(pool);
  log(`[${source.id}] audit externe AAP: ${active.length} actif(s) hors listing, ${closed.length} clos, ${unknown.length} indéterminé(s)`);
  return{active,closed,unknown};
}

async function classifyExternalCatalogueGaps(source,master,external,{log=console.log}={}){
  const known=new Set(master.map(x=>canonicalUrl(x.url)));
  const pending=external.filter(x=>!known.has(canonicalUrl(x.url)));
  const target=[],nonTarget=[],unknown=[];let cursor=0;
  const pool=Array.from({length:10},async()=>{
    while(true){
      const i=cursor++;if(i>=pending.length)return;
      const x=pending[i];
      try{
        const loaded=await getHtml(x.url),text=pageText(loaded.html);
        const title=cleanTitle(cheerio.load(loaded.html)('h1').first().text()||x.label||'');
        const fin=classifyBpifranceInstrument(text,title);
        if(fin.aidTypes.length)target.push({url:x.url,title,aidTypes:fin.aidTypes});
        else nonTarget.push({url:x.url,title,reason:fin.reason});
      }catch(e){unknown.push({url:x.url,title:x.label||'',reason:String(e?.message||e)})}
    }
  });
  await Promise.all(pool);
  log(`[${source.id}] audit externe catalogue: ${target.length} cible(s) hors section, ${nonTarget.length} hors périmètre, ${unknown.length} indéterminée(s)`);
  return{target,nonTarget,unknown};
}

export async function discoverBpifranceCurrentAaps(source,{log=console.log}={}){
  const [listing,sitemap,external]=await Promise.all([
    activeAapListing(source,{log}),
    sitemapUrls(source,{log}),
    externalAuditLinks(source,'aap',{log})
  ]);
  const sitemapAap=sitemap.filter(u=>{try{return new URL(u).pathname.startsWith(AAP_PREFIX+'/')}catch{return false}});
  const externalDisposition=await classifyExternalAapGaps(source,listing,external,{log});
  return{links:listing,sitemapCount:sitemapAap.length,external,externalDisposition};
}

export async function discoverBpifranceCatalogueAids(source,{log=console.log}={}){
  const [master,sitemap,external]=await Promise.all([
    catalogueMaster(source,{log}),
    sitemapUrls(source,{log}),
    externalAuditLinks(source,'catalogue',{log})
  ]);
  const sitemapCatalogue=sitemap.filter(u=>{try{return new URL(u).pathname.startsWith(CATALOGUE_PREFIX+'/')}catch{return false}});
  const externalDisposition=await classifyExternalCatalogueGaps(source,master,external,{log});
  return{links:master,sitemapCount:sitemapCatalogue.length,external,externalDisposition};
}

export async function collectBpifranceAaps(source,{log=console.log}={}){
  const discovered=await discoverBpifranceCurrentAaps(source,{log});
  const out=await extractMany(source,discovered.links,'AAP / AMI',{log,workers:10});
  return{
    aids:out.aids,
    discovered:discovered.links.length,
    audit:{
      discovered:discovered.links.length,imported:out.aids.length,excluded:out.excluded,errors:out.errors,
      accounted:out.aids.length+out.excluded.length+out.errors.length,
      channels:{listing:discovered.links.length,sitemap:discovered.sitemapCount,externalAudit:discovered.external.length},
      externalDisposition:discovered.externalDisposition
    },
    message:`Bpifrance AAP v2: ${discovered.links.length} actif(s) au listing maître, ${out.aids.length} importé(s), ${out.excluded.length} exclusion(s), ${out.errors.length} erreur(s)`
  };
}

export async function collectBpifranceAids(source,{log=console.log}={}){
  const discovered=await discoverBpifranceCatalogueAids(source,{log});
  const out=await extractMany(source,discovered.links,'AIDE',{log,workers:10,requireTargetInstrument:true});
  return{
    aids:out.aids,
    discovered:discovered.links.length,
    audit:{
      discovered:discovered.links.length,imported:out.aids.length,excluded:out.excluded,errors:out.errors,
      accounted:out.aids.length+out.excluded.length+out.errors.length,
      channels:{catalogueSection:discovered.links.length,sitemap:discovered.sitemapCount,externalAudit:discovered.external.length},
      externalDisposition:discovered.externalDisposition
    },
    message:`Bpifrance aides v2: ${discovered.links.length} offre(s) dans la section maître, ${out.aids.length} aide(s) cible(s), ${out.excluded.length} exclusion(s), ${out.errors.length} erreur(s)`
  };
}
