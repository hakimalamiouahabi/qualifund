function sentences(text=''){
  return String(text).replace(/\r/g,'').replace(/[ \t]+/g,' ').split(/(?<=[.;:!?])\s+|\n+/).map(x=>x.trim()).filter(x=>x.length>=12);
}
function pick(text,rx,max=4){
  const out=[];for(const s of sentences(text)){if(!rx.test(s))continue;rx.lastIndex=0;if(!out.includes(s))out.push(s);if(out.length>=max)break;}return out.length?out.join(' '):null;
}
export function regulatoryFallbacks(text=''){
  return {
    selectionCriteria:pick(text,/(crit[eè]res? de s[eé]lection|crit[eè]res? d['’ ]?[eé]valuation|notation|grille de s[eé]lection|s[eé]lection des projets|projets? (?:seront|est) (?:class[eé]s?|not[eé]s?|[eé]valu[eé]s?))/i),
    disbursementTerms:pick(text,/(modalit[eé]s? de versement|versement de l['’ ]?aide|acompte|solde (?:est|sera|sur)|paiement de l['’ ]?aide|avance.{0,35}(?:signature|notification|versement))/i),
    repaymentTerms:pick(text,/(modalit[eé]s? de remboursement|remboursement.{0,80}(?:ans?|mois|trimestre|annuit[eé]|[eé]ch[eé]ance)|diff[eé]r[eé].{0,50}(?:ans?|mois)|dur[eé]e du pr[eê]t|dur[eé]e de remboursement|tableau d['’ ]?amortissement|[eé]ch[eé]ancier de remboursement)/i),
    stateAidRules:pick(text,/(de minimis|r[eé]gime d['’ ]?aide|aides? d['’ ]?[eé]tat|r[eè]glement \(ue\)|r[eè]glement g[eé]n[eé]ral d['’ ]?exemption|cumul(?:able| des aides| avec d['’ ]?autres aides)|intensit[eé] maximale d['’ ]?aide)/i),
    applicationProcess:pick(text,/(dossier de candidature|modalit[eé]s? de d[eé]p[oô]t|d[eé]poser (?:un|le|votre) dossier|candidatures? (?:doivent|sont) .*d[eé]pos|pi[eè]ces? (?:[aà]|à) fournir)/i),
    contact:pick(text,/(contact(?:s)?\s*:|pour tout renseignement|pour toute question|service instructeur|courriel|e-mail|t[eé]l[eé]phone)/i,2)
  };
}
