import { detectDates, uniq } from './utils.mjs';
const KW=/(rel[eè]ve|vague|session|date limite|cl[oô]ture|d[eé]p[oô]t|candidature|deadline|jusqu['’]au|ouverture|ouvre|fermeture)/i;
const REL=/(rel[eè]ve|vague|session)/i;
const FINAL=/(cl[oô]ture finale|date limite finale|fermeture d[eé]finitive|jusqu['’]au|date limite de (?:d[eé]p[oô]t|candidature)|cl[oô]ture)/i;
const OPEN=/(ouverture|ouvre|ouvert [aà] compter|d[eè]s le)/i;
const PERM=/(au fil de l['’]eau|permanent|sans date limite|tout au long de l['’]ann[eé]e|d[eé]p[oô]t continu)/i;
export function extractCalendar(text=''){
 const raw=String(text||'');const lines=raw.split(/\n|(?<=[.!?;])\s+/).map(x=>x.trim()).filter(Boolean);const deadline=[],opening=[],final=[];
 for(const line of lines){if(!KW.test(line))continue;const ds=detectDates(line);if(!ds.length)continue;if(OPEN.test(line))opening.push(...ds);if(REL.test(line))deadline.push(...ds);if(FINAL.test(line))final.push(...ds);if(!OPEN.test(line)&&!REL.test(line)&&!FINAL.test(line))deadline.push(...ds)}
 const permanent=PERM.test(raw);const deadlines=uniq([...deadline,...final]).sort();const finalClosingDate=final.length?uniq(final).sort().at(-1):(deadlines.length?deadlines.at(-1):null);return {openingDate:uniq(opening).sort()[0]||null,deadlines,finalClosingDate,closingDate:finalClosingDate,permanent};
}
export function permanentVerified(a){return Boolean(a?.permanent&&(a?.verification?.fieldEvidence||[]).some(e=>e?.field==='calendar'&&['A','B'].includes(e?.sourceTier)))}
export function nextApplicableDeadline(a,analysisDate=new Date()){
 const base=new Date(analysisDate);base.setHours(0,0,0,0);const threshold=new Date(base);threshold.setDate(threshold.getDate()+1);
 if(a?.permanent)return permanentVerified(a)?{eligible:true,date:null,reason:'PERMANENT'}:{eligible:false,date:null,reason:'PERMANENT_UNVERIFIED'};
 const ds=[...(a?.deadlines||[]),a?.finalClosingDate,a?.closingDate].filter(Boolean).map(x=>typeof x==='string'?x:x?.date).filter(Boolean).filter((x,i,self)=>self.indexOf(x)===i).sort();
 for(const d of ds){const dt=new Date(d+'T00:00:00');if(dt>=threshold)return {eligible:true,date:d,reason:'DEADLINE'};}
 return {eligible:false,date:ds.find(d=>new Date(d+'T00:00:00')>=base)||ds.at(-1)||null,reason:ds.length?'J1':'DATE_MISSING'};
}
