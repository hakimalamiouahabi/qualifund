import { arr } from './utils.mjs';

export function isGenericCatalogPage(url=''){
  try{
    const u=new URL(url);
    const h=u.hostname.toLowerCase();
    const p=u.pathname.replace(/\/+$/,'');
    if(h==='data.aides-entreprises.fr' && (p==='/stock'||p==='/documentation'||p.startsWith('/files'))) return true;
    return false;
  }catch{return true}
}

export function specificOfficialPage(a){
  const urls=[a?.officialPage,...arr(a?.sourceLinks).map(x=>x?.url)]
    .filter(Boolean)
    .filter(u=>/^https?:/i.test(u))
    .filter(u=>!/\.pdf(?:$|\?)/i.test(u))
    .filter(u=>!isGenericCatalogPage(u));
  return [...new Set(urls)][0]||null;
}
