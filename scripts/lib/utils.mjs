import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const nowIso = () => new Date().toISOString();
export const uniq = (a=[]) => [...new Set(a.filter(Boolean))];
export const arr = v => Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]);
export const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,"'").replace(/\s+/g,' ').trim();
export const sha256 = s => crypto.createHash('sha256').update(Buffer.isBuffer(s)?s:String(s)).digest('hex');
export const sleep = ms => new Promise(r=>setTimeout(r,ms));
export function safeUrl(u, base){ try { return new URL(u, base).href; } catch { return null; } }
export function htmlToText(s=''){return String(s).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<br\s*\/?>/gi,'\n').replace(/<\/p>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();}
export async function readJson(file, fallback=null){try{return JSON.parse(await fs.readFile(file,'utf8'))}catch{return fallback}}
export async function writeJsonAtomic(file,obj){await fs.mkdir(path.dirname(file),{recursive:true});const tmp=file+'.tmp';await fs.writeFile(tmp,JSON.stringify(obj,null,2),'utf8');await fs.rename(tmp,file)}
export function cleanTitle(s=''){return htmlToText(s).replace(/\s+/g,' ').trim()}
export function detectCurrencyAmounts(text=''){
  const out=[]; const re=/(\d{1,3}(?:[ .\u00a0]\d{3})*(?:[,.]\d+)?)\s*(k|m)?\s*(?:€|euros?)/gi; let m;
  while((m=re.exec(text))){let v=Number(m[1].replace(/[ .\u00a0]/g,'').replace(',','.'));if((m[2]||'').toLowerCase()==='k')v*=1e3;if((m[2]||'').toLowerCase()==='m')v*=1e6;if(Number.isFinite(v))out.push(v)}
  return out;
}
export function detectRates(text=''){const out=[];const re=/(\d{1,3}(?:[,.]\d+)?)\s*%/g;let m;while((m=re.exec(text))){const v=Number(m[1].replace(',','.'));if(v>=0&&v<=100)out.push(v)}return out;}
export function dateToIso(y,m,d){const mm=String(m).padStart(2,'0'),dd=String(d).padStart(2,'0');return `${y}-${mm}-${dd}`}
export function detectDates(text=''){
  const months={janvier:1,fevrier:2,février:2,mars:3,avril:4,mai:5,juin:6,juillet:7,aout:8,août:8,septembre:9,octobre:10,novembre:11,decembre:12,décembre:12};
  const out=[];let m;const iso=/\b(20\d{2})[-\/.](0?[1-9]|1[0-2])[-\/.](0?[1-9]|[12]\d|3[01])\b/g;while((m=iso.exec(text)))out.push(dateToIso(m[1],m[2],m[3]));
  const fr=/\b(0?[1-9]|[12]\d|3[01])\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(20\d{2})\b/gi;while((m=fr.exec(text)))out.push(dateToIso(m[3],months[m[2].toLowerCase()],m[1]));
  const slash=/\b(0?[1-9]|[12]\d|3[01])[\/-](0?[1-9]|1[0-2])[\/-](20\d{2})\b/g;while((m=slash.exec(text)))out.push(dateToIso(m[3],m[2],m[1]));
  return uniq(out).sort();
}
export function isFutureOrToday(iso){if(!iso)return false;return new Date(iso+'T23:59:59Z')>=new Date();}
export function normalizeCompanyCategories(text=''){const t=norm(text);const o=[];if(/start[- ]?up|jeune entreprise|entreprise innovante/.test(t))o.push('STARTUP');if(/\bpme\b|petites? et moyennes? entreprises?|tpe/.test(t))o.push('PME');if(/\beti\b|entreprise de taille intermediaire/.test(t))o.push('ETI');if(/grandes? entreprises?|\bge\b/.test(t))o.push('GE');if(/toutes? les entreprises|toute taille|sans critere de taille/.test(t))o.push('PME','ETI','GE');return uniq(o)}
export function normalizeAidTypes(text=''){const t=norm(text);const o=[];if(/subvention|aide non remboursable|dotation/.test(t))o.push('SUBVENTION');if(/avance remboursable|avance recuperable|avance récupérable/.test(t))o.push('AVANCE_REMBOURSABLE');if(/pret d'honneur|pret a taux zero|pret a taux 0|taux d'interet zero|taux d'interet 0|sans interet|sans versement d'interets/.test(t))o.push('PRET_TAUX_ZERO');return uniq(o)}
export function sourceTierFor({isOfficial=true,isDocument=false,isOpenData=false}){if(isDocument&&isOfficial)return 'A';if(isOfficial&&!isOpenData)return 'B';if(isOfficial&&isOpenData)return 'C';return 'D'}

export function canonicalUrl(u=''){try{const x=new URL(u);x.hash='';for(const k of [...x.searchParams.keys()])if(/^utm_|^pk_|^fbclid$/i.test(k))x.searchParams.delete(k);x.pathname=x.pathname.replace(/\/$/,'');return x.href}catch{return ''}}
export function clamp(n,min,max){return Math.max(min,Math.min(max,n))}
