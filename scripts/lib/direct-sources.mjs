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

export function assertDirectSources(cfg){
  if(cfg.sourcePolicy!=='DIRECT_OFFICIAL_ONLY')throw new Error('Politique de sources directes manquante');
  if(cfg.sourceSelectionPolicy!=='GUICHET_OR_REGION_OFFICIAL_ONLY')throw new Error('Politique guichet/région spécifique manquante');
  for(const s of cfg.sources||[]){
    if(!s.official||!s.url||containsForbiddenAggregator(s)||!['catalog-html','official-page','opendatasoft','control-only','bpifrance-aap','bpifrance-aides','ademe-official'].includes(s.strategy))throw new Error('Source interdite: '+s.id);
  }
}

export function isDirectAid(a,cfg){
  if(!a||containsForbiddenAggregator(a)||/^ae_|^qf_ae_/.test(a.id||''))return false;
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

export const filterDirectLibrary=(records,cfg)=>(records||[]).filter(a=>isDirectAid(a,cfg));
