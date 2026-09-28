const DATE_FMT=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'});

function parisYmd(now=new Date()){
  const parts=Object.fromEntries(DATE_FMT.formatToParts(now).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  return {year:Number(parts.year),month:Number(parts.month),day:Number(parts.day)};
}

export function jPlusOneDate(now=new Date()){
  const {year,month,day}=parisYmd(now);
  const d=new Date(Date.UTC(year,month-1,day+1));
  return d.toISOString().slice(0,10);
}

export function aidClosingDate(a={}){
  const raw=a.finalClosingDate||a.closingDate||(Array.isArray(a.deadlines)?a.deadlines.map(x=>typeof x==='string'?x:x?.date).filter(Boolean).sort()[0]:null);
  const m=String(raw||'').match(/^\d{4}-\d{2}-\d{2}/);
  return m?m[0]:null;
}

export function isActiveAtJPlusOne(a={},now=new Date()){
  if(a.lifecycleStatus&&a.lifecycleStatus!=='ACTIVE')return false;
  if(a.permanent===true)return true;
  const closing=aidClosingDate(a);
  if(closing)return closing>=jPlusOneDate(now);
  // Une fiche retrouvée comme ACTIVE dans le cycle courant reste ouverte
  // lorsqu'aucune date de fin n'est publiée par la source. On ne lui invente
  // pas une date : elle est comptée comme "active sans échéance publiée".
  return a.lifecycleStatus==='ACTIVE';
}
