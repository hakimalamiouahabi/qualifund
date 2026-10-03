import { createHash } from 'node:crypto';

export const directPageId=(sourceId,url)=>sourceId+'_'+createHash('sha256').update(url).digest('hex');

const forbiddenMarker=/(?:aides[-_]entreprises|aides[-_]territoires|data\.gouv\.fr)/i;
const forbiddenHosts=new Set([
  'service-public.gouv.fr','www.service-public.gouv.fr',
  'mes-aides.gouv.fr','www.mes-aides.gouv.fr',
  'aides.gouv.fr','www.aides.gouv.fr',
  'les-aides.fr','www.les-aides.fr',
  'aide-sociale.fr','www.aide-sociale.fr',
  'solidarites.gouv.fr','www.solidarites.gouv.fr',
  'france-services.gouv.fr','www.france-services.gouv.fr',
  'aides-entreprises.fr','www.aides-entreprises.fr','data.aides-entreprises.fr',
  'aides-territoires.beta.gouv.fr',
  'data.gouv.fr','www.data.gouv.fr'
]);

function normalizedPath(u){
  return (u.pathname||'/').replace(/\/+$/,'')||'/';
}

function normalizedUrl(raw=''){
  try{
    const u=new URL(raw);
    u.hash='';
    for(const k of [...u.searchParams.keys()])if(/^utm_|^pk_|^fbclid$/i.test(k))u.searchParams.delete(k);
    u.pathname=u.pathname.replace(/\/+$/,'')||'/';
    return u.href.replace(/\/$/,'');
  }catch{return ''}
}

