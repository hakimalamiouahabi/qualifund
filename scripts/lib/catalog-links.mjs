import { norm } from './utils.mjs';

export function relevantLink(source,label,url){
  const s=norm(`${label} ${url}`);
  if(source.linkInclude&&url.includes(source.linkInclude))return true;
  if(source.linkRegex&&new RegExp(source.linkRegex,'i').test(url))return true;
  return /(appel a projets?|appel a manifestation|appel a candidatures?|\baap\b|\bami\b|aide|subvention|financement|avance remboursable|pret|concours|france 2030|feder|feader|fse|ftj)/i.test(s);
}

export function isPaginationLink(label,url){
  const l=norm(label);let decoded=String(url||'');
  try{decoded=decodeURIComponent(decoded)}catch{}
  return /^(suivant|next|precedent|previous|page\s*\d+|\d+)$/.test(l)
    ||/[?&](?:page|p)=\d+(?:&|$)/i.test(decoded)
    ||/[?&][^=&]*(?:currentpage|pageindex|pagenumber)[^=&]*=\d+/i.test(decoded);
}
