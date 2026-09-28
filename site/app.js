'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const arr=v=>Array.isArray(v)?v:(v==null||v===''?[]:[v]);
const uniq=a=>[...new Set(a.filter(Boolean))];
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,"'").replace(/[^a-z0-9%€+\- /]/g,' ').replace(/\s+/g,' ').trim();
const fmtDate=v=>{if(!v)return'—';const d=new Date(v+'T00:00:00');return isNaN(d)?v:d.toLocaleDateString('fr-FR')};
const money=v=>v==null?'—':new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v);
const missing=()=>'<span class="missing">NON DOCUMENTÉ — À VÉRIFIER</span>';
const aidTypeLabel=t=>({SUBVENTION:'Subvention',AVANCE_REMBOURSABLE:'Avance remboursable',PRET_TAUX_ZERO:'Prêt à taux zéro',PRET:'Prêt',BONIFICATION_INTERET:"Bonification d’intérêt",GARANTIE:'Garantie',ALLEGEMENT_FISCAL:'Allègement fiscal',PARTICIPATION_CAPITAL:'Participation au capital',APPEL_A_PROJET:'Appel à projets',ACCOMPAGNEMENT_GRATUIT:'Accompagnement gratuit',CREDIT_BAIL:'Crédit-bail',AUTRE:'Autre dispositif'}[t]||t);
const CONFIG=window.LEYTON_RADAR_CONFIG||{minRelevance:85};
const REGIONS=['Auvergne-Rhône-Alpes','Bourgogne-Franche-Comté','Bretagne','Centre-Val de Loire','Corse','Grand Est','Hauts-de-France','Île-de-France','Normandie','Nouvelle-Aquitaine','Occitanie','Pays de la Loire','Provence-Alpes-Côte d’Azur','Guadeloupe','Guyane','Martinique','La Réunion','Mayotte'];
const TYPES=['R&D / Innovation','Investissement productif','Transition numérique','Transition écologique'];
const MATURITY=['À préciser','Faisabilité','PoC','Prototype','Démonstrateur / pilote','Première industrialisation','Investissement / déploiement'];
const DEFAULT_PROJECT={company:'',siren:'',category:'À préciser',startup:false,region:'À préciser',projectSite:'',sector:'',naf:'',employees:'',turnover:'',balanceSheet:'',group:'À vérifier',creationDate:'',legalForm:'',name:'',budget:'',types:[],summary:'',expenses:'',startDate:'',endDate:'',maturity:'À préciser',partners:'',impacts:'',jobs:'',environment:'',digital:'',financing:'',otherAids:''};
const STORAGE='qualifund-project-v12.4';
const LEGACY_STORAGES=['leyton-radar-project-v12.3','leyton-radar-project-v12.2','leyton-radar-project-v12.1','leyton-radar-project-v12'];
const LIVE_DB='qualifund-live-v12.4.0',LIVE_STORE='kv',LIVE_LIBRARY_KEY='library',LIVE_REFRESH_KEY='last-refresh';
function loadProjectState(){
  try{
    const current=localStorage.getItem(STORAGE);
    if(current)return{...DEFAULT_PROJECT,...JSON.parse(current)};
    for(const key of LEGACY_STORAGES){
      const raw=localStorage.getItem(key);
      if(!raw)continue;
      const migrated={...DEFAULT_PROJECT,...JSON.parse(raw)};
      localStorage.setItem(STORAGE,JSON.stringify(migrated));
      return migrated;
    }
  }catch{}
  return{...DEFAULT_PROJECT};
}
const state={route:'home',studyStep:1,lib:[],meta:{},coverage:[],changes:[],sources:[],readiness:null,project:loadProjectState(),lastResults:[]};
const today=()=>new Date().toISOString().slice(0,10);
const daysUntil=v=>v?Math.floor((new Date(v+'T23:59:59')-new Date(today()+'T00:00:00'))/86400000):null;
const bootstrap=()=>window.__LEYTON_RADAR_BOOTSTRAP__||window.__QUALIFUND_BOOTSTRAP__||null;
async function fetchJsonStrict(url){
  const r=await fetch(url,{cache:'no-store',headers:{Accept:'application/json'}});
  if(!r.ok)throw new Error(`HTTP ${r.status} — ${url}`);
  const text=await r.text();
  if(/^\s*</.test(text))throw new Error(`Réponse HTML reçue à la place du JSON — ${url}`);
  try{return JSON.parse(text)}catch(e){throw new Error(`JSON invalide — ${url} — ${e.message}`)}
}
async function chunkedLibrary(manifestPath='./data/library-manifest.json'){
  const m=await fetchJsonStrict(manifestPath),base=manifestPath.slice(0,manifestPath.lastIndexOf('/')+1);
  if(!Array.isArray(m.parts)||!m.parts.length)throw new Error('Manifeste de bibliothèque vide ou invalide.');
  const chunks=[];
  for(const part of m.parts)chunks.push(await fetchJsonStrict(base+part));
  const aaps=chunks.flatMap(x=>Array.isArray(x)?x:(x.aaps||[]));
  if(m.count!=null&&aaps.length!==Number(m.count))throw new Error(`Bibliothèque incomplète : ${aaps.length}/${m.count} fiches chargées.`);
  return{meta:m.meta||{},aaps};
}
const api=async p=>{
  if(p.includes('library.json')){
    try{return await chunkedLibrary('./data/library-manifest.json')}
    catch(e){const b=bootstrap();if(b?.library)return b.library;throw e}
  }
  try{return await fetchJsonStrict(p)}
  catch(e){const b=bootstrap();if(b){if(p.includes('coverage.json'))return b.coverage;if(p.includes('changes.json'))return b.changes;if(p.includes('sources.json'))return b.sources;if(p.includes('production-readiness.json')&&window.__LEYTON_RADAR_READINESS__)return window.__LEYTON_RADAR_READINESS__}throw e}
};
const idbOpen=()=>new Promise((resolve,reject)=>{try{const q=indexedDB.open(LIVE_DB,1);q.onupgradeneeded=()=>{const db=q.result;if(!db.objectStoreNames.contains(LIVE_STORE))db.createObjectStore(LIVE_STORE)};q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)}catch(e){reject(e)}});
async function liveGet(key){try{const db=await idbOpen();return await new Promise((resolve,reject)=>{const tx=db.transaction(LIVE_STORE,'readonly'),q=tx.objectStore(LIVE_STORE).get(key);q.onsuccess=()=>resolve(q.result??null);q.onerror=()=>reject(q.error)})}catch{return null}}
async function liveSet(key,value){const db=await idbOpen();return new Promise((resolve,reject)=>{const tx=db.transaction(LIVE_STORE,'readwrite');tx.objectStore(LIVE_STORE).put(value,key);tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error)})}
const REGION_ALIASES={'FRANCE':'Toutes les Régions','Grand-Est':'Grand Est','Nouvelle Aquitaine':'Nouvelle-Aquitaine','Région Sud':'Provence-Alpes-Côte d’Azur','Bourgogne-Franche Comté':'Bourgogne-Franche-Comté','Hauts-de-France':'Hauts-de-France','Normandie':'Normandie','Auvergne-Rhône-Alpes':'Auvergne-Rhône-Alpes','Occitanie':'Occitanie','Île-de-France':'Île-de-France','BRETAGNE':'Bretagne','Pays-de-la-Loire':'Pays de la Loire','Centre-Val de Loire':'Centre-Val de Loire','Corse':'Corse','GUADELOUPE':'Guadeloupe','GUYANE':'Guyane','MARTINIQUE':'Martinique','REUNION':'La Réunion','MAYOTTE':'Mayotte'};
const clientHtml=s=>String(s??'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
const clientAmounts=t=>[...String(t||'').matchAll(/(\d{1,3}(?:[ .\u00a0]\d{3})*(?:[,.]\d+)?)\s*(k|m)?\s*(?:€|euros?)/gi)].map(m=>{let v=Number(m[1].replace(/[ .\u00a0]/g,'').replace(',','.'));if((m[2]||'').toLowerCase()==='k')v*=1e3;if((m[2]||'').toLowerCase()==='m')v*=1e6;return v}).filter(Number.isFinite);
const clientRates=t=>[...String(t||'').matchAll(/(\d{1,3}(?:[,.]\d+)?)\s*%/g)].map(m=>Number(m[1].replace(',','.'))).filter(v=>v>=0&&v<=100);
function clientAidTypes(text,natures=[]){const t=norm([text,...natures].join(' ')),out=[];if(/subvention|aide non remboursable|dotation/.test(t))out.push('SUBVENTION');if(/avance remboursable|avance recuperable/.test(t))out.push('AVANCE_REMBOURSABLE');if(/pret d'honneur|pret a taux zero|pret a taux 0|sans interet|taux d'interet zero|taux d'interet 0/.test(t))out.push('PRET_TAUX_ZERO');if(/\bpret\b|emprunt|credit moyen terme|credit long terme/.test(t))out.push('PRET');if(/bonification d.?interet|bonification de taux/.test(t))out.push('BONIFICATION_INTERET');if(/garantie|cautionnement/.test(t))out.push('GARANTIE');if(/allegement fiscal|credit d.?impot|exoneration|reduction d.?impot|fiscal/.test(t))out.push('ALLEGEMENT_FISCAL');if(/participation au capital|prise de participation|capital investissement|fonds propres|equity/.test(t))out.push('PARTICIPATION_CAPITAL');if(/appel a projets?|appel a manifestation|\baap\b|\bami\b/.test(t))out.push('APPEL_A_PROJET');if(/accompagnement gratuit|accompagnement non financier|conseil gratuit|diagnostic gratuit/.test(t))out.push('ACCOMPAGNEMENT_GRATUIT');if(/credit[- ]?bail|leasing/.test(t))out.push('CREDIT_BAIL');return uniq(out.length?out:['AUTRE'])}
function clientThemes(text){const t=norm(text),out=[];if(/innovation|r&d|recherche|prototype|demonstrateur|deeptech|technolog/.test(t))out.push('R&D / Innovation');if(/investissement|industrial|production|machine|equipement|usine|modernisation/.test(t))out.push('Investissement productif');if(/numerique|digital|logiciel|cloud|data|intelligence artificielle|cyber|robot/.test(t))out.push('Transition numérique');if(/ecolog|decarbon|energie|carbone|recycl|eau|environnement|sobriete|renouvelable/.test(t))out.push('Transition écologique');return uniq(out)}
function clientProjectScope(text){return clientThemes(text).length>0}
function clientCats(text,profileIds=[]){const t=norm(text),out=[];if(profileIds.includes('4')||/\bpme\b|\btpe\b|petite.*moyenne/.test(t))out.push('PME');if(profileIds.includes('10')||/\beti\b/.test(t))out.push('ETI');if(profileIds.includes('10')||/grande entreprise|\bge\b/.test(t))out.push('GE');if(/start[- ]?up|jeune entreprise innovante/.test(t))out.push('STARTUP');return uniq(out)}
function clientEvidence(field,value,url,tier='C'){if(!value)return null;return{field,sourceUrl:url,sourceTier:tier,locator:'Mise à jour navigateur',evidenceText:String(value).slice(0,650),checkedAt:new Date().toISOString()}}
function clientAE(raw){const rid=String(raw?.id_aid||'');if(!rid||Number(raw?.status||1)!==1)return null;const natures=arr(raw?.cache_indexation?.natures),natureLabels=natures.map(x=>String(x?.typ_libelle||'')),nids=new Set(natures.map(x=>String(x?.id_typ))),pids=arr(raw?.cache_indexation?.profils).map(x=>String(x?.id_tut)),regions=uniq(arr(raw?.cache_indexation?.territoires).map(x=>REGION_ALIASES[x?.ter_libelle]).filter(Boolean));if(!regions.length)return null;const title=clientHtml(raw.aid_nom),objective=clientHtml(raw.aid_objet),benef=clientHtml(raw.aid_benef),eligible=clientHtml(raw.aid_operations_el),pre=clientHtml(raw.aid_conditions),financial=clientHtml(raw.aid_montant),all=[title,objective,benef,eligible,pre,financial,...natureLabels].join(' '),types=clientAidTypes(all,natureLabels);const src=arr(raw?.complements?.source).find(x=>x?.lien),dl=raw.date_fin&&!String(raw.date_fin).startsWith('0000')?String(raw.date_fin).slice(0,10):null,am=clientAmounts(financial),rt=clientRates(financial),stock='https://data.aides-entreprises.fr/stock',evidence=[clientEvidence('objective',objective,stock),clientEvidence('beneficiaries',benef,stock),clientEvidence('eligibleExpenses',eligible,stock),clientEvidence('prerequisites',pre,stock),clientEvidence('financialTerms',financial,stock),clientEvidence('calendar',dl,stock)].filter(Boolean);return{id:`ae_${rid}`,canonicalId:`qf_ae_${rid}`,sourceId:'aides_entreprises',sourceRecordId:rid,title,kind:/appel\s+[aà]\s+projets?|\bAAP\b|\bAMI\b/i.test(all)?'AAP / AMI':'AIDE',objective:objective||null,beneficiaries:benef||null,companyCategories:clientCats(all,pids),themes:clientThemes(all),scope:regions.includes('Toutes les Régions')?'NATIONAL':'REGIONAL',regions,aidTypes:uniq(types),aidRate:{min:rt.length?Math.min(...rt):null,max:rt.length?Math.max(...rt):null,raw:financial||null,byCompanySize:[]},aidAmount:{min:am.length?Math.min(...am):null,max:am.length?Math.max(...am):null,raw:financial||null,byCompanySize:[]},projectsExpected:uniq(arr(raw?.cache_indexation?.projets).map(x=>x?.proj_libelle).filter(Boolean)),eligibleExpenses:eligible||null,excludedExpenses:null,openingDate:null,closingDate:dl,finalClosingDate:dl,deadlines:dl?[{date:dl,type:'CLOTURE'}]:[],permanent:false,prerequisites:pre||null,selectionCriteria:null,programme:/france\s*2030/i.test(all)?'France 2030':null,operator:null,attentionPoints:dl?[]:['Date/relève à sécuriser avant recommandation.'],cdcLinks:arr(raw?.complements?.reglement).filter(x=>x?.lien&&/pdf|cahier|reglement|règlement/i.test(`${x.texte||''} ${x.lien}`)).map(x=>({label:clientHtml(x.texte||'Règlement'),url:x.lien})),sourceLinks:src?[{label:clientHtml(src.texte||'Source officielle'),url:src.lien}]:[],regulationLinks:[],formLinks:[],officialPage:src?.lien||stock,apiUrl:null,funder:uniq(arr(raw?.cache_indexation?.financeurs).map(x=>x?.org_nom).filter(Boolean)),projectLabels:uniq(arr(raw?.cache_indexation?.projets).map(x=>x?.proj_libelle).filter(Boolean)),natureLabels,verification:{status:'A_REVERIFIER',sourceTier:'C',lastChecked:new Date().toISOString(),fieldEvidence:evidence,completeness:55,confidence:18},sourceUpdatedAt:raw.maj||raw.horodatage||null,lifecycleStatus:'ACTIVE'}}
function clientAT(row){const aud=arr(row?.targeted_audiences).map(norm);if(!aud.some(x=>x==='private_sector'||/entreprises? priv/.test(x)))return null;const title=clientHtml(row?.name||row?.short_title),objective=clientHtml(row?.description),elig=clientHtml(row?.eligibility),full=[title,objective,elig,...arr(row?.aid_types)].join(' '),types=clientAidTypes(full,arr(row?.aid_types));if(!types.length||!clientProjectScope(full))return null;const p=norm(row?.perimeter),regions=REGIONS.filter(r=>p.includes(norm(r)));const national=/france entiere|national|toute la france|france metropolitaine/.test(p);if(!national&&!regions.length)return null;const rid=String(row?.id||row?.slug||'');if(!rid)return null;const dl=String(row?.submission_deadline||'').match(/^\d{4}-\d{2}-\d{2}/)?.[0]||null,amountRaw=[row?.recoverable_advance_amount,row?.loan_amount].filter(Boolean).join(' ; '),am=clientAmounts(amountRaw),rateMin=Number.isFinite(Number(row?.subvention_rate_lower_bound))?Number(row.subvention_rate_lower_bound):null,rateMax=Number.isFinite(Number(row?.subvention_rate_upper_bound))?Number(row.subvention_rate_upper_bound):null,atUrl=row?.url?new URL(String(row.url),'https://aides-territoires.beta.gouv.fr').href:`https://aides-territoires.beta.gouv.fr/aides/${row?.slug||rid}/`,evidence=[clientEvidence('objective',objective,atUrl),clientEvidence('beneficiaries',arr(row?.targeted_audiences).join(', '),atUrl),clientEvidence('prerequisites',elig,atUrl),clientEvidence('financialTerms',amountRaw||`${rateMin??''}-${rateMax??''}%`,atUrl),clientEvidence('calendar',dl||row?.recurrence,atUrl)].filter(Boolean);return{id:`at_${rid}`,canonicalId:`qf_at_${rid}`,sourceId:'aides_territoires',sourceRecordId:rid,title,kind:row?.is_call_for_project?'AAP / AMI':'AIDE',objective:objective||null,beneficiaries:arr(row?.targeted_audiences).join(', ')||null,companyCategories:clientCats(full),themes:clientThemes(full),scope:national?'NATIONAL':'REGIONAL',regions:national?['Toutes les Régions']:regions,aidTypes:types,aidRate:{min:rateMin,max:rateMax,raw:(rateMin!=null||rateMax!=null)?`${rateMin??''}-${rateMax??''}%`:null,byCompanySize:[]},aidAmount:{min:am.length?Math.min(...am):null,max:am.length?Math.max(...am):null,raw:amountRaw||null,byCompanySize:[]},projectsExpected:arr(row?.project_examples).map(clientHtml).filter(Boolean),eligibleExpenses:null,excludedExpenses:null,openingDate:String(row?.start_date||'').match(/^\d{4}-\d{2}-\d{2}/)?.[0]||null,closingDate:dl,finalClosingDate:dl,deadlines:dl?[{date:dl,type:'CLOTURE'}]:[],permanent:false,prerequisites:elig||null,selectionCriteria:null,programme:arr(row?.programs).join(' | ')||null,operator:arr(row?.instructors).join(' | ')||null,attentionPoints:[],cdcLinks:[],sourceLinks:uniq([row?.origin_url,atUrl].filter(Boolean)).map((url,i)=>({label:i?'Aides Territoires':'Source d’origine',url})),regulationLinks:[],formLinks:row?.application_url?[{label:'Candidater',url:row.application_url}]:[],officialPage:row?.origin_url||atUrl,apiUrl:null,funder:arr(row?.financers),projectLabels:arr(row?.categories),natureLabels:arr(row?.aid_types),verification:{status:'A_REVERIFIER',sourceTier:'C',lastChecked:new Date().toISOString(),fieldEvidence:evidence,completeness:48,confidence:18},sourceUpdatedAt:row?.date_updated||null,lifecycleStatus:'ACTIVE'}}
function clientKey(a){try{if(a.officialPage&&/^https?:/.test(a.officialPage)){const u=new URL(a.officialPage);u.hash='';['utm_source','utm_medium','utm_campaign','fbclid'].forEach(k=>u.searchParams.delete(k));return 'u:'+u.href.replace(/\/$/,'')}}catch{}return 't:'+norm(a.title)+'|'+a.scope+'|'+arr(a.regions).sort().join(',')}
function clientDedupe(list){const m=new Map();for(const a of list){const k=clientKey(a);if(!m.has(k))m.set(k,a);else{const old=m.get(k),types=uniq([...arr(old.aidTypes),...arr(a.aidTypes)]),sources=uniq([...arr(old.sourceAliases),old.sourceId,...arr(a.sourceAliases),a.sourceId]);m.set(k,{...old,...a,aidTypes:types,sourceAliases:sources,sourceId:old.sourceId||a.sourceId})}}return [...m.values()]}
function replaceClientSource(base,sourceId,records){return clientDedupe([...base.filter(a=>a.sourceId!==sourceId&&!arr(a.sourceAliases).includes(sourceId)),...records])}
async function saveClientLibrary(note='Mise à jour navigateur'){state.meta={...state.meta,version:'12.3.0',generatedAt:new Date().toISOString(),clientLocal:true,clientNote:note,libraryCount:state.lib.length,activeCount:state.lib.filter(a=>a.lifecycleStatus!=='ARCHIVE').length};try{await liveSet(LIVE_LIBRARY_KEY,{meta:state.meta,aaps:state.lib,coverage:state.coverage,changes:state.changes});await liveSet(LIVE_REFRESH_KEY,Date.now());state.meta.clientPersistence='indexeddb'}catch(e){state.meta.clientPersistence='session-only';console.warn('Persistance IndexedDB indisponible : la mise à jour reste active pour cette session.',e)}}
async function loadClientLibrary(){const x=await liveGet(LIVE_LIBRARY_KEY),publishedCount=state.lib.length,localCount=x?.aaps?.length||0;if(localCount>=publishedCount&&localCount>0&&(!state.meta.generatedAt||String(x.meta?.generatedAt||'')>String(state.meta.generatedAt||''))){state.lib=x.aaps;state.meta={...state.meta,...x.meta};if(Array.isArray(x.coverage)&&x.coverage.length)state.coverage=x.coverage;if(Array.isArray(x.changes))state.changes=x.changes;return true}if(localCount>0&&localCount<publishedCount)console.info(`Cache navigateur ignoré : ${localCount} fiches locales < ${publishedCount} fiches publiées.`);return false}
async function fetchClientJson(url){const r=await fetch(url,{cache:'no-store',mode:'cors',headers:{Accept:'application/json'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()}
async function refreshAidesTerritoiresClient(){const url='https://aides-territoires.beta.gouv.fr/api/aids/all/';const j=await fetchClientJson(url),rows=Array.isArray(j)?j:(j?.results||j?.data||j?.aids||[]),mapped=rows.map(clientAT).filter(Boolean);if(rows.length<500||mapped.length===0)throw new Error(`volume non concluant (${rows.length}/${mapped.length})`);state.lib=replaceClientSource(state.lib,'aides_territoires',mapped);return{sourceId:'aides_territoires',discovered:rows.length,imported:mapped.length}}
async function refreshAidesEntreprisesClient(json=null){const url='https://data.aides-entreprises.fr/files/aides.json',j=json||await fetchClientJson(url),rows=Array.isArray(j)?j:(j?.data||j?.results||j?.aides||[]),mapped=rows.map(clientAE).filter(Boolean);if(rows.length<1000||mapped.length<100)throw new Error(`volume non concluant (${rows.length}/${mapped.length})`);state.lib=replaceClientSource(state.lib,'aides_entreprises',mapped);return{sourceId:'aides_entreprises',discovered:rows.length,imported:mapped.length}}
function coverageUpsert(r,success,message){const id=r?.sourceId||'client';const row={id,name:id==='aides_entreprises'?'Aides Entreprises — live navigateur':'Aides Territoires — live navigateur',scope:'France',success,discovered:r?.discovered||0,imported:r?.imported||0,message,checkedAt:new Date().toISOString(),lastSuccessfulAt:success?new Date().toISOString():null,clientMode:true};state.coverage=[...state.coverage.filter(x=>x.id!==id),row]}
async function clientLiveRefresh({full=true,silent=false}={}){if(!navigator.onLine)throw new Error('Navigateur hors ligne');const before=new Set(state.lib.map(a=>a.id)),done=[],errors=[];if(!silent)toast('Actualisation live en cours depuis les sources publiques…');try{const r=await refreshAidesTerritoiresClient();done.push(r);coverageUpsert(r,true,`${r.imported} fiches retenues`)}catch(e){errors.push(`Aides Territoires: ${e.message}`);coverageUpsert({sourceId:'aides_territoires'},false,e.message)}if(full){try{const r=await refreshAidesEntreprisesClient();done.push(r);coverageUpsert(r,true,`${r.imported} fiches retenues`)}catch(e){errors.push(`Aides Entreprises: ${e.message}`);coverageUpsert({sourceId:'aides_entreprises'},false,`${e.message} — utiliser « Importer stock officiel » si le navigateur bloque CORS.`)}}const created=state.lib.filter(a=>!before.has(a.id)).map(a=>({type:'CREATION_LIVE',id:a.id,title:a.title,at:new Date().toISOString()}));state.changes=[...state.changes,...created].slice(-1200);if(done.length){await saveClientLibrary(`Live navigateur: ${done.map(x=>x.sourceId).join(', ')}`);render()}if(!silent)toast(done.length?`Mise à jour terminée : ${done.reduce((n,x)=>n+x.imported,0)} fiches importées/rafraîchies.${errors.length?' Certaines sources sont bloquées par le navigateur.':''}`:`Aucune source live accessible. ${errors.join(' · ')}`);if(!done.length)throw new Error(errors.join(' · ')||'Aucune source accessible');return{done,errors}}
async function importOfficialStockFile(file){if(!file)return;toast('Lecture du stock officiel Aides Entreprises…');const text=await file.text(),j=JSON.parse(text),r=await refreshAidesEntreprisesClient(j);coverageUpsert(r,true,`Stock officiel importé localement: ${r.imported} fiches retenues`);await saveClientLibrary('Stock Aides Entreprises importé manuellement');render();toast(`Stock officiel importé : ${r.imported} fiches Qualifund retenues.`)}
const hostedProduction=()=>/^https?:$/.test(location.protocol);
async function maybeAutoClientRefresh(){if(hostedProduction()||CONFIG.refreshEndpoint||!navigator.onLine)return;const last=Number(await liveGet(LIVE_REFRESH_KEY)||0);if(Date.now()-last<20*3600*1000)return;clientLiveRefresh({full:true,silent:true}).catch(()=>{})}
function scheduleClientDailyRefresh(){if(hostedProduction()||CONFIG.refreshEndpoint)return;setInterval(async()=>{if(!navigator.onLine)return;const parts=Object.fromEntries(new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date()).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));if(parts.hour!=='02'||Number(parts.minute)>4)return;const last=Number(await liveGet(LIVE_REFRESH_KEY)||0);if(Date.now()-last<6*3600*1000)return;clientLiveRefresh({full:true,silent:true}).catch(()=>{})},60000)}

function toast(msg){const t=$('#toast');t.innerHTML=msg;t.classList.remove('hidden');clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>t.classList.add('hidden'),4200)}
function permanentVerified(a){return Boolean(a.permanent&&arr(a.verification?.fieldEvidence).some(e=>e.field==='calendar'&&['A','B'].includes(e.sourceTier)))}
function nextDeadline(a){if(a.permanent)return permanentVerified(a)?{ok:true,date:null,reason:'PERMANENT'}:{ok:false,date:null,reason:'PERMANENT_UNVERIFIED'};const ds=uniq([...arr(a.deadlines).map(x=>typeof x==='string'?x:x?.date),a.finalClosingDate,a.closingDate].filter(Boolean)).sort();for(const d of ds)if(daysUntil(d)>=1)return{ok:true,date:d,reason:'DEADLINE'};return{ok:false,date:ds.find(d=>daysUntil(d)>=0)||ds.at(-1)||null,reason:ds.length?'J1':'DATE_MISSING'}}
function usableAid(a){
  if(!a||['ARCHIVE','STALE'].includes(a.lifecycleStatus))return false;
  const t=norm(a.title||'');
  if(!t||t.length<4)return false;
  if(/desole.*offre.*plus disponible|offre.*plus disponible|document officiel|page introuvable|page non trouvee|erreur 404|404 not found|access denied|forbidden|service indisponible|site en maintenance/.test(t))return false;
  const nd=nextDeadline(a);
  if(nd.reason==='J1'&&nd.date&&daysUntil(nd.date)<1)return false;
  return true;
}
function officialUrl(a){
  const candidates=[a?.officialPage,...arr(a?.sourceLinks).map(x=>typeof x==='string'?x:x?.url),...arr(a?.formLinks).map(x=>typeof x==='string'?x:x?.url)];
  return candidates.find(u=>/^https?:\/\//i.test(String(u||''))&&!/data\.aides-entreprises\.fr\/stock\/?(?:$|[?#])/i.test(String(u)))||null;
}

async function loadAll(){const j=await api('./data/library.json');state.lib=j.aaps||[];state.meta=j.meta||{};for(const[k,p]of[['coverage','./data/coverage.json'],['changes','./data/changes.json']])try{state[k]=await api(p)}catch{};try{state.sources=(await api('./data/sources.json')).sources||[]}catch{};try{state.readiness=await api('./data/production-readiness.json')}catch{};await loadClientLibrary();render();const deep=new URLSearchParams(location.search).get('aid');if(deep&&state.lib.some(a=>a.id===deep))openAid(deep)}
function route(r){state.route=r;$$('.nav[data-route]').forEach(x=>x.classList.toggle('active',x.dataset.route===r));$('#sidebar')?.classList.remove('open');render()}
$$('.nav[data-route]').forEach(b=>b.onclick=()=>route(b.dataset.route));
$('#today').textContent=new Date().toLocaleDateString('fr-FR');
$('#modalClose').onclick=()=>$('#modal').classList.add('hidden');
$('#modal').onclick=e=>{if(e.target.id==='modal')$('#modal').classList.add('hidden')};
$('#mobileNav').onclick=()=>$('#sidebar').classList.toggle('open');
const SIDEBAR_PREF='qualifund-sidebar-collapsed';
function setSidebarCollapsed(collapsed){const layout=document.querySelector('.layout'),btn=$('#sidebarToggle');layout?.classList.toggle('sidebar-collapsed',collapsed);if(btn){btn.textContent=collapsed?'Afficher la colonne gauche':'Masquer la colonne gauche';btn.setAttribute('aria-pressed',String(collapsed))}try{localStorage.setItem(SIDEBAR_PREF,collapsed?'1':'0')}catch{}}
if($('#sidebarToggle')){$('#sidebarToggle').onclick=()=>setSidebarCollapsed(!document.querySelector('.layout')?.classList.contains('sidebar-collapsed'));try{setSidebarCollapsed(localStorage.getItem(SIDEBAR_PREF)==='1')}catch{setSidebarCollapsed(false)}}
$('#refreshBtn').onclick=async()=>{await loadAll();toast('Dernière bibliothèque publiée rechargée.')};
$('#collectBtn').onclick=requestCollection;
$('#importStockBtn')?.addEventListener('click',()=>$('#importStockInput')?.click());
$('#importStockInput')?.addEventListener('change',e=>importOfficialStockFile(e.target.files?.[0]).catch(err=>toast(`Import impossible : ${esc(err.message)}`)));
function counts(){const active=state.lib.filter(a=>!['ARCHIVE','STALE'].includes(a.lifecycleStatus)),verified=active.filter(x=>x.verification?.status==='VERIFIE').length;return{all:active.length,aap:active.filter(x=>String(x.kind).includes('AAP')).length,verified,j1:active.filter(x=>nextDeadline(x).ok).length,docs:active.filter(x=>arr(x.cdcLinks).length).length,complete:active.filter(x=>(x.verification?.completeness||0)>=80).length}}
function render(){({home,study,library,watch,sources,production}[state.route]||home)()}
function home(){
  const corpus=state.lib.filter(usableAid),aap=corpus.filter(x=>String(x.kind).includes('AAP')).length;
  const regions=uniq(corpus.flatMap(x=>arr(x.regions)).filter(x=>x&&x!=='Toutes les Régions')).length;
  $('#app').innerHTML=`<section class="hero"><div class="eyebrow">QUALIFUND</div><h1>Cartographiez les aides publiques adaptées à chaque projet.</h1><p>QUALIFUND rapproche les caractéristiques de l’entreprise et la description du projet des dispositifs nationaux et régionaux, puis restitue une cartographie structurée avec les critères financiers, le calendrier, les pré-requis et les sources officielles.</p><div class="hero-actions"><button class="btn primary" id="newStudy">Cartographier un projet</button><button class="btn" id="goLibrary">Explorer la bibliothèque</button></div></section>
  <div class="grid g4" style="margin-top:18px"><div class="metric"><b>${corpus.length}</b><span>dispositifs exploitables</span></div><div class="metric"><b>${aap}</b><span>AAP / AMI identifiés</span></div><div class="metric"><b>${state.sources.length||state.meta.sourceCount||'—'}</b><span>sources officielles suivies</span></div><div class="metric"><b>${regions}</b><span>régions couvertes</span></div></div>
  <div class="grid g2" style="margin-top:16px"><div class="card"><h3>Dernière actualisation</h3><p><b>${state.meta.generatedAt?new Date(state.meta.generatedAt).toLocaleString('fr-FR'):'Bibliothèque publiée'}</b></p><p class="mini">La bibliothèque est versionnée et actualisée à partir de sources publiques nationales et régionales.</p><button class="btn small" id="goWatch">Voir les changements</button></div><div class="card"><h3>Parcours consultant</h3><div class="criteria"><div class="criterion"><span>1. Entreprise & projet</span><strong>Profil, région, description, budget</strong></div><div class="criterion"><span>2. Cartographie</span><strong>Rapprochement déterministe sans IA</strong></div><div class="criterion"><span>3. Faisabilité</span><strong>Éligibilité, financement, calendrier, pré-requis</strong></div></div></div></div>`;
  $('#newStudy').onclick=()=>{state.studyStep=1;route('study')};$('#goLibrary').onclick=()=>route('library');$('#goWatch').onclick=()=>route('watch');
}
function field(id,label,value,type='text',hint=''){return`<div class="field-wrap"><label class="field" for="${id}">${esc(label)}</label><input id="${id}" class="input" type="${type}" value="${esc(value||'')}">${hint?`<div class="mini">${esc(hint)}</div>`:''}</div>`}
function area(id,label,value,hint=''){return`<div class="field-wrap"><label class="field" for="${id}">${esc(label)}</label><textarea id="${id}" class="input">${esc(value||'')}</textarea>${hint?`<div class="mini">${esc(hint)}</div>`:''}</div>`}
function select(id,label,opts,val){return`<div class="field-wrap"><label class="field" for="${id}">${esc(label)}</label><select id="${id}" class="input">${opts.map(x=>`<option ${x===val?'selected':''}>${esc(x)}</option>`).join('')}</select></div>`}
function stepper(){return`<div class="wizard">${['Entreprise','Projet','Budget & calendrier','Cartographie'].map((x,i)=>`<span class="step ${state.studyStep===i+1?'active':state.studyStep>i+1?'done':''}">${i+1}. ${x}</span>`).join('')}</div>`}
function study(){const p=state.project;let body='';if(state.studyStep===1)body=`<div class="grid g2"><div class="card"><h3>Identité entreprise</h3><div class="grid g2"><div>${field('qSiren','SIREN / SIRET',p.siren,'text','Recherche dans l’API publique Annuaire des Entreprises.')}</div><div style="align-self:end"><button class="btn dark" id="lookupSiren">Rechercher le SIREN</button></div></div>${field('qCompany','Raison sociale',p.company)}<div class="grid g2"><div>${select('qCategory','Catégorie',['À préciser','PME','ETI','GE'],p.category)}</div><div>${select('qStartup','Start-up',['Non','Oui'],p.startup?'Oui':'Non')}</div></div>${field('qLegalForm','Forme juridique',p.legalForm)}${field('qCreationDate','Date de création',p.creationDate,'date')}</div><div class="card"><h3>Profil économique</h3>${select('qRegion','Région du projet',['À préciser',...REGIONS],p.region)}${field('qProjectSite','Site / implantation du projet',p.projectSite)}${field('qSector','Secteur / activité réelle',p.sector)}${field('qNaf','Code NAF / APE',p.naf)}<div class="grid g2"><div>${field('qEmployees','Effectif',p.employees,'number')}</div><div>${field('qTurnover','CA annuel (€)',p.turnover,'number')}</div></div>${field('qBalance','Total bilan (€)',p.balanceSheet,'number')}${select('qGroup','Situation groupe',['Autonome','Filiale / groupe','À vérifier'],p.group)}</div></div>`;if(state.studyStep===2)body=`<div class="grid g2"><div class="card"><h3>Projet</h3>${field('qName','Nom du projet',p.name)}<label class="field">Typologies</label><div class="tagset">${TYPES.map(t=>`<label class="pill"><input class="qType" type="checkbox" value="${esc(t)}" ${arr(p.types).includes(t)?'checked':''}> ${esc(t)}</label>`).join('')}</div>${area('qSummary','Description détaillée du projet',p.summary,'Champ central du rapprochement : décrire les objectifs, travaux, livrables, verrous, nouveauté et résultats attendus.')}${select('qMaturity','Maturité',MATURITY,p.maturity)}</div><div class="card"><h3>Travaux & impacts</h3>${area('qPartners','Partenaires / consortium',p.partners)}${area('qImpacts','Impacts attendus',p.impacts)}${field('qJobs','Emplois créés / maintenus',p.jobs)}${area('qEnvironment','Impacts environnementaux / énergie / carbone',p.environment)}${area('qDigital','Volet numérique / IA / cyber / robotisation',p.digital)}</div></div>`;if(state.studyStep===3)body=`<div class="grid g2"><div class="card"><h3>Budget & dépenses</h3>${field('qBudget','Budget total du projet (€)',p.budget,'number')}${area('qExpenses','Dépenses / lots de coûts',p.expenses,'Préciser personnel, équipements, sous-traitance, études, bâtiment, logiciels, etc.')}${area('qFinancing','Plan de financement',p.financing,'Fonds propres, dette, autres financements, reste à financer.')}${area('qOtherAids','Autres aides publiques demandées / obtenues',p.otherAids)}</div><div class="card"><h3>Calendrier</h3><div class="grid g2"><div>${field('qStart','Démarrage prévu',p.startDate,'date')}</div><div>${field('qEnd','Fin prévue',p.endDate,'date')}</div></div><div class="callout warn"><b>Effet incitatif :</b> le moteur signale les dispositifs exigeant un dépôt avant démarrage, mais la preuve réglementaire reste prioritaire.</div><div class="study-summary"><b>Lecture de la cartographie :</b><p>Forte pertinence ≥ ${CONFIG.minRelevance||85}% ; à approfondir entre 70 % et ${CONFIG.minRelevance||85}% ; correspondances potentielles à partir de 55 %. Le niveau de preuve documentaire reste affiché séparément.</p></div></div></div>`;if(state.studyStep===4)body=`<div class="card"><h3>Cartographie approfondie du projet</h3><p>QUALIFUND croise chaque dispositif avec le projet sur neuf dimensions et sépare strictement éligibilité, pertinence et niveau de preuve :</p><div class="grid g3"><div class="metric"><b>1</b><span>Éligibilité</span><small>territoire, entreprise, calendrier, budget, exclusions, prérequis connus</small></div><div class="metric"><b>2</b><span>Pertinence</span><small>objectifs, typologie, dépenses, sélection, finance, calendrier/maturité, territorialité</small></div><div class="metric"><b>3</b><span>Preuve</span><small>CdC/règlement, source officielle, complétude documentaire</small></div></div><div class="callout"><b>Important :</b> un score de 92 % signifie « forte adéquation projet / dispositif », et non « 92 % de chances d’obtenir le financement ».</div><button class="btn primary" id="runStudy">Lancer la cartographie & faisabilité</button></div><div id="studyResults"></div>`;$('#app').innerHTML=`<div class="page-head"><div><div class="eyebrow">Étude de faisabilité</div><h1>Entreprise + projet → aides pertinentes</h1><p class="sub">Parcours consultant structuré. Les données restent dans votre navigateur et ne sont pas envoyées à la bibliothèque publique.</p></div></div>${stepper()}${body}<div class="form-actions"><button class="btn" id="prevStep" ${state.studyStep===1?'disabled':''}>← Précédent</button><button class="btn primary" id="nextStep" ${state.studyStep===4?'disabled':''}>Suivant →</button></div>`;bindStudy()}
function bindStudy(){const prev=$('#prevStep'),next=$('#nextStep');if(prev)prev.onclick=()=>{saveVisible();state.studyStep--;study()};if(next)next.onclick=()=>{saveVisible();state.studyStep++;study()};if($('#lookupSiren'))$('#lookupSiren').onclick=lookupSiren;if($('#runStudy'))$('#runStudy').onclick=()=>{saveVisible();runFeasibility()}}
function saveVisible(){const p={...state.project};const read=(id,key=id)=>{const el=$('#'+id);if(el)p[key]=el.value};for(const [id,key] of [['qSiren','siren'],['qCompany','company'],['qLegalForm','legalForm'],['qCreationDate','creationDate'],['qRegion','region'],['qProjectSite','projectSite'],['qSector','sector'],['qNaf','naf'],['qEmployees','employees'],['qTurnover','turnover'],['qBalance','balanceSheet'],['qGroup','group'],['qName','name'],['qSummary','summary'],['qMaturity','maturity'],['qPartners','partners'],['qImpacts','impacts'],['qJobs','jobs'],['qEnvironment','environment'],['qDigital','digital'],['qBudget','budget'],['qExpenses','expenses'],['qFinancing','financing'],['qOtherAids','otherAids'],['qStart','startDate'],['qEnd','endDate']])read(id,key);if($('#qCategory'))p.category=$('#qCategory').value;if($('#qStartup'))p.startup=$('#qStartup').value==='Oui';if($$('.qType').length)p.types=$$('.qType:checked').map(x=>x.value);state.project=p;localStorage.setItem(STORAGE,JSON.stringify(p))}
async function lookupSiren(){saveVisible();const raw=String(state.project.siren||'').replace(/\D/g,'');if(raw.length!==9&&raw.length!==14){toast('SIREN attendu : 9 chiffres ; SIRET : 14 chiffres.');return}const q=raw.length===14?raw.slice(0,9):raw;try{toast('Recherche entreprise en cours…');let x=null;if(CONFIG.companyEndpoint){try{const sr=await fetch(`${CONFIG.companyEndpoint}?siren=${encodeURIComponent(q)}`);if(sr.ok){const sj=await sr.json();x=sj.official?{nom_complet:sj.official.company,activite_principale:sj.official.naf,nature_juridique:sj.official.legalForm,date_creation:sj.official.creationDate,tranche_effectif_salarie:sj.official.employees,libelle_activite_principale:sj.official.sector}:null}}catch{}}if(!x){const url=`${CONFIG.sirenApi||'https://recherche-entreprises.api.gouv.fr/search'}?q=${encodeURIComponent(q)}&per_page=1`;const r=await fetch(url,{headers:{Accept:'application/json'}});if(!r.ok)throw new Error('HTTP '+r.status);const j=await r.json();x=j.results?.[0]}if(!x)throw new Error('Entreprise non trouvée');state.project={...state.project,company:x.nom_complet||x.nom_raison_sociale||state.project.company,naf:x.activite_principale||state.project.naf,legalForm:x.nature_juridique||state.project.legalForm,creationDate:x.date_creation||state.project.creationDate,employees:x.tranche_effectif_salarie||state.project.employees,sector:x.libelle_activite_principale||state.project.sector};localStorage.setItem(STORAGE,JSON.stringify(state.project));study();toast('Entreprise enrichie depuis une source publique officielle.') }catch(e){toast(`Recherche SIREN indisponible : ${esc(e.message)}. Saisie manuelle conservée.`)}}
const STOP=new Set('avec dans pour des les une aux sur par est sont etre cette ces leur leurs ainsi plus entre peut ou et du de la le un au en d une tout tous toutes projet entreprise entreprises aide aides financement programme appel'.split(' '));
function tokens(s){return uniq(norm(s).split(' ').filter(x=>x.length>3&&!STOP.has(x)))}
const CONCEPTS={innovation:['innovation','r&d','recherche','prototype','poc','demonstrateur','technologie','experimental','brevet'],industrialisation:['industrialisation','usine','production','machine','equipement','capacite','ligne','atelier'],digital:['numerique','digital','logiciel','data','cloud','saas','automatisation'],ai:['ia','intelligence artificielle','machine learning','apprentissage'],cyber:['cyber','cybersecurite','securite informatique'],decarbonation:['decarbonation','carbone','co2','gaz a effet de serre','sobriete'],energy:['energie','energetique','chaleur','electrique','hydrogene','photovolta'],circular:['economie circulaire','recyclage','reemploi','matiere recyclee','dechet','ecoconception'],water:['eau','hydrique','reutilisation','effluent'],health:['sante','medical','biotherapie','dispositif medical','medicament'],agri:['agriculture','agricole','agroalimentaire','elevage','viticulture'],mobility:['mobilite','transport','vehicule','ferroviaire'],aero:['aeronautique','spatial','aerospace','drone'],maritime:['maritime','naval','portuaire','aquaculture'],tourism:['tourisme','hotel','hebergement'],culture:['cinema','audiovisuel','jeu video','livre','culture']};
function conceptSet(text){const n=norm(text),out=[];for(const[k,ws]of Object.entries(CONCEPTS))if(ws.some(w=>n.includes(norm(w))))out.push(k);return out}
function lexical(text,queryTokens){if(!queryTokens.length)return 0;const s=new Set(tokens(text)),hits=queryTokens.filter(t=>s.has(t)).length;return Math.min(1,hits/Math.max(4,Math.ceil(queryTokens.length*.35)))}
function conceptMatch(a,b){const A=new Set(conceptSet(a)),B=new Set(conceptSet(b));if(!B.size)return 0;let h=0;for(const x of B)if(A.has(x))h++;return Math.min(1,h/Math.max(1,Math.ceil(B.size*.6)))}
function typeFit(a,p){const at=norm([a.title,a.objective,...arr(a.themes),...arr(a.projectsExpected)].join(' '));let h=0;for(const t of p.types){const c={'R&D / Innovation':['innovation','recherche','prototype','demonstrateur'],'Investissement productif':['investissement','industrialisation','production','equipement','machine'],'Transition numérique':['numerique','digital','ia','cyber','logiciel','robot'],'Transition écologique':['decarbonation','energie','recyclage','eau','ecologique','sobriete']}[t]||[];if(c.some(x=>at.includes(norm(x))))h++}return p.types.length?Math.min(1,h/p.types.length):0}
function maturityFit(a,p){if(!p.maturity||p.maturity==='À préciser')return 0.5;const m=norm(p.maturity),t=norm([a.objective,...arr(a.projectsExpected),a.prerequisites].join(' '));const groups={faisabilite:['faisabilite','etude'],poc:['poc','preuve de concept','faisabilite'],prototype:['prototype','prototypage'],demonstrateur:['demonstrateur','pilote','demonstration'],industrialisation:['industrialisation','premiere usine','pre-industrialisation'],investissement:['investissement','deploiement','modernisation','production']};let key=Object.keys(groups).find(k=>m.includes(k))||null;if(!key)return 0.5;return groups[key].some(x=>t.includes(norm(x)))?1:0.25}
function specializedMismatch(a,p){const at=norm([a.title,a.objective,a.beneficiaries,...arr(a.themes),...arr(a.projectsExpected),...arr(a.funder)].join(' ')),pt=norm([p.sector,p.naf,p.summary].join(' '));for(const[d,ws]of Object.entries(CONCEPTS)){if(['culture','agri','tourism','health','maritime','aero'].includes(d)&&ws.filter(w=>at.includes(norm(w))).length>=3&&!ws.some(w=>pt.includes(norm(w))))return`Dispositif sectoriel ${d} sans correspondance suffisante dans le projet`}return null}
function explicitExclusion(a,p){const pt=tokens([p.sector,p.naf].join(' '));if(!pt.length)return null;const parts=String([a.beneficiaries,a.prerequisites,a.excludedExpenses].filter(Boolean).join(' ')).split(/(?<=[.;])/);for(const s of parts){if(!/(ne sont pas [ée]ligibles|non [ée]ligibles|exclus|exclues|hors)/i.test(s))continue;const nt=norm(s),hits=pt.filter(t=>nt.includes(t));if(hits.length)return`Exclusion sectorielle potentielle : ${hits.join(', ')}`}return null}
function eligibility(a,p){
  const criteria=[],block=[];
  const evidence=field=>arr(a.verification?.fieldEvidence).find(e=>e.field===field&&/^https?:/.test(e.sourceUrl||'')&&String(e.evidenceText||'').trim());
  const add=(label,status,detail,field,hard=false)=>{
    const ev=field?evidence(field):null;
    criteria.push({label,status,detail,sourceUrl:ev?.sourceUrl||null,sourceTier:ev?.sourceTier||null,hard});
    if(hard&&status==='NON CONFORME')block.push(detail||label);
  };
  const types=arr(a.aidTypes),cats=arr(a.companyCategories),regions=arr(a.regions);
  const targetInstruments=['SUBVENTION','AVANCE_REMBOURSABLE','PRET_TAUX_ZERO'];
  const hasTargetInstrument=types.some(x=>targetInstruments.includes(x));
  add('Instrument',hasTargetInstrument?'CONFORME':'NON CONFORME',types.length?types.map(aidTypeLabel).join(', '):'Instrument non documenté','financialTerms',types.length>0);

  add('Statut','CONFORME','Dispositif actif dans la bibliothèque publiée','calendar',true);

  const projectCat=p.startup?'STARTUP':p.category;
  if(cats.length&&projectCat&&projectCat!=='À préciser'){
    const match=cats.includes(projectCat)||(p.startup&&cats.includes('STARTUP'))||(!p.startup&&cats.includes(p.category));
    add('Taille entreprise',match?'CONFORME':'NON CONFORME',`Bénéficiaires déclarés : ${cats.join(', ')} · profil projet : ${projectCat}`,'beneficiaries',true);
  }else add('Taille entreprise','À VÉRIFIER',cats.length?`Bénéficiaires déclarés : ${cats.join(', ')}`:'Taille d’entreprise non documentée','beneficiaries');

  if(a.scope==='NATIONAL')add('Territoire','CONFORME','Portée nationale','beneficiaries',true);
  else if(a.scope==='REGIONAL'&&p.region&&p.region!=='À préciser'){
    const match=regions.includes(p.region)||regions.includes('Toutes les Régions');
    add('Territoire',match?'CONFORME':'NON CONFORME',`Territoires du dispositif : ${regions.join(', ')||'non documentés'} · région du projet : ${p.region}`,'beneficiaries',true);
  }else add('Territoire','À VÉRIFIER',`Territoires du dispositif : ${regions.join(', ')||'non documentés'}`,'beneficiaries');

  const nd=nextDeadline(a);
  if(nd.reason==='J1'&&nd.date&&daysUntil(nd.date)<1)add('Calendrier','NON CONFORME',`Échéance dépassée ou non exploitable : ${fmtDate(nd.date)}`,'calendar',true);
  else if(nd.ok)add('Calendrier','CONFORME',a.permanent?'Dispositif permanent':'Prochaine échéance exploitable : '+fmtDate(nd.date),'calendar',true);
  else add('Calendrier','À VÉRIFIER',a.permanent?'Permanence à confirmer':'Date de clôture non documentée','calendar');

  const budget=Number(p.budget||0),min=Number.isFinite(Number(a.minimumProjectCost))?Number(a.minimumProjectCost):null,max=Number.isFinite(Number(a.maximumProjectCost))?Number(a.maximumProjectCost):null;
  if(budget>0&&(min!=null||max!=null)){
    const mismatch=(min!=null&&budget<min)||(max!=null&&budget>max);
    add('Budget',mismatch?'NON CONFORME':'CONFORME',`Budget projet : ${money(budget)} · assiette connue : ${min!=null?'min '+money(min):'min non documenté'} / ${max!=null?'max '+money(max):'max non documenté'}`,'financialTerms',true);
  }else add('Budget','À VÉRIFIER',`Budget projet : ${budget>0?money(budget):'non renseigné'} · assiette : ${min!=null?'min '+money(min):'min non documenté'} / ${max!=null?'max '+money(max):'max non documenté'}`,'financialTerms');

  const explicit=explicitExclusion(a,p);
  if(explicit)add('Secteur','NON CONFORME',explicit,'beneficiaries',true);
  else {
    const specialized=specializedMismatch(a,p);
    add('Secteur',specialized?'À VÉRIFIER':'CONFORME',specialized||'Aucune exclusion sectorielle explicite détectée dans les données structurées','beneficiaries');
  }

  add('Dépenses éligibles',a.eligibleExpenses?'À VÉRIFIER':'À VÉRIFIER',a.eligibleExpenses?'Les postes seront rapprochés des dépenses publiées':'Dépenses éligibles non documentées','eligibleExpenses');
  add('Pré-requis','À VÉRIFIER',a.prerequisites?'Les pré-requis seront rapprochés du profil et de la maturité':'Pré-requis non documentés','prerequisites');
  add('Critères de sélection','À VÉRIFIER',a.selectionCriteria?'Les critères seront rapprochés des impacts, travaux, partenaires et maturité':'Critères de sélection non documentés','selectionCriteria');

  const confirmed=criteria.filter(x=>x.hard).length>0&&criteria.filter(x=>x.hard).every(x=>x.status==='CONFORME');
  return{eligible:block.length===0,status:block.length?'NON CONFORME':confirmed?'CONFORME':'À VÉRIFIER',criteria,next:nd,blocking:block};
}
function relevance(a,p){if(window.LEYTON_SCORING?.relevance)return window.LEYTON_SCORING.relevance(a,p);throw new Error('Moteur de pertinence partagé indisponible.')}
function validateProjectForStudy(p){
  const missingFields=[];
  if(!p.category||p.category==='À préciser')missingFields.push('catégorie de l’entreprise');
  if(!p.region||p.region==='À préciser')missingFields.push('région du projet');
  if(!String(p.sector||'').trim())missingFields.push('secteur / activité réelle');
  if(String(p.summary||'').trim().length<40)missingFields.push('description détaillée du projet (40 caractères minimum)');
  if(!(Number(p.budget)>0))missingFields.push('budget total du projet');
  return missingFields;
}
async function runFeasibility(){
  const p=state.project,root=$('#studyResults');
  if(!root)return;
  const missingFields=validateProjectForStudy(p);
  if(missingFields.length){
    root.innerHTML=`<div class="callout warn"><b>Analyse non lancée : informations indispensables manquantes.</b><br>${esc(missingFields.join(' · '))}</div>`;
    root.scrollIntoView({behavior:'smooth',block:'start'});
    return;
  }

  const started=performance.now(),corpus=state.lib.filter(usableAid),scored=[],rejected=[];
  root.innerHTML=`<div class="analysis-progress"><div class="row between"><b>Cartographie en cours</b><span id="analysisProgressLabel">0 / ${corpus.length}</span></div><div class="progress"><i id="analysisProgressBar" style="width:0%"></i></div><p class="mini">Contrôle de l’éligibilité, puis rapprochement déterministe sur 9 dimensions.</p></div>`;

  for(let i=0;i<corpus.length;i++){
    const a=corpus[i],e=eligibility(a,p);
    if(e.eligible){
      const rel=relevance(a,p);
      scored.push({a,elig:e,relevance:rel,confidence:a.verification?.confidence||0,completeness:a.verification?.completeness||0});
    }else rejected.push({a,elig:e});
    if(i%120===0||i===corpus.length-1){
      const pct=Math.round(((i+1)/Math.max(1,corpus.length))*100);
      const bar=$('#analysisProgressBar'),label=$('#analysisProgressLabel');
      if(bar)bar.style.width=pct+'%';
      if(label)label.textContent=`${i+1} / ${corpus.length}`;
      await new Promise(requestAnimationFrame);
    }
  }

  scored.sort((x,y)=>y.relevance.score-x.relevance.score||y.confidence-x.confidence||y.completeness-x.completeness);
  const strongFloor=CONFIG.minRelevance||85;
  const priorities=scored.filter(x=>x.relevance.score>=strongFloor).slice(0,10);
  const priorityIds=new Set(priorities.map(x=>x.a.id));
  const leads=scored.filter(x=>!priorityIds.has(x.a.id)&&x.relevance.score>=70).slice(0,10);
  const leadIds=new Set(leads.map(x=>x.a.id));
  const potentials=scored.filter(x=>!priorityIds.has(x.a.id)&&!leadIds.has(x.a.id)&&x.relevance.score>=55).slice(0,8);
  const shownIds=new Set([...priorities,...leads,...potentials].map(x=>x.a.id));
  const bestBelow=scored.filter(x=>!shownIds.has(x.a.id)).slice(0,5);
  const duration=Math.round(performance.now()-started);
  const checks=scored.reduce((n,x)=>n+(x.relevance.checks||x.relevance.dims?.length||9),0)+corpus.length*7;
  state.lastResults=[...priorities,...leads,...potentials,...(!priorities.length&&!leads.length&&!potentials.length?bestBelow:[])];

  root.innerHTML=`<div class="section-title"><h2>Cartographie des dispositifs pertinents</h2></div>
  <div class="card study-kpi"><div class="grid g4">
    <div class="metric"><b>${corpus.length}</b><span>dispositifs analysés</span></div>
    <div class="metric"><b>${priorities.length}</b><span>forte pertinence</span><small>≥ ${strongFloor}%</small></div>
    <div class="metric"><b>${leads.length}</b><span>à approfondir</span><small>70–${strongFloor-1}%</small></div>
    <div class="metric"><b>${potentials.length}</b><span>potentiels</span><small>55–69%</small></div>
  </div>
  <div class="analysis-audit"><b>${checks.toLocaleString('fr-FR')} contrôles exécutés</b> sur ${corpus.length.toLocaleString('fr-FR')} dispositifs en ${duration.toLocaleString('fr-FR')} ms · ${rejected.length.toLocaleString('fr-FR')} incompatibilités bloquantes écartées · ${scored.length.toLocaleString('fr-FR')} dispositifs scorés.</div></div>

  <div class="section-title"><h3>Forte pertinence</h3></div>
  ${priorities.length?priorities.map((x,i)=>resultCard(x,i+1,'FORTE PERTINENCE')).join(''):'<div class="callout">Aucun dispositif n’atteint 85 %. Les meilleures correspondances restent visibles dans les niveaux suivants.</div>'}
  <div class="section-title"><h3>À approfondir</h3></div>
  ${leads.length?leads.map((x,i)=>resultCard(x,i+1,'À APPROFONDIR')).join(''):'<div class="callout">Aucune correspondance entre 70 % et ${strongFloor-1} %.</div>'}
  ${potentials.length?`<div class="section-title"><h3>Correspondances potentielles</h3></div>${potentials.map((x,i)=>resultCard(x,i+1,'POTENTIEL')).join('')}`:''}
  ${!priorities.length&&!leads.length&&!potentials.length&&bestBelow.length?`<div class="section-title"><h3>Meilleures correspondances disponibles</h3></div><div class="callout warn">Aucune fiche ne dépasse 55 %. Les cinq meilleures correspondances sont affichées à titre de diagnostic, sans recommandation.</div>${bestBelow.map((x,i)=>resultCard(x,i+1,'FAIBLE CONCORDANCE')).join('')}`:''}`;
  root.scrollIntoView({behavior:'smooth',block:'start'});
}
function securityPoints(r){const a=r.a,pts=[];for(const c of r.elig.criteria)if(c.status==='À VÉRIFIER')pts.push(`${c.label} : ${c.detail||'à confirmer'}`);if(a.verification?.status!=='VERIFIE')pts.push('Preuves A/B incomplètes : fiche à revalider avant recommandation ferme.');for(const x of arr(a.attentionPoints))if(x&&!pts.includes(x))pts.push(x);return uniq(pts).sort((x,y)=>Number(/^(Critères de sélection|Pré-requis|Dépenses éligibles)/.test(y))-Number(/^(Critères de sélection|Pré-requis|Dépenses éligibles)/.test(x))).slice(0,10)}
function eligibilityComment(r){
  const preferred=['Territoire','Taille entreprise','Calendrier','Budget','Pré-requis'];
  const by=new Map(r.elig.criteria.map(x=>[x.label,x]));
  const sentences=[];
  for(const label of preferred){
    const x=by.get(label);if(!x)continue;
    const prefix=x.status==='CONFORME'?'Compatible':x.status==='NON CONFORME'?'Non compatible':'À confirmer';
    sentences.push(`${label} : ${prefix.toLowerCase()} — ${x.detail||'vérification requise'}.`);
    if(sentences.length>=5)break;
  }
  return sentences.join(' ');
}
function financialHtml(a){
  const types=arr(a.aidTypes).map(aidTypeLabel).join(' + ')||'À documenter';
  const base=`${a.minimumProjectCost!=null?money(a.minimumProjectCost):'—'} à ${a.maximumProjectCost!=null?money(a.maximumProjectCost):'—'}`;
  const amount=(a.aidAmount?.min!=null||a.aidAmount?.max!=null)?`${money(a.aidAmount?.min)} à ${money(a.aidAmount?.max)}`:'—';
  const rate=(a.aidRate?.min!=null||a.aidRate?.max!=null)?`${a.aidRate?.min??'—'} % à ${a.aidRate?.max??'—'} %`:'—';
  return `<p><b>Type :</b> ${esc(types)}<br><b>Assiette projet :</b> ${esc(base)}<br><b>Montant d’aide :</b> ${esc(amount)}<br><b>Taux :</b> ${esc(rate)}</p>${sizeFinance(a)}`;
}
function resultCard(r,rank,kind='À APPROFONDIR'){
  const a=r.a,url=officialUrl(a),deadlines=uniq(arr(a.deadlines).map(x=>typeof x==='string'?x:x?.date).filter(Boolean));
  const close=a.finalClosingDate||a.closingDate||null;
  const verification=a.verification?.status==='VERIFIE'?'Données vérifiées':'Données à sécuriser';
  return `<article class="result-card aid-result-block">
    <div class="row between aid-result-head">
      <div><span class="rank">#${rank}</span>
        ${url?`<a class="aid-title-link" href="${esc(url)}" target="_blank" rel="noopener">${esc(a.title)} ↗</a>`:`<span class="aid-title-link no-link">${esc(a.title)}</span>`}
        <div class="mini">${esc(arr(a.funder).join(', ')||'Financeur à documenter')}</div>
      </div>
      <div class="score">${r.relevance.score}%<small> pertinence</small></div>
    </div>
    <div class="row aid-result-badges">
      <span class="pill ${r.relevance.score>=(CONFIG.minRelevance||85)?'ok':'info'}">${esc(kind)}</span>
      ${criterionBadge(r.elig.status)}
      <span class="pill ${a.verification?.status==='VERIFIE'?'ok':'warn'}">${verification}</span>
    </div>
    <div class="aid-result-grid">
      <section><h4>Bénéficiaires</h4><p>${esc(arr(a.companyCategories).join(', ')||'Taille non documentée')}</p>${a.beneficiaries?`<p class="mini">${esc(a.beneficiaries)}</p>`:''}</section>
      <section><h4>Thématiques visées</h4><p>${esc(arr(a.themes).join(' · ')||'À documenter')}</p></section>
      <section><h4>Portée</h4><p><b>${a.scope==='NATIONAL'?'National':'Régional'}</b><br>${esc(arr(a.regions).join(', ')||'—')}</p></section>
      <section><h4>Modalités financières</h4>${financialHtml(a)}</section>
      <section class="span-2"><h4>Projets attendus</h4>${listText(a.projectsExpected)}</section>
      <section><h4>Calendrier</h4><p><b>Clôture :</b> ${a.permanent?'Permanent':fmtDate(close)}<br><b>Relèves :</b> ${deadlines.length?deadlines.map(fmtDate).join(' · '):'—'}</p></section>
      <section><h4>Pré-requis</h4>${listText(a.prerequisites)}</section>
      <section class="span-2 eligibility-note"><h4>Éligibilité — commentaire</h4><p>${esc(eligibilityComment(r))}</p></section>
    </div>
    <div class="row end aid-result-actions">
      <button class="btn small open-result" data-id="${esc(a.id)}">Voir la fiche complète</button>
      ${url?`<a class="btn primary small" href="${esc(url)}" target="_blank" rel="noopener">Ouvrir l’AAP officiel ↗</a>`:''}
    </div>
  </article>`;
}
function evidenceLine(a,field){const ev=arr(a.verification?.fieldEvidence).filter(x=>x.field===field).sort((x,y)=>({A:4,B:3,C:2,D:1}[y.sourceTier]||0)-({A:4,B:3,C:2,D:1}[x.sourceTier]||0))[0];if(!ev)return'';return`<div class="proof">Preuve <b>${esc(ev.sourceTier||'?')}</b> · ${esc(ev.locator||'source')} · <a class="link" target="_blank" rel="noopener" href="${esc(ev.sourceUrl)}">ouvrir ↗</a>${ev.evidenceText?`<br>${esc(ev.evidenceText)}`:''}</div>`}
function docsHtml(a){const d=uniq(arr(a.cdcLinks).map(x=>typeof x==='string'?x:x?.url)).filter(Boolean);if(!d.length)return missing();return d.map((url,i)=>`<a class="btn small" target="_blank" rel="noopener" href="${esc(url)}">${i===0?'CdC / règlement':'Annexe '+(i+1)} ↗</a>`).join(' ')}
function sizeFinance(a){const rows=arr(a.aidAmount?.byCompanySize).length?arr(a.aidAmount.byCompanySize):arr(a.aidRate?.byCompanySize);if(!rows.length)return missing();return`<table class="smalltable"><thead><tr><th>Taille</th><th>Taux</th><th>Montant</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.category)}</td><td>${x.rateMin!=null||x.rateMax!=null||x.min!=null||x.max!=null?`${x.rateMin??x.min??'—'}–${x.rateMax??x.max??'—'} %`:'—'}</td><td>${x.amountMin!=null||x.amountMax!=null?`${money(x.amountMin)} – ${money(x.amountMax)}`:'—'}</td></tr>`).join('')}</tbody></table>`}
function box(title,content,evidence=''){return`<div class="sheet-box"><h4>${esc(title)}</h4>${content}${evidence}</div>`}
function openAid(id){const a=state.lib.find(x=>x.id===id);if(!a)return;const nd=nextDeadline(a);$('#modalContent').innerHTML=`<div class="sheet-title"><div class="eyebrow">FICHE QUALIFUND · ${esc(a.kind||'AIDE')}</div><h2>${esc(a.title)}</h2><div class="row"><span class="badge ${a.verification?.status==='VERIFIE'?'ok':'warn'}">${esc(a.verification?.status||'A_REVERIFIER')}</span><span class="badge info">Complétude ${a.verification?.completeness||0}%</span><span class="badge info">Confiance ${a.verification?.confidence||0}%</span>${arr(a.aidTypes).map(x=>`<span class="pill ok">${esc(aidTypeLabel(x))}</span>`).join('')}</div></div><div class="sheet-grid">${box('Objectif',listText(a.objective),evidenceLine(a,'objective'))}${box('Thématiques visées',listText(a.themes),evidenceLine(a,'themes'))}${box('Bénéficiaires',listText(a.beneficiaries),evidenceLine(a,'beneficiaries'))}${box('Portée / région',`<p><b>${a.scope==='NATIONAL'?'National':'Régional'}</b><br>${esc(arr(a.regions).join(', '))}</p>`)}${box('Financeur / opérateur',`<p>${esc(arr(a.funder).join(', ')||'—')}<br>${esc(a.operator||a.programme||'—')}</p>`)}${box('Type d’aide',listText(a.aidTypes),evidenceLine(a,'financialTerms'))}${box('Répartition SUB / AR',listText(a.aidSplit||a.subArSplit))}${box('Assiette projet',`<p><b>Min :</b> ${a.minimumProjectCost!=null?money(a.minimumProjectCost):'—'}<br><b>Max :</b> ${a.maximumProjectCost!=null?money(a.maximumProjectCost):'—'}</p>`)}${box('Montant d’aide',a.aidAmount?.min!=null||a.aidAmount?.max!=null?`<p>${money(a.aidAmount?.min)} à ${money(a.aidAmount?.max)}</p>`:missing(),evidenceLine(a,'financialTerms'))}${box('Taux d’aide',a.aidRate?.min!=null||a.aidRate?.max!=null?`<p>${a.aidRate?.min??'—'} % à ${a.aidRate?.max??'—'} %</p>`:missing(),evidenceLine(a,'financialTerms'))}${box('Taux / montants par taille',sizeFinance(a))}${box('Projets attendus',listText(a.projectsExpected),evidenceLine(a,'projectsExpected'))}${box('Dépenses éligibles',listText(a.eligibleExpenses),evidenceLine(a,'eligibleExpenses'))}${box('Dépenses exclues',listText(a.excludedExpenses),evidenceLine(a,'excludedExpenses'))}${box('Pré-requis',listText(a.prerequisites),evidenceLine(a,'prerequisites'))}${box('Critères de sélection',listText(a.selectionCriteria),evidenceLine(a,'selectionCriteria'))}${box('Calendrier',`<p><b>Ouverture :</b> ${fmtDate(a.openingDate)}<br><b>Relèves :</b> ${arr(a.deadlines).length?arr(a.deadlines).map(x=>fmtDate(typeof x==='string'?x:x?.date)).join(' · '):'—'}<br><b>Clôture finale :</b> ${fmtDate(a.finalClosingDate||a.closingDate)}<br><b>Prochaine accessible :</b> ${a.permanent?'Permanent':fmtDate(nd.date)}</p>`,evidenceLine(a,'calendar'))}${box('Modalités de versement',listText(a.disbursementTerms||a.paymentTerms),evidenceLine(a,'disbursementTerms'))}${box('Remboursement AR',listText(a.repaymentTerms),evidenceLine(a,'repaymentTerms'))}${box('Aides d’État / cumul',listText(a.stateAidRules||a.cumulationRules),evidenceLine(a,'stateAidRules'))}<div class="sheet-box wide"><h4>Points de vigilance</h4>${arr(a.attentionPoints).length?arr(a.attentionPoints).map(x=>`<div class="attention">${esc(x)}</div>`).join(''):missing()}</div><div class="sheet-box wide"><h4>CdC / règlement / annexes</h4><div class="row">${docsHtml(a)}</div></div><div class="sheet-box wide"><h4>Traçabilité</h4><p class="mini">ID : ${esc(a.canonicalId||a.id)} · Dernier contrôle : ${esc(a.verification?.lastChecked||'—')} · Mise à jour source : ${esc(a.sourceUpdatedAt||'—')}</p>${arr(a.sourceLinks).slice(0,12).map(s=>`<p><a class="link" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label||'Source officielle')} ↗</a></p>`).join('')}${arr(a.verification?.fieldEvidence).slice(0,40).map(e=>`<div class="proof"><b>${esc(e.field)}</b> — niveau ${esc(e.sourceTier||'?')} — ${esc(e.locator||'')} — <a class="link" target="_blank" rel="noopener" href="${esc(e.sourceUrl)}">source ↗</a>${e.evidenceText?`<br>${esc(e.evidenceText)}`:''}</div>`).join('')}</div></div><div class="row end" style="margin-top:16px"><button class="btn" onclick="window.print()">Imprimer / PDF</button>${a.officialPage?`<a class="btn primary" target="_blank" rel="noopener" href="${esc(a.officialPage)}">Page officielle ↗</a>`:''}</div>`;$('#modal').classList.remove('hidden')}
function csvCell(v){return '"'+String(v??'').replaceAll('"','""').replace(/\r?\n/g,' ')+'"'}
function exportLibraryCsv(rows){
  const header=['Nom AAP / aide','Financeurs','Bénéficiaires / taille','Thématiques visées','Portée','Régions','Type aide','Assiette min','Assiette max','Montant aide min','Montant aide max','Taux min','Taux max','Taux / montants par taille','Projets attendus','Dépenses éligibles','Pré-requis','Critères de sélection','Relèves','Date de clôture','Lien officiel','Statut vérification'];
  const lines=[header.map(csvCell).join(';')];
  for(const a of rows){
    const bySize=arr(a.aidAmount?.byCompanySize).concat(arr(a.aidRate?.byCompanySize)).map(x=>`${x.category||''}: taux ${x.rateMin??x.min??'—'}-${x.rateMax??x.max??'—'}%; montant ${x.amountMin??'—'}-${x.amountMax??'—'}`).join(' | ');
    lines.push([
      a.title,arr(a.funder).join(' | '),[arr(a.companyCategories).join(' / '),a.beneficiaries].filter(Boolean).join(' — '),arr(a.themes).join(' | '),
      a.scope==='NATIONAL'?'National':'Régional',arr(a.regions).join(' | '),arr(a.aidTypes).map(aidTypeLabel).join(' | '),
      a.minimumProjectCost??'',a.maximumProjectCost??'',a.aidAmount?.min??'',a.aidAmount?.max??'',a.aidRate?.min??'',a.aidRate?.max??'',bySize,
      arr(a.projectsExpected).join(' | '),a.eligibleExpenses||'',a.prerequisites||'',a.selectionCriteria||'',
      arr(a.deadlines).map(x=>typeof x==='string'?x:x?.date).filter(Boolean).join(' | '),a.finalClosingDate||a.closingDate||'',officialUrl(a)||'',a.verification?.status||''
    ].map(csvCell).join(';'));
  }
  const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
  const href=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=href;a.download=`QUALIFUND_bibliotheque_${today()}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1000);
}
function library(){
  const q=window.__q||'',region=window.__reg||'',kind=window.__kind||'',theme=window.__theme||'',instrument=window.__instrument||'',time=window.__time||'',verification=window.__ver||'',selectedCategories=window.__categories||[];
  const activeLib=state.lib.filter(usableAid);
  const themes=uniq(activeLib.flatMap(a=>arr(a.themes))).sort((a,b)=>a.localeCompare(b,'fr'));
  const instruments=uniq(activeLib.flatMap(a=>arr(a.aidTypes))).sort((a,b)=>aidTypeLabel(a).localeCompare(aidTypeLabel(b),'fr'));
  let list=activeLib.filter(a=>{
    const txt=norm([a.title,a.objective,a.beneficiaries,...arr(a.themes),...arr(a.projectsExpected),...arr(a.funder),a.programme].join(' '));
    if(q&&!txt.includes(norm(q)))return false;
    if(region&&!arr(a.regions).includes(region)&&!arr(a.regions).includes('Toutes les Régions'))return false;
    if(kind&&a.kind!==kind)return false;
    if(theme&&!arr(a.themes).includes(theme))return false;
    if(instrument&&!arr(a.aidTypes).includes(instrument))return false;
    if(time==='j1'&&!nextDeadline(a).ok)return false;
    if(time==='nodate'&&nextDeadline(a).reason!=='DATE_MISSING')return false;
    if(verification&&a.verification?.status!==verification)return false;
    if(selectedCategories.length&&!selectedCategories.some(c=>arr(a.companyCategories).includes(c)))return false;
    return true;
  }).sort((a,b)=>(nextDeadline(a).date||'9999').localeCompare(nextDeadline(b).date||'9999'));
  window.__lastLibraryList=list;
  $('#app').innerHTML=`<div class="page-head"><div><div class="eyebrow">Bibliothèque des aides et appels à projets</div><h1>Aides et appels à projets</h1><p class="sub">Catalogue exploitable : bénéficiaires, thématiques, portée, modalités financières, projets attendus, clôtures, relèves, pré-requis et lien officiel.</p></div><div class="row end"><span class="badge info">${list.length} résultat(s)</span><button class="btn primary" id="exportLibraryCsv">Exporter CSV</button></div></div>
  <div class="filters six"><input class="input" id="libQ" placeholder="Titre, objectif, thématique, financeur…" value="${esc(q)}"><select id="libRegion"><option value="">Toutes régions</option>${REGIONS.map(r=>`<option ${r===region?'selected':''}>${esc(r)}</option>`).join('')}</select><select id="libTheme" aria-label="Thématique"><option value="">Toutes thématiques</option>${themes.map(t=>`<option value="${esc(t)}" ${t===theme?'selected':''}>${esc(t)}</option>`).join('')}</select><select id="libInstrument" aria-label="Instrument"><option value="">Tous instruments</option>${instruments.map(t=>`<option value="${esc(t)}" ${t===instrument?'selected':''}>${esc(aidTypeLabel(t))}</option>`).join('')}</select><select id="libKind"><option value="">Tous les dispositifs</option><option ${kind==='AAP / AMI'?'selected':''}>AAP / AMI</option><option ${kind==='AIDE'?'selected':''}>AIDE</option></select><select id="libTime"><option value="">Toutes dates exploitables</option><option value="j1" ${time==='j1'?'selected':''}>≥ J+1 / permanent</option><option value="nodate" ${time==='nodate'?'selected':''}>Date à vérifier</option></select><select id="libVer"><option value="">Tous niveaux</option><option value="VERIFIE" ${verification==='VERIFIE'?'selected':''}>Vérifié</option><option value="A_REVERIFIER" ${verification==='A_REVERIFIER'?'selected':''}>À revérifier</option></select><button class="btn" id="libRefresh">Rafraîchir</button></div>
  <div role="group" aria-label="Taille d’entreprise" class="library-size-filter"><span class="mini">Taille d’entreprise :</span>${['PME','ETI','GE','STARTUP'].map(c=>`<label class="pill"><input type="checkbox" class="libCategory" value="${c}" ${selectedCategories.includes(c)?'checked':''}> ${c==='STARTUP'?'Startup':c}</label>`).join('')}</div>
  <div class="table-wrap"><table><thead><tr><th>Aide / AAP</th><th>Portée</th><th>Instrument</th><th>Entreprise</th><th>Échéance</th><th>CdC</th><th>Confiance</th></tr></thead><tbody>${list.map(a=>{const nd=nextDeadline(a),url=officialUrl(a);return`<tr><td>${url?`<a href="${esc(url)}" target="_blank" rel="noopener" class="link"><b>${esc(a.title)} ↗</b></a>`:`<b>${esc(a.title)}</b>`}<div class="mini">${esc(arr(a.funder).join(', ')||'Financeur à vérifier')}</div><button class="link-button open-aid" data-id="${esc(a.id)}">Voir la fiche</button></td><td>${a.scope==='NATIONAL'?'<span class="pill">National</span>':`<span class="pill">${esc(arr(a.regions).join(', '))}</span>`}</td><td>${arr(a.aidTypes).map(x=>`<span class="pill ok">${esc(aidTypeLabel(x))}</span>`).join('')}</td><td>${esc(arr(a.companyCategories).join(', ')||'—')}</td><td>${a.permanent?'Permanent':nd.date?`${fmtDate(nd.date)} <span class="mini">J+${Math.max(0,daysUntil(nd.date))}</span>`:missing()}</td><td>${arr(a.cdcLinks).length?`<span class="badge ok">${arr(a.cdcLinks).length}</span>`:'—'}</td><td><span class="badge ${a.verification?.status==='VERIFIE'?'ok':'warn'}">${a.verification?.status==='VERIFIE'?'Vérifié':'À sécuriser'} · ${a.verification?.confidence||0}%</span></td></tr>`}).join('')}</tbody></table></div>`;
  $('#libQ').oninput=e=>{window.__q=e.target.value;library()};
  $('#libRegion').onchange=e=>{window.__reg=e.target.value;library()};
  $('#libKind').onchange=e=>{window.__kind=e.target.value;library()};
  $('#libTheme').onchange=e=>{window.__theme=e.target.value;library()};
  $('#libInstrument').onchange=e=>{window.__instrument=e.target.value;library()};
  $('#libTime').onchange=e=>{window.__time=e.target.value;library()};
  $('#libVer').onchange=e=>{window.__ver=e.target.value;library()};
  $$('.libCategory').forEach(x=>x.onchange=()=>{window.__categories=$$('.libCategory:checked').map(y=>y.value);library()});
  $('#libRefresh').onclick=loadAll;
  $('#exportLibraryCsv').onclick=()=>exportLibraryCsv(window.__lastLibraryList||list);
  $$('.open-aid').forEach(x=>x.onclick=e=>{e.preventDefault();openAid(x.dataset.id)});
}
function watch(){const ch=state.changes.slice().reverse();$('#app').innerHTML=`<div class="page-head"><div><div class="eyebrow">Veille</div><h1>Changements détectés</h1><p class="sub">Nouvelles aides, modifications, fermetures, nouvelles échéances et anomalies documentaires.</p></div><button class="btn primary" id="watchCollect">Mettre à jour la cartographie</button></div><div class="grid g3"><div class="metric"><b>${ch.filter(x=>x.type==='CREATION').length}</b><span>créations enregistrées</span></div><div class="metric"><b>${ch.filter(x=>x.type==='MODIFICATION').length}</b><span>modifications</span></div><div class="metric"><b>${ch.filter(x=>/SORTIE|CLOS|ARCHIVE/.test(x.type)).length}</b><span>sorties / clôtures</span></div></div><div class="card" style="margin-top:16px"><h3>Journal</h3>${ch.length?ch.slice(0,200).map(x=>`<div class="change"><b>${esc(x.type)}</b> — ${esc(x.title||x.id)} ${arr(x.fields).length?`<span class="mini">(${esc(x.fields.join(', '))})</span>`:''}<span class="mini"> ${x.at?new Date(x.at).toLocaleString('fr-FR'):''}</span></div>`).join(''):'<div class="empty">Aucun changement enregistré dans le bootstrap actuel.</div>'}</div>`;$('#watchCollect').onclick=requestCollection}
function sourceMeta(id){return state.sources.find(s=>s.id===id)||null}
function sourceIsControl(id){const s=sourceMeta(id);return s?.type==='control'||s?.strategy==='control-only'}
function sources(){
  const rows=state.coverage||[],collectionRows=rows.filter(x=>!sourceIsControl(x.id)),controlRows=rows.filter(x=>sourceIsControl(x.id)),okRows=collectionRows.filter(x=>x.success);
  $('#app').innerHTML=`<div class="page-head"><div><div class="eyebrow">Sources officielles</div><h1>Couverture des sources publiques</h1><p class="sub">QUALIFUND consolide des sources nationales et régionales officielles. Le statut ci-dessous distingue une collecte directe validée d’une source suivie en contrôle ou encore à sécuriser techniquement.</p></div><button class="btn" id="sourcesRefresh">Rafraîchir</button></div>
  <div class="grid g3"><div class="metric"><b>${state.sources.length||state.meta.sourceCount||'—'}</b><span>sources suivies</span></div><div class="metric"><b>${okRows.length}</b><span>collectes directes validées</span></div><div class="metric"><b>${controlRows.length}</b><span>sources de contrôle</span></div></div>
  <div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Source</th><th>Périmètre</th><th>Mode de couverture</th><th>Dernier contrôle</th></tr></thead><tbody>${rows.map(x=>{const control=sourceIsControl(x.id);const label=x.success?(control?'Contrôle officiel accessible':'Collecte directe validée'):(control?'Contrôle officiel à sécuriser':'Collecte directe à sécuriser');return`<tr><td><b>${esc(x.name)}</b></td><td>${esc(x.scope)}</td><td><span class="badge ${x.success?'ok':'warn'}">${esc(label)}</span></td><td>${x.checkedAt?new Date(x.checkedAt).toLocaleString('fr-FR'):'—'}</td></tr>`}).join('')}</tbody></table></div>`;
  $('#sourcesRefresh').onclick=loadAll;
}

function production(){const r=state.readiness;const gates=r?.gates||[];$('#app').innerHTML=`<div class="page-head"><div><div class="eyebrow">Production Readiness</div><h1>Validation QUALIFUND</h1><p class="sub">Les 10 gates de passage en production. Un point n'est considéré validé qu'après preuve d'exécution réelle.</p></div><span class="badge ${r?.goProduction?'ok':'warn'}">${r?.goProduction?'GO PRODUCTION':'EN COURS'}</span></div>${gates.length?`<div class="grid g2">${gates.map(g=>`<div class="card"><div class="row between"><h3>Gate ${g.id}</h3><span class="badge ${/PASS/.test(g.status)?'ok':g.status==='FAIL'||g.status==='BLOCKED'?'block':'warn'}">${esc(g.status)}</span></div><b>${esc(g.name)}</b><p class="mini">${esc(g.detail)}</p></div>`).join('')}</div>`:'<div class="callout warn">Le rapport de readiness sera généré par le pipeline de production.</div>'}`}

async function requestCollection(){if(CONFIG.refreshEndpoint){const token=window.prompt('Code administrateur QUALIFUND (non enregistré)');if(!token)return;try{toast('Demande de collecte envoyée…');const r=await fetch(CONFIG.refreshEndpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({action:'full-refresh'})});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||('HTTP '+r.status));toast('Collecte demandée. Le rapport sera mis à jour après le cycle.')}catch(e){toast(`Impossible de déclencher la collecte : ${esc(e.message)}`)}}else if(hostedProduction()){await loadAll();toast('Bibliothèque officielle publiée rechargée. La collecte complète reste exécutée côté serveur.')}else{clientLiveRefresh({full:true,silent:false}).catch(()=>{})}}
document.addEventListener('click',e=>{const t=e.target.closest('.open-result,.open-aid');if(t){e.preventDefault();openAid(t.dataset.id)}});
loadAll().then(()=>{scheduleClientDailyRefresh();return maybeAutoClientRefresh()}).catch(e=>{$('#app').innerHTML=`<div class="callout warn"><b>Bibliothèque publiée indisponible.</b><br>${esc(e.message)}<br>La dernière version embarquée reste accessible si elle est présente.</div>`});
