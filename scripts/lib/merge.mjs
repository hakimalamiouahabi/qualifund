import { arr, uniq } from './utils.mjs';
const tierRank={A:4,B:3,C:2,D:1,'?':0};
function bestScalar(a,b,ta='?',tb='?'){if(b==null||b==='')return a;if(a==null||a==='')return b;return (tierRank[tb]||0)>(tierRank[ta]||0)?b:a}
export function mergeAid(base,incoming){
  if(!base)return incoming; if(!incoming)return base; const ta=base.verification?.sourceTier||'?',tb=incoming.verification?.sourceTier||'?';
  const out={...base};
  for(const k of ['title','objective','beneficiaries','eligibleExpenses','excludedExpenses','prerequisites','selectionCriteria','disbursementTerms','repaymentTerms','stateAidRules','applicationProcess','contact','closingDate','finalClosingDate','openingDate','officialPage','programme','operator','minimumProjectCost','maximumProjectCost'])out[k]=bestScalar(base[k],incoming[k],ta,tb);
  for(const k of ['companyCategories','themes','regions','aidTypes','projectsExpected','deadlines','attentionPoints','cdcLinks','sourceLinks','regulationLinks','formLinks','funder','sourceAliases'])out[k]=uniq([...arr(base[k]),...arr(incoming[k])].map(x=>typeof x==='object'?JSON.stringify(x):x)).map(x=>{try{return x.startsWith?.('{')?JSON.parse(x):x}catch{return x}});
  if(incoming.aidRate && ((tierRank[tb]||0)>=(tierRank[ta]||0)))out.aidRate=incoming.aidRate;
  if(incoming.aidAmount && ((tierRank[tb]||0)>=(tierRank[ta]||0)))out.aidAmount=incoming.aidAmount;
  if(incoming.aidSplit && ((tierRank[tb]||0)>=(tierRank[ta]||0)))out.aidSplit=incoming.aidSplit;
  if(incoming.permanent!=null && ((tierRank[tb]||0)>=(tierRank[ta]||0)))out.permanent=!!incoming.permanent;
  // Une occurrence retrouvée dans une source active doit réactiver un doublon précédemment STALE.
  const lifecycle=[base.lifecycleStatus,incoming.lifecycleStatus].filter(Boolean);
  if(lifecycle.includes('ACTIVE'))out.lifecycleStatus='ACTIVE';
  else if(lifecycle.includes('STALE'))out.lifecycleStatus='STALE';
  else if(lifecycle.includes('ARCHIVE'))out.lifecycleStatus='ARCHIVE';
  out.lastSeenAt=incoming.lastSeenAt||base.lastSeenAt;
  const ev=[...arr(base.verification?.fieldEvidence),...arr(incoming.verification?.fieldEvidence)];
  out.verification={...(base.verification||{}),...(incoming.verification||{}),sourceTier:(tierRank[tb]||0)>(tierRank[ta]||0)?tb:ta,fieldEvidence:ev};
  return out;
}
