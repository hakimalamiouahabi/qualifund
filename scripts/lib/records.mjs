import { detectCurrencyAmounts, detectRates, htmlToText, uniq, normalizeCompanyCategories, norm } from './utils.mjs';
import { inferThemes } from './concepts.mjs';

const REGION_MAP={'FRANCE':'Toutes les Régions','Grand-Est':'Grand Est','Nouvelle Aquitaine':'Nouvelle-Aquitaine','Région Sud':'Provence-Alpes-Côte d’Azur','Bourgogne-Franche Comté':'Bourgogne-Franche-Comté','Hauts-de-France':'Hauts-de-France','Normandie':'Normandie','Auvergne-Rhône-Alpes':'Auvergne-Rhône-Alpes','Occitanie':'Occitanie','Île-de-France':'Île-de-France','BRETAGNE':'Bretagne','Pays-de-la-Loire':'Pays de la Loire','Centre-Val de Loire':'Centre-Val de Loire','Corse':'Corse','GUADELOUPE':'Guadeloupe','GUYANE':'Guyane','MARTINIQUE':'Martinique','REUNION':'La Réunion','MAYOTTE':'Mayotte'};
const asArr=v=>Array.isArray(v)?v:(v?[v]:[]);

function broadAidTypes(natures=[],text=''){
  const labels=natures.map(x=>String(x?.typ_libelle||''));
  const t=norm([text,...labels].join(' ')),out=[];
  if(/subvention|aide non remboursable|dotation/.test(t))out.push('SUBVENTION');
  if(/avance remboursable|avance recuperable/.test(t))out.push('AVANCE_REMBOURSABLE');
  if(/pret d'honneur|pret a taux zero|pret a taux 0|sans interet|taux d'interet zero|taux d'interet 0/.test(t))out.push('PRET_TAUX_ZERO');
  if(/\bpret\b|emprunt|credit moyen terme|credit long terme/.test(t))out.push('PRET');
  if(/bonification d.?interet|bonification de taux/.test(t))out.push('BONIFICATION_INTERET');
  if(/garantie|cautionnement/.test(t))out.push('GARANTIE');
  if(/allegement fiscal|credit d.?impot|exoneration|reduction d.?impot|fiscal/.test(t))out.push('ALLEGEMENT_FISCAL');
  if(/participation au capital|prise de participation|capital investissement|fonds propres|equity/.test(t))out.push('PARTICIPATION_CAPITAL');
  if(/appel a projets?|appel a manifestation|\baap\b|\bami\b/.test(t))out.push('APPEL_A_PROJET');
  if(/accompagnement gratuit|accompagnement non financier|conseil gratuit|diagnostic gratuit/.test(t))out.push('ACCOMPAGNEMENT_GRATUIT');
  if(/credit[- ]?bail|leasing/.test(t))out.push('CREDIT_BAIL');
  return uniq(out.length?out:['AUTRE']);
}

export function fromAidesEntreprises(raw,audit=null){
  const reject=reason=>{if(audit)audit[reason]=(audit[reason]||0)+1;return null};
  const rid=String(raw.id_aid||'');if(!rid)return reject('missingId');
  const natures=asArr(raw?.cache_indexation?.natures);
  const nids=new Set(natures.map(x=>String(x.id_typ)));
  const pids=new Set(asArr(raw?.cache_indexation?.profils).map(x=>String(x.id_tut)));
  const regions=uniq(asArr(raw?.cache_indexation?.territoires).map(x=>REGION_MAP[x.ter_libelle]).filter(Boolean));
  // Aides Entreprises est déjà une base dédiée aux entreprises : l'absence d'un profil\n  // de taille explicite ne doit pas supprimer la fiche de la bibliothèque. Les profils\n  // servent uniquement à alimenter les filtres PME/ETI/GE/Startup.\n  if(!regions.length)return reject('regionNotMapped');

  const natureLabels=natures.map(x=>String(x.typ_libelle||''));
  const srcs=asArr(raw?.complements?.source).filter(x=>x?.lien).map(x=>({label:htmlToText(x.texte||'Source officielle'),url:x.lien,date:x.date||null}));
  const regs=asArr(raw?.complements?.reglement).filter(x=>x?.lien).map(x=>({label:htmlToText(x.texte||'Règlement'),url:x.lien,date:x.date||null}));
  const forms=asArr(raw?.complements?.formulaire).filter(x=>x?.lien).map(x=>({label:htmlToText(x.texte||'Formulaire'),url:x.lien,date:x.date||null}));
  const txt=[raw.aid_nom,raw.aid_objet,raw.aid_benef,raw.aid_operations_el,raw.aid_conditions].map(htmlToText).join(' ');
  const financial=htmlToText(raw.aid_montant)||'';
  const allText=[txt,financial,...natureLabels].join(' ');
  const cats=[];
  if(pids.has('4'))cats.push('PME');
  if(pids.has('10'))cats.push('ETI','GE');
  cats.unshift(...normalizeCompanyCategories(txt).filter(x=>x==='STARTUP'));
  const aidTypes=broadAidTypes(natures,allText);

  const dl=raw.date_fin&&!String(raw.date_fin).startsWith('0000')?String(raw.date_fin).slice(0,10):null;
  const rates=detectRates(financial),amounts=detectCurrencyAmounts(financial),official=srcs[0]?.url||null,themes=inferThemes(txt),programme=/france\s*2030/i.test(txt)?'France 2030':null;
  const stock='https://data.aides-entreprises.fr/stock';
  const ev=[['objective',raw.aid_objet],['beneficiaries',raw.aid_benef],['eligibleExpenses',raw.aid_operations_el],['prerequisites',raw.aid_conditions],['financialTerms',raw.aid_montant],['calendar',dl]]
    .filter(([,v])=>v)
    .map(([field,v])=>({field,sourceUrl:stock,sourceTier:'C',locator:`Aides Entreprises Open Data — fiche ${rid}`,evidenceText:htmlToText(v).slice(0,650),checkedAt:new Date().toISOString()}));

  return{
    id:`ae_${rid}`,canonicalId:`qf_ae_${rid}`,sourceId:'aides_entreprises',sourceRecordId:rid,
    title:htmlToText(raw.aid_nom),
    kind:(nids.has('14')||aidTypes.includes('APPEL_A_PROJET')||/appel\s+[aà]\s+projets?|\bAAP\b|appel\s+[aà]\s+manifestation|\bAMI\b/i.test(`${raw.aid_nom||''} ${raw.aid_objet||''}`))?'AAP / AMI':'AIDE',
    objective:htmlToText(raw.aid_objet)||null,beneficiaries:htmlToText(raw.aid_benef)||null,
    companyCategories:uniq(cats),themes,
    scope:regions.includes('Toutes les Régions')?'NATIONAL':'REGIONAL',regions,aidTypes,
    aidRate:{min:rates.length?Math.min(...rates):null,max:rates.length?Math.max(...rates):null,raw:financial||null,byCompanySize:[]},
    aidAmount:{min:amounts.length?Math.min(...amounts):null,max:amounts.length?Math.max(...amounts):null,raw:financial||null,byCompanySize:[]},
    projectsExpected:uniq(asArr(raw?.cache_indexation?.projets).map(x=>x.proj_libelle).filter(x=>x&&!/^Toutes les aides$/i.test(x))),
    eligibleExpenses:htmlToText(raw.aid_operations_el)||null,excludedExpenses:null,
    openingDate:null,closingDate:dl,finalClosingDate:dl,deadlines:dl?[{date:dl,type:'CLOTURE'}]:[],permanent:false,
    prerequisites:htmlToText(raw.aid_conditions)||null,selectionCriteria:null,programme,operator:null,
    attentionPoints:dl?[]:['Date de clôture non documentée : recontrôler la source officielle avant recommandation.'],
    cdcLinks:regs.filter(x=>/pdf|cahier|reglement|règlement/i.test(`${x.label} ${x.url}`)),
    sourceLinks:srcs,regulationLinks:regs,formLinks:forms,officialPage:official||stock,apiUrl:null,
    funder:uniq(asArr(raw?.cache_indexation?.financeurs).map(x=>x.org_nom)),
    projectLabels:uniq(asArr(raw?.cache_indexation?.projets).map(x=>x.proj_libelle).filter(Boolean)),
    natureLabels:uniq(natureLabels.filter(Boolean)),
    verification:{status:'A_REVERIFIER',sourceTier:'C',lastChecked:new Date().toISOString(),fieldEvidence:ev},
    sourceUpdatedAt:raw.maj||raw.horodatage||null,sourceValidationDate:raw.aid_validation||null,rawFinancialText:financial||null
  };
}

export { broadAidTypes };
