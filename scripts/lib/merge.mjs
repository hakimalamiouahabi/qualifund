import { arr, uniq } from './utils.mjs';
const tierRank={A:4,B:3,C:2,D:1,'?':0};
function bestScalar(a,b,ta='?',tb='?'){if(b==null||b==='')return a;if(a==null||a==='')return b;return (tierRank[tb]||0)>(tierRank[ta]||0)?b:a}
function genericTitle(v=''){
  const t=String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,"'").replace(/\s+/g,' ').trim();
  return !t||t.length<4||/(document officiel|conditions particulieres(?: bpifrance)?|desole.*offre.*plus disponible|offre.*plus disponible|page introuvable|page non trouvee|erreur 404|404 not found|access denied|forbidden|service indisponible|site en maintenance)/i.test(t);
}
function officialUrlRank(raw=''){
  if(!/^https?:/i.test(String(raw||'')))return 0;
  try{
    const u=new URL(raw),host=u.hostname.toLowerCase(),p=(u.pathname||'/').toLowerCase().replace(/\/+$/,'')||'/';
    const generic=
      /data\.aides-entreprises\.fr$/.test(host)&&(/^\/stock$/.test(p)||/^\/files\/aides\.json$/.test(p)) ||
      ['/','/catalogue','/aides','/les-aides','/vos-aides','/appels','/fr/appels','/nos-appels-a-projets-concours'].includes(p);
    if(generic)return 1;
    if(/\.(pdf|docx?|xlsx?)(?:$|\?)/i.test(u.pathname))return 2;
    return 3;
  }catch{return 0}
}
function documentUrl(raw=''){return /\.(?:pdf|docx?|xlsx?)(?:$|\?)/i.test(String(raw||''))}
function bestOfficialPage(a,b){
  // Une pièce documentaire ne remplace jamais une page HTML déjà identifiée comme canonique.
  if(a&&!documentUrl(a)&&documentUrl(b))return a;
  if(b&&!documentUrl(b)&&documentUrl(a))return b;
  const ra=officialUrlRank(a),rb=officialUrlRank(b);
  if(rb>ra)return b;
  return a||b||null;
}

function bestTitle(a,b,ta='?',tb='?'){
  if(genericTitle(b))return a;
  if(genericTitle(a))return b;
  return bestScalar(a,b,ta,tb);
}
export function mergeAid(base,incoming){
  if(!base)return incoming; if(!incoming)return base; const ta=base.verification?.sourceTier||'?',tb=incoming.verification?.sourceTier||'?';
  const out={...base};
  // Un PDF de niveau A peut enrichir les preuves sans remplacer l'intitulé maître
  // déjà obtenu depuis un listing/catalogue/page HTML officielle.
  out.title=documentUrl(incoming.officialPage)&&!genericTitle(base.title)
    ? base.title
    : bestTitle(base.title,incoming.title,ta,tb);
  // Une annexe PDF de niveau A enrichit la preuve mais ne remplace pas la page
  // officielle du dispositif déjà connue.
  out.officialPage=bestOfficialPage(base.officialPage,incoming.officialPage);
  for(const k of ['objective','beneficiaries','eligibleExpenses','excludedExpenses','prerequisites','selectionCriteria','disbursementTerms','repaymentTerms','stateAidRules','applicationProcess','contact','closingDate','finalClosingDate','openingDate','programme','operator','minimumProjectCost','maximumProjectCost'])out[k]=bestScalar(base[k],incoming[k],ta,tb);
  for(const k of ['companyCategories','themes','regions','aidTypes','projectsExpected','deadlines','attentionPoints','cdcLinks','sourceLinks','regulationLinks','formLinks','funder','sourceAliases'])out[k]=uniq([...arr(base[k]),...arr(incoming[k])].map(x=>typeof x==='object'?JSON.stringify(x):x)).map(x=>{try{return x.startsWith?.('{')?JSON.parse(x):x}catch{return x}});
  if(incoming.aidRate && ((tierRank[tb]||0)>=(tierRank[ta]||0)))out.aidRate=incoming.aidRate;
  if(incoming.aidAmount && ((tierRank[tb]||0)>=(tierRank[ta]||0)))out.aidAmount=incoming.aidAmount;
  if(incoming.aidSplit && ((tierRank[tb]||0)>=(tierRank[ta]||0)))out.aidSplit=incoming.aidSplit;
  if(incoming.permanent!=null && ((tierRank[tb]||0)>=(tierRank[ta]||0)))out.permanent=!!incoming.permanent;
  const lifecycle=[base.lifecycleStatus,incoming.lifecycleStatus].filter(Boolean);
  if(lifecycle.includes('ACTIVE'))out.lifecycleStatus='ACTIVE';
  else if(lifecycle.includes('STALE'))out.lifecycleStatus='STALE';
  else if(lifecycle.includes('ARCHIVE'))out.lifecycleStatus='ARCHIVE';
  out.lastSeenAt=incoming.lastSeenAt||base.lastSeenAt;
  const ev=[...arr(base.verification?.fieldEvidence),...arr(incoming.verification?.fieldEvidence)];
  out.verification={...(base.verification||{}),...(incoming.verification||{}),sourceTier:(tierRank[tb]||0)>(tierRank[ta]||0)?tb:ta,fieldEvidence:ev};
  return out;
}