export function isForbiddenAggregatorUrl(raw){
  if(!/^https?:\/\//i.test(String(raw||'')))return false;
  try{
    const u=new URL(raw),host=u.hostname.toLowerCase(),path=normalizedPath(u);
    if(forbiddenHosts.has(host))return true;
    // Le portail national Europe en France n'est jamais une source d'ingestion générique.
    // Les pages régionales/programmes spécifiques plus profondes restent autorisées.
    if(/(^|\.)europe-en-france\.gouv\.fr$/i.test(host)&&path==='/fr/programmes-europeens-2021-2027')return true;
    return false;
  }catch{return true}
}

function containsForbiddenAggregator(value){
  if(typeof value==='string')return forbiddenMarker.test(value)||isForbiddenAggregatorUrl(value);
  if(Array.isArray(value))return value.some(containsForbiddenAggregator);
  if(value&&typeof value==='object')return Object.values(value).some(containsForbiddenAggregator);
  return false;
}

function sourceUrlSet(cfg,{genericOnly=false}={}){
  return new Set((cfg.sources||[])
    .filter(s=>!genericOnly||s.strategy!=='official-page')
    .map(s=>normalizedUrl(s.url)).filter(Boolean));
}

function excludedSourceIds(cfg){
  return new Set((cfg.excludedSources||[]).map(String));
}
function aliasId(x){
  return typeof x==='string'?x:(x?.id||x?.sourceId||'');
}
function aidHasForbiddenProvenance(a){
  if(!a||typeof a!=='object')return false;
  if(forbiddenMarker.test(String(a.sourceId||'')))return true;
  if((a.sourceAliases||[]).some(x=>forbiddenMarker.test(String(aliasId(x)))))return true;
  const urls=[
    a.officialPage,
    ...(a.sourceLinks||[]).map(x=>typeof x==='string'?x:x?.url),
    ...(a.cdcLinks||[]).map(x=>typeof x==='string'?x:x?.url),
    ...(a.regulationLinks||[]).map(x=>typeof x==='string'?x:x?.url),
    ...(a.formLinks||[]).map(x=>typeof x==='string'?x:x?.url),
    ...((a.verification?.fieldEvidence)||[]).map(x=>x?.sourceUrl)
  ].filter(Boolean);
  return urls.some(isForbiddenAggregatorUrl);
}

export function assertDirectSources(cfg){
  if(cfg.sourcePolicy!=='DIRECT_OFFICIAL_ONLY')throw new Error('Politique de sources directes manquante');
  if(cfg.sourceSelectionPolicy!=='GUICHET_OR_REGION_OFFICIAL_ONLY')throw new Error('Politique guichet/région spécifique manquante');
  const seen=new Map();
  for(const s of cfg.sources||[]){
    if(!s.official||!s.url||containsForbiddenAggregator(s)||!['catalog-html','official-page','opendatasoft','control-only','bpifrance-aap','bpifrance-aides','ademe-official','aura-official'].includes(s.strategy))throw new Error('Source interdite: '+s.id);
    const u=normalizedUrl(s.url);
    if(seen.has(u))throw new Error('Source dupliquée: '+seen.get(u)+' / '+s.id+' -> '+u);
    seen.set(u,s.id);
  }
}

function cleanLinkItem(item){
  if(typeof item==='string')return {url:item};
  if(item&&typeof item==='object')return {...item};
  return null;
}

function sanitizeLinkArray(value,{removeGenericSourcePages=false,cfg}={}){
  const sourceUrls=removeGenericSourcePages?sourceUrlSet(cfg,{genericOnly:true}):new Set();
  const out=[],seen=new Set();
  for(const raw of Array.isArray(value)?value:[]){
    const item=cleanLinkItem(raw);
    if(!item?.url||!/^https:\/\//i.test(item.url)||isForbiddenAggregatorUrl(item.url))continue;
    const key=normalizedUrl(item.url);
    if(!key||seen.has(key)||sourceUrls.has(key))continue;
    seen.add(key);
    out.push(typeof raw==='string'?item.url:{...item,url:key});
  }
  return out;
}

export function sanitizeAidLinks(a,cfg){
  if(!a||typeof a!=='object')return a;
  const excluded=excludedSourceIds(cfg);
  const out={...a};

  if(Array.isArray(a.sourceLinks))out.sourceLinks=sanitizeLinkArray(a.sourceLinks,{removeGenericSourcePages:true,cfg});
  if(Array.isArray(a.cdcLinks))out.cdcLinks=sanitizeLinkArray(a.cdcLinks,{cfg});
  if(Array.isArray(a.regulationLinks))out.regulationLinks=sanitizeLinkArray(a.regulationLinks,{cfg});
  if(Array.isArray(a.formLinks))out.formLinks=sanitizeLinkArray(a.formLinks,{cfg});

  if(Array.isArray(a.sourceAliases))out.sourceAliases=a.sourceAliases.filter(x=>{
    const id=aliasId(x);
    return Boolean(id)&&!excluded.has(String(id))&&!forbiddenMarker.test(String(id));
  });

  if(Array.isArray(a.verification?.fieldEvidence)){
    const evidence=a.verification.fieldEvidence.filter(e=>!e?.sourceUrl||(!isForbiddenAggregatorUrl(e.sourceUrl)&&/^https:\/\//i.test(e.sourceUrl)));
    out.verification={...a.verification,fieldEvidence:evidence};
  }

  const official=normalizedUrl(a.officialPage||'');
  const generic=sourceUrlSet(cfg,{genericOnly:true}).has(official);
  if(!official||isForbiddenAggregatorUrl(official)||generic){
    const links=Array.isArray(out.sourceLinks)?out.sourceLinks:[];
    const replacement=links.find(x=>typeof x==='object'&&x.url&&!/\.pdf(?:$|\?)/i.test(x.url))?.url
      || links.find(x=>typeof x==='string'&&!/\.pdf(?:$|\?)/i.test(x)) || '';
    out.officialPage=replacement||'';
  }else out.officialPage=official;

  return out;
}

export function isDirectAid(a,cfg){
  if(!a||aidHasForbiddenProvenance(a)||/^ae_|^qf_ae_/.test(a.id||''))return false;
  if(['STALE','CLOSED','CLOS','EXPIRED','ARCHIVE'].includes(String(a.lifecycleStatus||'').toUpperCase()))return false;
  const source=(cfg.sources||[]).find(s=>s.id===a.sourceId);
  if(!source||source.strategy==='control-only'||containsForbiddenAggregator(source))return false;
  try{
    const u=new URL(a.officialPage);
    if(u.protocol!=='https:'||isForbiddenAggregatorUrl(u.href)||(u.pathname==='/'&&source.strategy!=='official-page'))return false;
    const hosts=(cfg.sources||[]).map(s=>new URL(s.url).hostname);
    if(!hosts.includes(u.hostname))return false;
    const normalize=x=>{const z=new URL(x);z.hash='';return z.href.replace(/\/$/,'')};
    if((cfg.sources||[]).some(s=>s.strategy!=='official-page'&&normalize(s.url)===normalize(u.href)))return false;
    if(/\/(?:stock|catalogue|appels|aides|les-aides|nos-appels-a-projets-concours|api\/explore\/v2\.1)\/?$/.test(u.pathname))return false;
    return true;
  }catch{return false}
}

export function filterDirectLibrary(records,cfg){
  const out=[],seenIds=new Set(),seenUrls=new Set();
  for(const raw of records||[]){
    const clean=sanitizeAidLinks(raw,cfg);
    if(!isDirectAid(clean,cfg))continue;
    const id=String(clean.id||'');
    const url=normalizedUrl(clean.officialPage);
    if((id&&seenIds.has(id))||(url&&seenUrls.has(url)))continue;
    if(id)seenIds.add(id);
    if(url)seenUrls.add(url);
    out.push(clean);
  }
  return out;
}
