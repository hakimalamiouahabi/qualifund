import { norm, sha256, arr, uniq } from './utils.mjs';
import { mergeAid } from './merge.mjs';

function titleCore(s=''){
  return norm(s)
    .replace(/\b(france 2030|appel a projets?|appel a manifestation d interet|aap|ami|dispositif|aide)\b/g,' ')
    .replace(/[^a-z0-9]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function territoryKey(a){
  return a.scope==='REGIONAL'?arr(a.regions).sort().join('|'):'FRANCE';
}

function titleAlias(a){
  return `title:${titleCore(a.title)}|${a.scope||''}|${territoryKey(a)}`;
}

function canonicalOfficialUrl(raw=''){
  if(!/^https?:/i.test(raw)) return null;
  try{
    const u=new URL(raw);
    u.hash='';
    const kept=[...u.searchParams.entries()]
      .filter(([k])=>!(/^utm_/i.test(k)||['fbclid','gclid','mc_cid','mc_eid'].includes(k)))
      .sort(([ak,av],[bk,bv])=>ak.localeCompare(bk)||av.localeCompare(bv));
    u.search='';
    for(const [k,v] of kept)u.searchParams.append(k,v);
    const pathname=u.pathname.replace(/\/+$/,'')||'/';
    return `${u.protocol}//${u.host}${pathname}${u.search}`;
  }catch{return null}
}

function isGenericCatalogUrl(raw=''){
  const u=canonicalOfficialUrl(raw);
  if(!u) return true;
  try{
    const x=new URL(u),p=x.pathname.toLowerCase();
    return [
      '/stock','/catalogue','/aides','/les-aides','/vos-aides','/appels','/fr/appels',
      '/les-aides-et-appels-a-projets','/aides-financieres/catalogue'
    ].some(s=>p===s||p===s+'/');
  }catch{return true}
}

function urlAlias(a){
  const u=canonicalOfficialUrl(a.officialPage);
  if(!u||isGenericCatalogUrl(u)) return null;
  return `url:${u}`;
}

export function canonicalKey(a){
  if(a.canonicalId)return a.canonicalId;
  if(a.sourceRecordId&&a.sourceId)return `${a.sourceId}:${a.sourceRecordId}`;
  return sha256(titleAlias(a)).slice(0,24);
}

export function dedupe(aids){
  const groups=[],groupSources=[],aliasMap=new Map();
  for(const a0 of aids){
    const a={...a0};
    const directUrlAlias=urlAlias(a);
    const aliases=directUrlAlias?[directUrlAlias]:[titleAlias(a)];
    let idx=aliases.map(k=>aliasMap.get(k)).find(v=>v!=null);
    if(idx==null){
      idx=groups.length;
      groups.push(a);
      groupSources[idx]=new Set();
    }else{
      groups[idx]=mergeAid(groups[idx],a);
    }
    for(const sid of [...arr(a.sourceAliases),a.sourceId].filter(Boolean))groupSources[idx].add(sid);
    for(const k of aliases)aliasMap.set(k,idx);
  }
  return groups.map((a,i)=>({
    ...a,
    canonicalId:a.canonicalId||sha256(titleAlias(a)).slice(0,24),
    sourceAliases:uniq([...groupSources[i],...arr(a.sourceAliases),...arr(a.sourceId)])
  }));
}
