'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const arr=v=>Array.isArray(v)?v:(v==null||v===''?[]:[v]);
const uniq=a=>[...new Set(a.filter(Boolean))];
const esc=v=>decodeEntities(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const entityDecoder=document.createElement('textarea');
function decodeEntities(value){
  const text=String(value??'');if(!/&(?:#\d+|#x[\da-f]+|[a-z]+);/i.test(text))return text;
  entityDecoder.innerHTML=text.replace(/</g,'&lt;').replace(/>/g,'&gt;');return entityDecoder.value;
}
const norm=s=>decodeEntities(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,"'").replace(/[^a-z0-9%€+\- /]/g,' ').replace(/\s+/g,' ').trim();
const fmtDate=v=>{if(!v)return'—';const d=new Date(v+'T00:00:00');return isNaN(d)?v:d.toLocaleDateString('fr-FR')};
const money=v=>v==null?'—':new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v);
const missing=()=>'<span class="missing">À préciser</span>';
const aidTypeLabel=t=>({SUBVENTION:'Subvention',AVANCE_REMBOURSABLE:'Avance remboursable',PRET_TAUX_ZERO:'Prêt à taux zéro',PRET:'Prêt',BONIFICATION_INTERET:"Bonification d’intérêt",GARANTIE:'Garantie',ALLEGEMENT_FISCAL:'Allègement fiscal',PARTICIPATION_CAPITAL:'Participation au capital',APPEL_A_PROJET:'Appel à projets',ACCOMPAGNEMENT_GRATUIT:'Accompagnement gratuit',CREDIT_BAIL:'Crédit-bail',AUTRE:'Autre dispositif'}[t]||t);
const CONFIG=window.LEYTON_RADAR_CONFIG||{minRelevance:80};
const REGIONS=['Auvergne-Rhône-Alpes','Bourgogne-Franche-Comté','Bretagne','Centre-Val de Loire','Corse','Grand Est','Hauts-de-France','Île-de-France','Normandie','Nouvelle-Aquitaine','Occitanie','Pays de la Loire','Provence-Alpes-Côte d’Azur','Guadeloupe','Guyane','Martinique','La Réunion','Mayotte'];
const TYPES=['R&D / Innovation','Investissement productif','Transition numérique','Transition écologique'];
const MATURITY=['À préciser','Faisabilité','PoC','Prototype','Démonstrateur / pilote','Première industrialisation','Investissement / déploiement'];
const DEFAULT_PROJECT={company:'',siren:'',category:'À préciser',startup:false,region:'À préciser',projectSite:'',sector:'',naf:'',employees:'',turnover:'',balanceSheet:'',group:'À vérifier',creationDate:'',legalForm:'',name:'',budget:'',types:[],summary:'',expenses:'',startDate:'',endDate:'',maturity:'À préciser',partners:'',impacts:'',jobs:'',environment:'',digital:'',financing:'',otherAids:''};
const STORAGE='leyton-as-project-v12.6';
const LEGACY_STORAGES=['funding-radar-project-v12.5','qualifund-project-v12.4','leyton-radar-project-v12.3','leyton-radar-project-v12.2','leyton-radar-project-v12.1','leyton-radar-project-v12'];
const LIVE_DB='funding-direct-sources-v1',LIVE_STORE='kv',LIVE_LIBRARY_KEY='library',LIVE_REFRESH_KEY='last-refresh';
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
  if(!Array.isArray(m.parts)||(m.count!==0&&!m.parts.length))throw new Error('Manifeste de bibliothèque vide ou invalide.');
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
function clientDirectUrl(raw=''){
  if(!/^https?:\/\//i.test(String(raw||'')))return null;
  try{
    const u=new URL(raw),host=u.hostname.toLowerCase(),p=(u.pathname||'/').toLowerCase().replace(/\/+$/,'')||'/';
    if(/data\.aides-entreprises\.fr$/.test(host)&&(/^\/stock$/.test(p)||/^\/files\/aides\.json$/.test(p)))return null;
    if(['/','/catalogue','/aides','/les-aides','/vos-aides','/appels','/fr/appels'].includes(p)||/accessibilite|accessibility|declaration-accessibilite|rgaa|mentions-legales|politique-confidentialite|cookies/.test(p))return null;
    return u.href;
  }catch{return null}
}
async function loadClientLibrary(){return false}
async function clientLiveRefresh(){await loadAll();toast('Les sources officielles sont collectées côté serveur. La bibliothèque publiée a été rechargée.')}
const hostedProduction=()=>/^https?:$/.test(location.protocol);
async function maybeAutoClientRefresh(){if(hostedProduction()||CONFIG.refreshEndpoint||!navigator.onLine)return;const last=Number(await liveGet(LIVE_REFRESH_KEY)||0);if(Date.now()-last<20*3600*1000)return;clientLiveRefresh({full:true,silent:true}).catch(()=>{})}
function scheduleClientDailyRefresh(){if(hostedProduction()||CONFIG.refreshEndpoint)return;setInterval(async()=>{if(!navigator.onLine)return;const parts=Object.fromEntries(new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date()).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));if(parts.hour!=='02'||Number(parts.minute)>4)return;const last=Number(await liveGet(LIVE_REFRESH_KEY)||0);if(Date.now()-last<6*3600*1000)return;clientLiveRefresh({full:true,silent:true}).catch(()=>{})},60000)}

function toast(msg){const t=$('#toast');t.innerHTML=msg;t.classList.remove('hidden');clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>t.classList.add('hidden'),4200)}
function permanentVerified(a){return Boolean(a.permanent&&arr(a.verification?.fieldEvidence).some(e=>e.field==='calendar'&&['A','B'].includes(e.sourceTier)))}
function nextDeadline(a){if(a.permanent)return permanentVerified(a)?{ok:true,date:null,reason:'PERMANENT'}:{ok:false,date:null,reason:'PERMANENT_UNVERIFIED'};const ds=uniq([...arr(a.deadlines).map(x=>typeof x==='string'?x:x?.date),a.finalClosingDate,a.closingDate].filter(Boolean)).sort();for(const d of ds)if(daysUntil(d)>=1)return{ok:true,date:d,reason:'DEADLINE'};return{ok:false,date:ds.find(d=>daysUntil(d)>=0)||ds.at(-1)||null,reason:ds.length?'J1':'DATE_MISSING'}}
function isGenericAidTitle(v=''){
  const t=norm(v);
  return !t||t.length<4||/^(document officiel|reglement|cahier des charges|annexe|formulaire|dossier de candidature)$/.test(t)||/desole.*offre.*plus disponible|offre.*plus disponible|page introuvable|page non trouvee|erreur 404|404 not found|access denied|forbidden|service indisponible|site en maintenance/.test(t);
}
function repairDisplayText(v=''){
  let s=String(v||'').replace(/\s+/g,' ').trim();
  for(let i=0;i<3;i++)s=s.replace(/\b([A-ZÀ-ÖØ-Ý]{2,})\s+([ÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ])\s+([A-ZÀ-ÖØ-Ý]{2,})\b/g,'$1$2$3');
  const markers=['Cette page vise à vous guider dans l’utilisation du site',"Cette page vise à vous guider dans l'utilisation du site",'Pour connaître le niveau d’accessibilité de ce site',"Pour connaître le niveau d'accessibilité de ce site",'L’initiative internationale pour l’accessibilité du Web',"L'initiative internationale pour l'accessibilité du Web"];
  let cut=s.length;for(const m of markers){const i=s.toLowerCase().indexOf(m.toLowerCase());if(i>=0)cut=Math.min(cut,i)}
  return s.slice(0,cut).trim();
}
function derivedAidTitle(a){
  const current=repairDisplayText(a?.title||'');
  if(!isGenericAidTitle(current))return current;
  const candidates=[
    ...arr(a?.sourceAliases).map(x=>typeof x==='string'?x:x?.label),
    ...arr(a?.cdcLinks).map(x=>typeof x==='string'?null:x?.label),
    ...arr(a?.regulationLinks).map(x=>typeof x==='string'?null:x?.label),
    ...arr(a?.sourceLinks).map(x=>typeof x==='string'?null:x?.label)
  ].filter(Boolean).map(repairDisplayText).map(x=>x.replace(/^(?:r[eè]glement|cahier des charges|cdc|dossier de candidature|annexe)\s*[-–—:]\s*/i,'').trim()).filter(x=>x.length>=12&&!isGenericAidTitle(x));
  if(candidates.length)return candidates[0];
  const src=repairDisplayText(a?.objective||'').replace(/^\d+\s+(?=[A-ZÀ-ÖØ-Ý])/,'');
  const cut=src.split(/\b(?:Délibération|Direction de|Règlement|REGLEMENT|ARTICLE\s+\d+|Art\.\s*\d+)/)[0].trim();
  const upper=(cut.match(/[A-ZÀ-ÖØ-Ý]/g)||[]).length,letters=(cut.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g)||[]).length;
  if(cut.length>=15&&cut.length<=190&&letters>=12&&upper/letters>.55)return cut;
  return current||'Intitulé à rattacher à la source officielle';
}
function usableAid(a){
  if(!a||['ARCHIVE','STALE','CLOSED','CLOS','EXPIRED'].includes(a.lifecycleStatus))return false;
  const t=norm(derivedAidTitle(a));
  if(!t||t.length<4)return false;
  if(/^(appels a projets et concours(?: bpifrance)?|contact et aide|accueil|nos aides|toutes nos aides)$/.test(t))return false;
  const nd=nextDeadline(a);
  if(nd.reason==='J1'&&nd.date&&daysUntil(nd.date)<1)return false;
  return true;
}
function libraryAid(a){
  if(!a||['STALE','CLOSED','CLOS','EXPIRED'].includes(a.lifecycleStatus))return false;
  if(isGenericAidTitle(derivedAidTitle(a))||/^(appels a projets et concours(?: bpifrance)?|contact et aide|accueil|nos aides|toutes nos aides)$/.test(norm(derivedAidTitle(a))))return false;
  if(a.lifecycleStatus==='ARCHIVE'){
    const d=a.finalClosingDate||a.closingDate||arr(a.deadlines).map(x=>typeof x==='string'?x:x?.date).filter(Boolean).sort().at(-1);
    return Boolean(d&&daysUntil(d)>=-60);
  }
  return true;
}
function guichetLabels(a){
  const provenance=norm([a?.sourceId,...arr(a?.sourceAliases)].filter(Boolean).join(' '));
  const t=norm([...arr(a?.funder),a?.operator,a?.programme,a?.sourceId].filter(Boolean).join(' ')),out=[];
  const add=x=>{if(x&&!out.includes(x))out.push(x)};
  let bpiHost=false;try{bpiHost=/bpifrance\.fr$/i.test(new URL(a?.officialPage||'').hostname)}catch{}
  if(/\bbpifrance(?:_|\b)/.test(provenance)||norm(a?.operator)==='bpifrance'||(bpiHost&&/bpifrance|bpi france/.test(t)))add('Bpifrance');
  if(/ademe|transition ecologique/.test(t))add('ADEME');
  if(/agence nationale de la recherche|\banr\b/.test(t))add('ANR');
  if(/feder|fonds europeen de developpement regional|europe en france/.test(t))add('FEDER');
  if(/feader|fonds europeen agricole/.test(t))add('FEADER');
  if(/franceagrimer/.test(t))add('FranceAgriMer');
  if(/banque des territoires|caisse des depots/.test(t))add('Banque des Territoires');
  if(/office francais de la biodiversite|\bofb\b/.test(t))add('OFB');
  if(/region|conseil regional|collectivite territoriale/.test(t))add('Régions');
  if(/ministere|etat /.test(t))add('État / Ministères');
  if(!out.length&&arr(a?.funder).length)add(arr(a.funder)[0]);
  return out;
}
function officialUrl(a){
  const candidates=[a?.officialPage,...arr(a?.sourceLinks).map(x=>typeof x==='string'?x:x?.url),...arr(a?.formLinks).map(x=>typeof x==='string'?x:x?.url)];
  return candidates.map(clientDirectUrl).find(Boolean)||null;
}
function displayAidTitle(a){
  const title=derivedAidTitle(a),funders=arr(a?.funder).filter(Boolean);
  const ambiguous=/^aide (?:aux|pour les?) projets? d['’]?innovation$/i.test(title);
  return ambiguous&&funders.length?title+' — '+funders[0]:title;
}

async function loadAll(){const j=await api('./data/library.json');state.lib=(j.meta?.sourcePolicy==='DIRECT_OFFICIAL_ONLY'?j.aaps||[]:[]).filter(a=>!/(?:aides[-_]entreprises|aides[-_]territoires)/i.test(JSON.stringify(a))).map(a=>{const b={...a};for(const k of ['title','objective','beneficiaries','eligibleExpenses','excludedExpenses','prerequisites','selectionCriteria','programme','operator'])if(typeof b[k]==='string')b[k]=decodeEntities(b[k]);return b});state.meta=j.meta||{};for(const[k,p]of[['coverage','./data/coverage.json'],['changes','./data/changes.json']])try{state[k]=await api(p)}catch{};try{state.sources=(await api('./data/sources.json')).sources||[]}catch{};try{state.readiness=await api('./data/production-readiness.json')}catch{};await loadClientLibrary();render();const deep=new URLSearchParams(location.search).get('aid');if(deep&&state.lib.some(a=>a.id===deep))openAid(deep)}
function route(r){clearTimeout(window.__libSearchTimer);state.route=r;$$('.nav[data-route]').forEach(x=>x.classList.toggle('active',x.dataset.route===r));$('#sidebar')?.classList.remove('open');render()}
$$('.nav[data-route]').forEach(b=>b.onclick=()=>route(b.dataset.route));
$('#today').textContent=new Date().toLocaleDateString('fr-FR');
$('#modalClose').onclick=()=>$('#modal').classList.add('hidden');
$('#modal').onclick=e=>{if(e.target.id==='modal')$('#modal').classList.add('hidden')};
$('#mobileNav').onclick=()=>$('#sidebar').classList.toggle('open');
const SIDEBAR_PREF='leyton-as-sidebar-collapsed';
function setSidebarCollapsed(collapsed){const layout=document.querySelector('.layout'),btn=$('#sidebarToggle');layout?.classList.toggle('sidebar-collapsed',collapsed);if(btn){btn.textContent=collapsed?'Afficher la colonne gauche':'Masquer la colonne gauche';btn.setAttribute('aria-pressed',String(collapsed))}try{localStorage.setItem(SIDEBAR_PREF,collapsed?'1':'0')}catch{}}
if($('#sidebarToggle')){$('#sidebarToggle').onclick=()=>setSidebarCollapsed(!document.querySelector('.layout')?.classList.contains('sidebar-collapsed'));try{setSidebarCollapsed(localStorage.getItem(SIDEBAR_PREF)==='1')}catch{setSidebarCollapsed(false)}}
$('#refreshBtn').onclick=async()=>{await loadAll();toast('Dernière bibliothèque publiée rechargée.')};
$('#collectBtn').onclick=requestCollection;
function counts(){const active=state.lib.filter(a=>!['ARCHIVE','STALE'].includes(a.lifecycleStatus)),verified=active.filter(x=>x.verification?.status==='VERIFIE').length;return{all:active.length,aap:active.filter(x=>String(x.kind).includes('AAP')).length,verified,j1:active.filter(x=>nextDeadline(x).ok).length,docs:active.filter(x=>arr(x.cdcLinks).length).length,complete:active.filter(x=>(x.verification?.completeness||0)>=80).length}}
function render(){({home,study,library,watch,sources,production}[state.route]||home)()}
function home(){
  const corpus=state.lib.filter(usableAid),aap=corpus.filter(x=>String(x.kind).includes('AAP')).length;
  const regions=uniq(corpus.flatMap(x=>arr(x.regions)).filter(x=>REGIONS.includes(x))).length;
  $('#app').innerHTML=`<section class="hero executive-hero"><div class="eyebrow">Financements publics · France</div><h1>Les financements publics au service de vos projets</h1><p>Un référentiel national et régional pour identifier les financements mobilisables, vérifier les conditions d’accès et prioriser les dispositifs au regard du projet, des dépenses, du calendrier et des critères de sélection.</p><div class="hero-actions"><button class="btn primary" id="newStudy">Analyser un projet</button><button class="btn" id="goLibrary">Explorer la bibliothèque</button></div></section>
  <div class="grid g4 executive-metrics" style="margin-top:18px"><div class="metric"><b>${corpus.length}</b><span>dispositifs référencés</span></div><div class="metric"><b>${aap}</b><span>AAP / AMI</span></div><div class="metric"><b>${state.sources.length||state.meta.sourceCount||'—'}</b><span>sources officielles référencées</span></div><div class="metric"><b>${regions}</b><span>régions couvertes</span></div></div>
  <div class="grid g2" style="margin-top:16px"><div class="card"><h3>Dernière actualisation</h3><p><b>${state.meta.generatedAt?new Date(state.meta.generatedAt).toLocaleString('fr-FR'):'Bibliothèque publiée'}</b></p><p class="mini">Les données sont consolidées depuis les sources officielles nationales et régionales.</p><button class="btn small" id="goWatch">Voir les nouveaux dispositifs</button></div><div class="card"><h3>Lecture consultant</h3><div class="criteria"><div class="criterion"><span>1. Éligibilité</span><strong>Bénéficiaire, territoire, calendrier, budget, exclusions</strong></div><div class="criterion"><span>2. Adéquation projet</span><strong>Objectifs, dépenses, maturité, impacts, critères de sélection</strong></div><div class="criterion"><span>3. Décision</span><strong>Dispositifs prioritaires, points à sécuriser, source officielle</strong></div></div></div></div>`;
  $('#newStudy').onclick=()=>{state.studyStep=1;route('study')};$('#goLibrary').onclick=()=>route('library');$('#goWatch').onclick=()=>route('watch');
}
function field(id,label,value,type='text',hint=''){return`<div class="field-wrap"><label class="field" for="${id}">${esc(label)}</label><input id="${id}" class="input" type="${type}" value="${esc(value||'')}">${hint?`<div class="mini">${esc(hint)}</div>`:''}</div>`}
function area(id,label,value,hint=''){return`<div class="field-wrap"><label class="field" for="${id}">${esc(label)}</label><textarea id="${id}" class="input">${esc(value||'')}</textarea>${hint?`<div class="mini">${esc(hint)}</div>`:''}</div>`}
function select(id,label,opts,val){return`<div class="field-wrap"><label class="field" for="${id}">${esc(label)}</label><select id="${id}" class="input">${opts.map(x=>`<option ${x===val?'selected':''}>${esc(x)}</option>`).join('')}</select></div>`}
function stepper(){return`<div class="wizard">${['Entreprise','Projet','Budget & calendrier','Cartographie'].map((x,i)=>`<span class="step ${state.studyStep===i+1?'active':state.studyStep>i+1?'done':''}">${i+1}. ${x}</span>`).join('')}</div>`}
function study(){const p=state.project;let body='';if(state.studyStep===1)body=`<div class="grid g2"><div class="card"><h3>Identité entreprise</h3><div class="grid g2"><div>${field('qSiren','SIREN / SIRET',p.siren,'text','Recherche dans l’API publique Annuaire des Entreprises.')}</div><div style="align-self:end"><button class="btn dark" id="lookupSiren">Rechercher le SIREN</button></div></div>${field('qCompany','Raison sociale',p.company)}<div class="grid g2"><div>${select('qCategory','Catégorie',['À préciser','PME','ETI','GE'],p.category)}</div><div>${select('qStartup','Start-up',['Non','Oui'],p.startup?'Oui':'Non')}</div></div>${field('qLegalForm','Forme juridique',p.legalForm)}${field('qCreationDate','Date de création',p.creationDate,'date')}</div><div class="card"><h3>Profil économique</h3>${select('qRegion','Région du projet',['À préciser',...REGIONS],p.region)}${field('qProjectSite','Site / implantation du projet',p.projectSite)}${field('qSector','Secteur / activité réelle',p.sector)}${field('qNaf','Code NAF / APE',p.naf)}<div class="grid g2"><div>${field('qEmployees','Effectif',p.employees,'number')}</div><div>${field('qTurnover','CA annuel (€)',p.turnover,'number')}</div></div>${field('qBalance','Total bilan (€)',p.balanceSheet,'number')}${select('qGroup','Situation groupe',['Autonome','Filiale / groupe','À vérifier'],p.group)}</div></div>`;if(state.studyStep===2)body=`<div class="grid g2"><div class="card"><h3>Projet</h3>${field('qName','Nom du projet',p.name)}<label class="field">Typologies</label><div class="tagset">${TYPES.map(t=>`<label class="pill"><input class="qType" type="checkbox" value="${esc(t)}" ${arr(p.types).includes(t)?'checked':''}> ${esc(t)}</label>`).join('')}</div>${area('qSummary','Description du projet — facultative',p.summary,'Si le projet est défini, précisez objectifs, travaux, livrables et résultats attendus. Sinon, la recherche utilise votre activité, votre code NAF et vos thématiques.')}${select('qMaturity','Maturité',MATURITY,p.maturity)}</div><div class="card"><h3>Travaux & impacts</h3>${area('qPartners','Partenaires / consortium',p.partners)}${area('qImpacts','Impacts attendus',p.impacts)}${field('qJobs','Emplois créés / maintenus',p.jobs)}${area('qEnvironment','Impacts environnementaux / énergie / carbone',p.environment)}${area('qDigital','Volet numérique / IA / cyber / robotisation',p.digital)}</div></div>`;if(state.studyStep===3)body=`<div class="grid g2"><div class="card"><h3>Budget & dépenses</h3>${field('qBudget','Budget total du projet (€)',p.budget,'number')}${area('qExpenses','Dépenses / lots de coûts',p.expenses,'Préciser personnel, équipements, sous-traitance, études, bâtiment, logiciels, etc.')}${area('qFinancing','Plan de financement',p.financing,'Fonds propres, dette, autres financements, reste à financer.')}${area('qOtherAids','Autres aides publiques demandées / obtenues',p.otherAids)}</div><div class="card"><h3>Calendrier</h3><div class="grid g2"><div>${field('qStart','Démarrage prévu',p.startDate,'date')}</div><div>${field('qEnd','Fin prévue',p.endDate,'date')}</div></div><div class="callout warn"><b>Effet incitatif :</b> le moteur signale les dispositifs exigeant un dépôt avant démarrage, mais la preuve réglementaire reste prioritaire.</div><div class="study-summary"><b>Lecture de la cartographie :</b><p>Les incompatibilités certaines sont écartées. Les autres dispositifs sont classés selon l’adéquation au projet et les critères publiés, avec les points à confirmer clairement signalés.</p></div></div></div>`;if(state.studyStep===4)body=`<div class="card"><h3>Analyse du projet</h3><p>L’analyse distingue les conditions documentées, les incompatibilités identifiées et les informations à compléter. Les correspondances servent à orienter l’instruction, sans conclure à l’attribution d’un financement.</p><div class="grid g3"><div class="metric"><b>1</b><span>Éligibilité</span><small>bénéficiaire, territoire, calendrier, budget, exclusions, effet incitatif</small></div><div class="metric"><b>2</b><span>Adéquation</span><small>objectifs, projets attendus, dépenses, maturité, impacts, critères de sélection</small></div><div class="metric"><b>3</b><span>Décision</span><small>classement, points à confirmer, modalités financières et source officielle</small></div></div><div class="callout"><b>Principe :</b> une information manquante n’est pas assimilée à une non-éligibilité. En l’absence de description détaillée, l’analyse s’appuie sur l’activité, le code NAF et les thématiques renseignées.</div><details class="method-card"><summary>Voir la méthode d’analyse</summary><div class="method-grid"><div><b>Contrôles bloquants</b><p>Taille, territoire, échéance, assiette budgétaire lorsqu’elle est publiée, exclusions explicites, consortium ou conditions obligatoires lorsqu’elles sont structurées.</p></div><div><b>Points d’instruction par financeur</b><p>Bpifrance / France 2030 : innovation, maturité, retombées, marché et capacité d’exécution. ADEME : performance environnementale, opérations et dépenses éligibles, maturité et incitativité. FEDER : priorité du programme, territoire, actions et dépenses, indicateurs et capacité de portage.</p></div><div><b>Données projet utilisées</b><p>Description, activité, NAF, typologie, maturité, dépenses, impacts, partenaires, emploi, environnement, numérique et financement. Les éléments indisponibles sont neutralisés.</p></div><div><b>Traçabilité</b><p>Chaque résultat explique les critères concordants et les points restant à vérifier. La source officielle reste accessible directement depuis la fiche.</p></div></div></details><button class="btn primary" id="runStudy">Lancer la cartographie & faisabilité</button></div><div id="studyResults"></div>`;$('#app').innerHTML=`<div class="page-head"><div><div class="eyebrow">Cartographie & faisabilité</div><h1>Identifiez les financements à instruire</h1><p class="sub">Commencez par l’activité, le code NAF ou une thématique. Les informations sur le projet permettent ensuite de préciser les conditions d’accès et les points à instruire.</p></div></div>${stepper()}${body}<div class="form-actions"><button class="btn" id="prevStep" ${state.studyStep===1?'disabled':''}>← Précédent</button><button class="btn primary" id="nextStep" ${state.studyStep===4?'disabled':''}>Suivant →</button></div>`;bindStudy()}
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
    const provenHard=Boolean(hard&&(!field||['A','B'].includes(ev?.sourceTier)));
    if(status==='NON CONFORME'&&!provenHard)status='À VÉRIFIER';
    criteria.push({label,status,detail,sourceUrl:ev?.sourceUrl||null,sourceTier:ev?.sourceTier||null,hard:provenHard});
    if(provenHard&&status==='NON CONFORME')block.push(detail||label);
  };
  const types=arr(a.aidTypes),cats=arr(a.companyCategories),regions=arr(a.regions);
  const targetInstruments=['SUBVENTION','AVANCE_REMBOURSABLE','PRET_TAUX_ZERO'];
  const hasTargetInstrument=types.some(x=>targetInstruments.includes(x));
  add('Instrument',!types.length?'À VÉRIFIER':hasTargetInstrument?'CONFORME':'NON CONFORME',types.length?types.map(aidTypeLabel).join(', '):'Instrument non documenté',null,types.length>0);

  add('Statut','À VÉRIFIER','Le référencement dans la base ne confirme pas à lui seul l’ouverture du dispositif.','calendar');

  const projectCat=p.startup?`STARTUP / ${p.category}`:p.category;
  if(cats.length&&p.category&&p.category!=='À préciser'){
    const match=cats.includes(p.category)||(p.startup&&cats.includes('STARTUP'));
    add('Taille entreprise',match?'CONFORME':'NON CONFORME',`Catégories référencées : ${cats.join(', ')} · profil projet : ${projectCat}`,'beneficiaries',!match);
  }else add('Taille entreprise','À VÉRIFIER',cats.length?`Catégories référencées : ${cats.join(', ')}`:'Taille d’entreprise non documentée','beneficiaries');

  if(a.scope==='NATIONAL')add('Territoire','CONFORME','Portée nationale','beneficiaries',true);
  else if(a.scope==='REGIONAL'&&regions.length&&p.region&&p.region!=='À préciser'){
    const match=regions.includes(p.region)||regions.includes('Toutes les Régions');
    add('Territoire',match?'CONFORME':'NON CONFORME',`Territoires du dispositif : ${regions.join(', ')||'non documentés'} · région du projet : ${p.region}`,'beneficiaries',true);
  }else add('Territoire','À VÉRIFIER',`Territoires du dispositif : ${regions.join(', ')||'non documentés'}`,'beneficiaries');

  const nd=nextDeadline(a);
  if(nd.reason==='J1'&&nd.date&&daysUntil(nd.date)<1)add('Calendrier','NON CONFORME',`Échéance dépassée ou non exploitable : ${fmtDate(nd.date)}`,'calendar',true);
  else if(nd.ok)add('Calendrier','CONFORME',a.permanent?'Dispositif permanent':'Prochaine échéance exploitable : '+fmtDate(nd.date),'calendar',true);
  else add('Calendrier','À VÉRIFIER',a.permanent?'Permanence à confirmer':'Date de clôture non documentée','calendar');

  const budget=Number(p.budget||0),min=(a.minimumProjectCost!=null&&a.minimumProjectCost!==''&&Number.isFinite(Number(a.minimumProjectCost)))?Number(a.minimumProjectCost):null,max=(a.maximumProjectCost!=null&&a.maximumProjectCost!==''&&Number.isFinite(Number(a.maximumProjectCost)))?Number(a.maximumProjectCost):null;
  if(budget>0&&(min!=null||max!=null)){
    const mismatch=(min!=null&&budget<min)||(max!=null&&budget>max);
    add('Budget',mismatch?'NON CONFORME':'CONFORME',`Budget projet : ${money(budget)} · assiette connue : ${min!=null?'min '+money(min):'min non documenté'} / ${max!=null?'max '+money(max):'max non documenté'}`,'financialTerms',mismatch);
  }else add('Budget','À VÉRIFIER',`Budget projet : ${budget>0?money(budget):'non renseigné'} · assiette : ${min!=null?'min '+money(min):'min non documenté'} / ${max!=null?'max '+money(max):'max non documenté'}`,'financialTerms');

  const explicit=explicitExclusion(a,p);
  if(explicit)add('Secteur','À VÉRIFIER',explicit,'beneficiaries');
  else {
    const specialized=specializedMismatch(a,p);
    add('Secteur','À VÉRIFIER',specialized||'Aucune exclusion sectorielle explicite détectée dans les données structurées','beneficiaries');
  }

  add('Dépenses éligibles','À VÉRIFIER',a.eligibleExpenses?'Les postes seront rapprochés des dépenses publiées':'Dépenses éligibles non documentées','eligibleExpenses');

  const ruleText=norm([a.prerequisites,a.selectionCriteria,a.objective,a.eligibleExpenses].filter(Boolean).join(' '));
  const incentiveRequired=/(avant demarrage|avant le demarrage|prealablement au demarrage|effet incitatif|aucune depense.*avant|depot.*avant.*demarrage|demande.*avant.*demarrage)/.test(ruleText);
  if(incentiveRequired){
    if(p.startDate){
      const started=String(p.startDate)<=today();
      add('Effet incitatif',started?'À VÉRIFIER':'CONFORME',started?'Le dispositif exige un dépôt avant démarrage et la date de début renseignée est atteinte : vérifier la date réelle de dépôt avant toute conclusion.':'Le démarrage renseigné est postérieur à aujourd’hui ; conserver un dépôt préalable au démarrage.','prerequisites');
    }else add('Effet incitatif','À VÉRIFIER','Le texte du dispositif impose un dépôt avant démarrage ; renseigner ou vérifier la date de début du projet.','prerequisites');
  }

  const consortiumRequired=/(partenariat obligatoire|consortium obligatoire|doit etre porte.{0,40}consortium|au moins deux partenaires|minimum de deux partenaires)/.test(ruleText);
  if(consortiumRequired){
    const partnerText=norm(p.partners||'');
    const explicitSolo=/(aucun partenaire|sans partenaire|projet seul|porte seul|entreprise seule)/.test(partnerText);
    add('Consortium / partenaires',explicitSolo?'NON CONFORME':'À VÉRIFIER',explicitSolo?'Le dispositif exige un montage partenarial alors que le projet est déclaré sans partenaire.':p.partners?'Exigence partenariale détectée : vérifier la composition, l’indépendance et le rôle des partenaires.':'Exigence partenariale détectée : composition du consortium à renseigner.','prerequisites',explicitSolo);
  }

  add('Pré-requis','À VÉRIFIER',a.prerequisites?'Les pré-requis seront rapprochés du profil, de la maturité et du montage du projet':'Pré-requis non documentés','prerequisites');
  add('Critères de sélection','À VÉRIFIER',a.selectionCriteria?'Les critères seront rapprochés des impacts, travaux, partenaires et maturité':'Critères de sélection non documentés','selectionCriteria');

  const confirmed=criteria.length>0&&criteria.every(x=>x.status==='CONFORME');
  return{eligible:block.length===0,status:block.length?'NON CONFORME':confirmed?'CONFORME':'À VÉRIFIER',criteria,next:nd,blocking:block};
}
function relevance(a,p){if(window.LEYTON_SCORING?.relevance)return window.LEYTON_SCORING.relevance(a,p);throw new Error('Moteur de pertinence partagé indisponible.')}
function validateProjectForStudy(p){
  const anchors=[
    String(p.summary||'').trim(),
    String(p.sector||'').trim(),
    String(p.naf||'').trim(),
    ...arr(p.types),
    String(p.digital||'').trim(),
    String(p.environment||'').trim()
  ].filter(Boolean);
  return anchors.length?[]:['activité, code NAF, thématique ou description du projet'];
}
async function runFeasibility(){
  const p=state.project,root=$('#studyResults');
  if(!root)return;
  const missingFields=validateProjectForStudy(p);
  if(missingFields.length){
    root.innerHTML=`<div class="callout warn"><b>Analyse non lancée : base de recherche insuffisante.</b><br>Renseignez au moins ${esc(missingFields.join(' · '))}.</div>`;
    root.scrollIntoView({behavior:'smooth',block:'start'});
    return;
  }

  const started=performance.now(),corpus=state.lib.filter(usableAid),scored=[],rejected=[];
  root.innerHTML=`<div class="analysis-progress"><div class="row between"><b>Cartographie en cours</b><span id="analysisProgressLabel">0 / ${corpus.length}</span></div><div class="progress"><i id="analysisProgressBar" style="width:0%"></i></div><p class="mini">Étape 1 : incompatibilités réglementaires explicites. Étape 2 : analyse structurée des critères. Étape 3 : classement documentaire BM25F et fusion des rangs.</p></div>`;

  const bm25=window.LEYTON_SCORING?.bm25fRank?window.LEYTON_SCORING.bm25fRank(corpus,p):new Map();
  for(let i=0;i<corpus.length;i++){
    const a=corpus[i],e=eligibility(a,p);
    if(e.eligible){
      const rel=relevance(a,p);
      scored.push({a,elig:e,relevance:rel,bm25:Number(bm25.get(a.id)||0)});
    }else rejected.push({a,elig:e});
    if(i%120===0||i===corpus.length-1){
      const pct=Math.round(((i+1)/Math.max(1,corpus.length))*100);
      const bar=$('#analysisProgressBar'),label=$('#analysisProgressLabel');
      if(bar)bar.style.width=pct+'%';
      if(label)label.textContent=`${i+1} / ${corpus.length}`;
      await new Promise(requestAnimationFrame);
    }
  }

  // Deux classements indépendants sont fusionnés par Reciprocal Rank Fusion (RRF).
  // Cela évite qu'un unique score arbitraire décide seul du classement.
  const structured=[...scored].sort((x,y)=>y.relevance.score-x.relevance.score||y.relevance.documentedWeight-x.relevance.documentedWeight);
  const lexical=[...scored].sort((x,y)=>y.bm25-x.bm25||y.relevance.score-x.relevance.score);
  const rankStructured=new Map(structured.map((x,i)=>[x.a.id,i+1]));
  const rankLexical=new Map(lexical.map((x,i)=>[x.a.id,i+1]));
  for(const x of scored){
    const rs=rankStructured.get(x.a.id)||scored.length,rl=rankLexical.get(x.a.id)||scored.length;
    x.rrf=1/(60+rs)+1/(60+rl);
    const dims=arr(x.relevance.dims).filter(d=>d.documented!==false);
    x.expertSignals={
      documented:dims.length,
      strong:dims.filter(d=>(d.ratio??0)>=65).length,
      medium:dims.filter(d=>(d.ratio??0)>=40).length,
      core:dims.some(d=>['strategic','expected','beneficiary'].includes(d.key)&&(d.ratio??0)>=55),
      direct:Boolean(officialUrl(x.a))
    };
  }
  scored.sort((x,y)=>y.rrf-x.rrf||y.relevance.score-x.relevance.score);

  const isProject=String(p.summary||'').trim().length>0;
  const priorities=scored.filter(x=>isProject&&x.expertSignals.direct&&x.expertSignals.documented>=5&&x.expertSignals.strong>=3&&x.expertSignals.core).slice(0,10);
  const priorityIds=new Set(priorities.map(x=>x.a.id));
  const leads=scored.filter(x=>!priorityIds.has(x.a.id)&&x.expertSignals.documented>=3&&(x.expertSignals.strong>=2||x.expertSignals.strong+x.expertSignals.medium>=4)&&x.expertSignals.core).slice(0,12);
  const leadIds=new Set(leads.map(x=>x.a.id));
  const potentials=scored.filter(x=>!priorityIds.has(x.a.id)&&!leadIds.has(x.a.id)&&x.expertSignals.core).slice(0,10);
  const shownIds=new Set([...priorities,...leads,...potentials].map(x=>x.a.id));
  const bestBelow=scored.filter(x=>!shownIds.has(x.a.id)).slice(0,5);
  const duration=Math.round(performance.now()-started);
  const checks=[...scored,...rejected].reduce((n,x)=>n+x.elig.criteria.length,0);
  state.lastResults=[...priorities,...leads,...potentials,...(!priorities.length&&!leads.length&&!potentials.length?bestBelow:[])];

  const mode=isProject?'Projet renseigné':'Prospection activité / NAF / thématiques';
  root.innerHTML=`<div class="section-title"><h2>Cartographie des financements</h2></div>
  <div class="card study-kpi"><div class="grid g4">
    <div class="metric"><b>${corpus.length}</b><span>dispositifs analysés</span></div>
    <div class="metric"><b>${priorities.length}</b><span>prioritaires à instruire</span><small>projet suffisamment renseigné</small></div>
    <div class="metric"><b>${leads.length}</b><span>à approfondir</span><small>plusieurs signaux convergents</small></div>
    <div class="metric"><b>${potentials.length}</b><span>pistes complémentaires</span><small>correspondance à qualifier</small></div>
  </div>
  <div class="analysis-audit"><b>${mode}</b> · ${scored.length.toLocaleString('fr-FR')} dispositifs sans incompatibilité explicite · ${rejected.length.toLocaleString('fr-FR')} écartés sur règle bloquante · ${checks.toLocaleString('fr-FR')} contrôles structurés. Classement obtenu par double analyse déterministe : critères structurés + BM25F documentaire, fusionnés par RRF. Aucun barème officiel Bpifrance, ADEME ou FEDER n'est simulé.</div></div>

  ${priorities.length?`<div class="section-title"><h3>Prioritaires à instruire</h3></div>${priorities.map((x,i)=>resultCard(x,i+1,'PRIORITAIRE À INSTRUIRE')).join('')}`:''}
  <div class="section-title"><h3>À approfondir</h3></div>
  ${leads.length?leads.map((x,i)=>resultCard(x,i+1,'À APPROFONDIR')).join(''):'<div class="callout">Aucune correspondance intermédiaire suffisamment étayée.</div>'}
  ${potentials.length?`<div class="section-title"><h3>Pistes complémentaires</h3></div>${potentials.map((x,i)=>resultCard(x,i+1,'À QUALIFIER')).join('')}`:''}
  ${!priorities.length&&!leads.length&&!potentials.length&&bestBelow.length?`<div class="section-title"><h3>Meilleures correspondances disponibles</h3></div><div class="callout warn">Aucune fiche ne présente assez de signaux convergents pour être recommandée. Les cinq meilleures correspondances sont affichées uniquement pour diagnostic.</div>${bestBelow.map((x,i)=>resultCard(x,i+1,'DIAGNOSTIC')).join('')}`:''}`;
  root.scrollIntoView({behavior:'smooth',block:'start'});
}
function securityPoints(r){const a=r.a,pts=[];for(const c of r.elig.criteria)if(c.status==='À VÉRIFIER')pts.push(`${c.label} : ${c.detail||'à confirmer'}`);if(a.verification?.status!=='VERIFIE')pts.push('Certaines informations de la fiche restent à confirmer sur la source officielle.');for(const x of arr(a.attentionPoints))if(x&&!pts.includes(x))pts.push(x);return uniq(pts).sort((x,y)=>Number(/^(Critères de sélection|Pré-requis|Dépenses éligibles)/.test(y))-Number(/^(Critères de sélection|Pré-requis|Dépenses éligibles)/.test(x))).slice(0,10)}
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
function criterionBadge(status){return `<span class="pill ${status==='CONFORME'?'ok':status==='NON CONFORME'?'block':'warn'}">${esc(status==='À VÉRIFIER'?'Conditions à confirmer':status)}</span>`}
function listText(value){const values=arr(value).filter(v=>v!=null&&String(v).trim());return values.length?values.map(v=>`<p>${esc(typeof v==='object'?(v.label||v.text||JSON.stringify(v)):v)}</p>`).join(''):missing()}
function resultCard(r,rank,kind='À APPROFONDIR'){
  const a=r.a,url=officialUrl(a),deadlines=uniq(arr(a.deadlines).map(x=>typeof x==='string'?x:x?.date).filter(Boolean));
  const close=a.finalClosingDate||a.closingDate||null;
  const deepHref=`?aid=${encodeURIComponent(a.id)}`;
  const scoreAudit=arr(r.relevance?.dims).map(d=>`<div class="score-line"><span><b>${esc(d.label)}</b><small>${esc(d.detail||'')}</small>${arr(d.matched).length?`<small>Correspondances : ${esc(arr(d.matched).join(', '))}</small>`:''}</span><strong>${d.documented===false?'À renseigner':d.ratio>=65?'Correspondance':d.ratio>0?'Partielle':'Non établie'}</strong></div>`).join('');
  return `<article class="result-card aid-result-block">
    <div class="row between aid-result-head">
      <div><span class="rank">#${rank}</span>
        ${url?`<a class="aid-title-link" href="${esc(url)}" target="_blank" rel="noopener">${esc(displayAidTitle(a))} ↗</a>`:`<span class="aid-title-link no-link">${esc(displayAidTitle(a))}</span>`}
        <div class="mini">${esc(arr(a.funder).join(', ')||'Financeur à documenter')}</div>
      </div>
      <div class="assessment-label">${r.relevance.basis==='description projet'?'Analyse du projet':'Prospection par activité'}</div>
    </div>
    <div class="row aid-result-badges">
      <span class="pill info">${esc(kind)}</span><span class="pill">${esc(r.relevance.profileLabel||'Grille générale')}</span>
      ${criterionBadge(r.elig.status)}

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
    <details class="score-audit"><summary>Lire l’analyse détaillée</summary><div class="mini" style="margin:8px 0">Base : ${esc(r.relevance.basis||'données disponibles')}. Rapprochement indicatif, sans barème officiel du financeur. Les données absentes ne constituent pas une incompatibilité.</div>${scoreAudit}</details>
    <div class="row end aid-result-actions">
      <a class="btn small open-result" data-id="${esc(a.id)}" href="${esc(deepHref)}">Voir la fiche complète</a>
      ${url?`<a class="btn primary small" href="${esc(url)}" target="_blank" rel="noopener">Ouvrir la source officielle ↗</a>`:''}
    </div>
  </article>`;
}
function evidenceLine(a,field){
  const ev=arr(a.verification?.fieldEvidence).filter(x=>x.field===field&&clientDirectUrl(x.sourceUrl||''))[0];
  if(!ev)return'';
  const txt=repairDisplayText(ev.evidenceText||'');
  return`<div class="proof">${ev.locator?esc(ev.locator)+' · ':''}<a class="link" target="_blank" rel="noopener" href="${esc(ev.sourceUrl)}">Preuve source ↗</a>${txt?`<br>${esc(txt)}`:''}</div>`;
}
function uniqueLinks(items=[]){
  const out=[],seen=new Set();
  for(const x of arr(items)){
    const url=typeof x==='string'?x:x?.url,label=typeof x==='string'?'':x?.label||'';
    if(!/^https?:/i.test(String(url||''))||seen.has(url))continue;
    seen.add(url);out.push({url,label});
  }
  return out;
}
function cdcLinksFor(a){
  return uniqueLinks([...arr(a.cdcLinks),...arr(a.regulationLinks)])
    .filter(x=>/cahier|cdc|r[eè]glement|modalit|annexe|faq|grille|notice|pdf/i.test(`${x.label} ${x.url}`)||/\.pdf(?:$|\?)/i.test(x.url));
}
function applicationLinksFor(a){
  return uniqueLinks([...arr(a.formLinks),...arr(a.sourceLinks)])
    .filter(x=>/candid|d[eé]p[oô]t|deposer|déposer|formulaire|demande en ligne|application|t[eé]l[eé]service/i.test(`${x.label} ${x.url}`));
}
function docButtons(a){
  const docs=cdcLinksFor(a),forms=applicationLinksFor(a);
  return`<div class="doc-actions">
    ${docs.length?docs.map((x,i)=>`<a class="doc-link" target="_blank" rel="noopener" href="${esc(x.url)}"><span>CdC${i?' / annexe':''}</span><b>${esc(x.label||'Ouvrir le document')} ↗</b></a>`).join(''):'<div class="doc-link disabled"><span>CdC</span><b>Non rattaché à la fiche</b></div>'}
    ${forms.length?forms.map((x,i)=>`<a class="doc-link" target="_blank" rel="noopener" href="${esc(x.url)}"><span>Dossier de candidature${i?' '+(i+1):''}</span><b>${esc(x.label||'Ouvrir le dossier')} ↗</b></a>`).join(''):'<div class="doc-link disabled"><span>Dossier de candidature</span><b>Lien non publié dans la fiche</b></div>'}
  </div>`;
}
function missingOrCdc(a,label='Information non publiée dans la fiche'){
  const d=cdcLinksFor(a)[0];
  return d?`<p class="field-missing">${esc(label)} · <a class="link" href="${esc(d.url)}" target="_blank" rel="noopener">Voir le CdC ↗</a></p>`:`<p class="field-missing">${esc(label)}</p>`;
}
function cleanFieldValue(value){
  if(Array.isArray(value))return value.map(repairDisplayText).filter(Boolean);
  if(value&&typeof value==='object')return value;
  return repairDisplayText(value||'');
}
function fieldHtml(a,value,field){
  const clean=cleanFieldValue(value);
  const empty=Array.isArray(clean)?!clean.length:!clean||(typeof clean==='object'&&!Object.keys(clean).length);
  if(empty)return missingOrCdc(a);
  return listText(clean)+evidenceLine(a,field);
}
function sizeFinance(a){
  const rows=arr(a.aidAmount?.byCompanySize).length?arr(a.aidAmount.byCompanySize):arr(a.aidRate?.byCompanySize);
  if(!rows.length)return missingOrCdc(a,'Taux par taille non publié dans la fiche');
  return`<table class="smalltable"><thead><tr><th>Taille</th><th>Taux</th><th>Montant</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.category)}</td><td>${x.rateMin!=null||x.rateMax!=null||x.min!=null||x.max!=null?`${x.rateMin??x.min??'—'}–${x.rateMax??x.max??'—'} %`:'—'}</td><td>${x.amountMin!=null||x.amountMax!=null?`${money(x.amountMin)} – ${money(x.amountMax)}`:'—'}</td></tr>`).join('')}</tbody></table>`;
}
function box(title,content,wide=false){return`<section class="sheet-box ${wide?'wide':''}"><h4>${esc(title)}</h4>${content}</section>`}
function openAid(id){
  const a=state.lib.find(x=>x.id===id);if(!a)return;
  const dm=libraryDateMeta(a),url=officialUrl(a),title=displayAidTitle(a);
  const sourceLinks=uniqueLinks([...(url?[{url,label:'Page officielle du dispositif'}]:[]),...arr(a.sourceLinks)]).filter(x=>clientDirectUrl(x.url));
  const amount=(a.aidAmount?.min!=null||a.aidAmount?.max!=null)?`<p>${money(a.aidAmount?.min)} à ${money(a.aidAmount?.max)}</p>${evidenceLine(a,'financialTerms')}`:missingOrCdc(a,'Montant d’aide non publié dans la fiche');
  const rate=(a.aidRate?.min!=null||a.aidRate?.max!=null)?`<p>${a.aidRate?.min??'—'} % à ${a.aidRate?.max??'—'} %</p>${evidenceLine(a,'financialTerms')}`:missingOrCdc(a,'Taux d’aide non publié dans la fiche');
  const assiette=(a.minimumProjectCost!=null||a.maximumProjectCost!=null)?`<p><b>Minimum :</b> ${a.minimumProjectCost!=null?money(a.minimumProjectCost):'non publié'}<br><b>Maximum :</b> ${a.maximumProjectCost!=null?money(a.maximumProjectCost):'non publié'}</p>${evidenceLine(a,'financialTerms')}`:missingOrCdc(a,'Assiette minimale / maximale non publiée dans la fiche');
  const calendar=`<p><b>Ouverture :</b> ${a.openingDate?fmtDate(a.openingDate):'non publiée'}<br><b>Relèves :</b> ${arr(a.deadlines).length?arr(a.deadlines).map(x=>fmtDate(typeof x==='string'?x:x?.date)).join(' · '):'non publiées'}<br><b>Clôture :</b> ${a.permanent?'Permanent':(a.finalClosingDate||a.closingDate)?fmtDate(a.finalClosingDate||a.closingDate):'non publiée'}${dm.state==='recent-closed'?' · clôturé depuis moins de 60 jours':''}</p>${evidenceLine(a,'calendar')}`;

  $('#modalContent').innerHTML=`<div class="sheet-title premium-sheet-title"><div class="eyebrow">Fiche dispositif · ${esc(a.kind||'Aide')}</div><h2>${esc(title)}</h2><div class="row sheet-tags">${guichetLabels(a).map(x=>`<span class="pill">${esc(x)}</span>`).join('')}${arr(a.aidTypes).filter(x=>x!=='AUTRE').map(x=>`<span class="pill ok">${esc(aidTypeLabel(x))}</span>`).join('')}${a.scope?`<span class="pill">${a.scope==='NATIONAL'?'National':'Régional'}</span>`:''}${dm.state==='recent-closed'?'<span class="pill warn">Clôturé ≤ 60 jours</span>':''}</div></div>
  <div class="sheet-grid premium-sheet">
    ${box('Objectif',fieldHtml(a,a.objective,'objective'))}
    ${box('Projets attendus',fieldHtml(a,a.projectsExpected,'projectsExpected'))}
    ${box('Bénéficiaires',fieldHtml(a,a.beneficiaries,'beneficiaries'))}
    ${box('Taille d’entreprise',arr(a.companyCategories).length?listText(a.companyCategories):missingOrCdc(a,'Taille d’entreprise non explicitée'))}
    ${box('Thématiques visées',arr(a.themes).length?listText(a.themes):missingOrCdc(a,'Thématiques non structurées dans la fiche'))}
    ${box('Portée / territoire',`<p><b>${a.scope==='NATIONAL'?'National':'Régional'}</b><br>${esc(arr(a.regions).join(', ')||'Territoire non publié')}</p>`)}
    ${box('Financeur / opérateur',`<p><b>${esc(arr(a.funder).join(', ')||'Financeur non publié')}</b>${a.operator||a.programme?`<br>${esc(a.operator||a.programme)}`:''}</p>`)}
    ${box('Type de financement',arr(a.aidTypes).length?listText(arr(a.aidTypes).filter(x=>x!=='AUTRE').map(aidTypeLabel)):missingOrCdc(a,'Type de financement non explicité'))}
    ${box('Assiette du projet',assiette)}
    ${box('Montant de l’aide',amount)}
    ${box('Taux d’aide',rate)}
    ${box('Taux / montants par taille',sizeFinance(a))}
    ${box('Dépenses éligibles',fieldHtml(a,a.eligibleExpenses,'eligibleExpenses'))}
    ${box('Dépenses exclues',fieldHtml(a,a.excludedExpenses,'excludedExpenses'))}
    ${box('Pré-requis / conditions d’éligibilité',fieldHtml(a,a.prerequisites,'prerequisites'))}
    ${box('Critères de sélection',fieldHtml(a,a.selectionCriteria,'selectionCriteria'))}
    ${box('Calendrier',calendar)}
    ${box('Modalités de candidature',fieldHtml(a,a.applicationProcess,'applicationProcess'))}
    ${box('Modalités de versement',fieldHtml(a,a.disbursementTerms||a.paymentTerms,'disbursementTerms'))}
    ${box('Remboursement / avance remboursable',fieldHtml(a,a.repaymentTerms,'repaymentTerms'))}
    ${box('Régime d’aides / cumul',fieldHtml(a,a.stateAidRules||a.cumulationRules,'stateAidRules'))}
    ${box('Contact',fieldHtml(a,a.contact,'contact'))}
    ${box('Documents & candidature',docButtons(a),true)}
    ${box('Sources officielles',sourceLinks.length?sourceLinks.map(x=>`<p><a class="source-card-link" href="${esc(x.url)}" target="_blank" rel="noopener"><span>${esc(x.label||'Source officielle')}</span><b>Ouvrir ↗</b></a></p>`).join(''):missingOrCdc(a,'Page officielle directe non rattachée'),true)}
  </div>
  <div class="sheet-footer"><span class="mini">Dernière mise à jour source : ${esc(a.sourceUpdatedAt||a.verification?.lastChecked||'—')}</span><div class="row"><button class="btn" onclick="window.print()">Imprimer / PDF</button>${url?`<a class="btn primary" target="_blank" rel="noopener" href="${esc(url)}">Source officielle ↗</a>`:''}</div></div>`;
  $('#modal').classList.remove('hidden');
}
function csvCell(v){return '"'+String(v??'').replaceAll('"','""').replace(/\r?\n/g,' ')+'"'}
function exportLibraryCsv(rows){
  const header=['Nom AAP / aide','Guichet','Financeurs','Bénéficiaires / taille','Thématiques visées','Portée','Régions','Type aide','Assiette min','Assiette max','Montant aide min','Montant aide max','Taux min','Taux max','Taux / montants par taille','Projets attendus','Dépenses éligibles','Pré-requis','Critères de sélection','Relèves','Date de clôture','Lien officiel'];
  const lines=[header.map(csvCell).join(';')];
  for(const a of rows){
    const bySize=arr(a.aidAmount?.byCompanySize).concat(arr(a.aidRate?.byCompanySize)).map(x=>`${x.category||''}: taux ${x.rateMin??x.min??'—'}-${x.rateMax??x.max??'—'}%; montant ${x.amountMin??'—'}-${x.amountMax??'—'}`).join(' | ');
    lines.push([
      displayAidTitle(a),guichetLabels(a).join(' | '),arr(a.funder).join(' | '),[arr(a.companyCategories).join(' / '),a.beneficiaries].filter(Boolean).join(' — '),arr(a.themes).join(' | '),
      a.scope==='NATIONAL'?'National':'Régional',arr(a.regions).join(' | '),arr(a.aidTypes).map(aidTypeLabel).join(' | '),
      a.minimumProjectCost??'',a.maximumProjectCost??'',a.aidAmount?.min??'',a.aidAmount?.max??'',a.aidRate?.min??'',a.aidRate?.max??'',bySize,
      arr(a.projectsExpected).join(' | '),a.eligibleExpenses||'',a.prerequisites||'',a.selectionCriteria||'',
      arr(a.deadlines).map(x=>typeof x==='string'?x:x?.date).filter(Boolean).join(' | '),a.finalClosingDate||a.closingDate||'',officialUrl(a)||''
    ].map(csvCell).join(';'));
  }
  const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
  const href=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=href;a.download=`Funding_Radar_bibliotheque_${today()}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1000);
}
const searchCache=new WeakMap();
function searchText(a){
  if(searchCache.has(a))return searchCache.get(a);
  const raw=norm([a.title,a.objective,a.beneficiaries,...arr(a.themes),...arr(a.projectsExpected),...arr(a.funder),a.programme,a.operator,...arr(a.sourceAliases)].join(' '));
  const text=raw.replace(/\bbpi france\b/g,'bpifrance')+(/bpifrance/.test(raw)?' bpi':'');
  searchCache.set(a,text);return text;
}
function matchesSearch(a,q){
  const text=searchText(a);
  const terms=norm(q).replace(/\bbpi france\b/g,'bpifrance').split(' ').filter(x=>x.length>1&&!['de','du','des','aux','les','le','la','en','et'].includes(x));
  return terms.every(t=>text.includes(t)||t.length>4&&t.endsWith('s')&&text.includes(t.slice(0,-1)));
}
function libraryDateMeta(a){
  if(a.permanent)return{label:'Permanent',days:null,state:'open'};
  const dates=uniq([...arr(a.deadlines).map(x=>typeof x==='string'?x:x?.date),a.finalClosingDate,a.closingDate].filter(Boolean)).sort();
  const future=dates.find(d=>daysUntil(d)>=1);
  if(future)return{label:fmtDate(future),days:daysUntil(future),state:'open'};
  const last=dates.at(-1)||null;
  if(last&&daysUntil(last)>=-60)return{label:fmtDate(last),days:daysUntil(last),state:'recent-closed'};
  return{label:last?fmtDate(last):'Date non publiée',days:last?daysUntil(last):null,state:last?'closed':'unknown'};
}
function library(resultsOnly=false){
  const q=window.__q||'',region=window.__reg||'',kind=window.__kind||'',theme=window.__theme||'',instrument=window.__instrument||'',time=window.__time||'',guichet=window.__guichet||'',selectedCategories=window.__categories||[];
  const catalog=state.lib.filter(libraryAid);
  const themes=uniq(catalog.flatMap(a=>arr(a.themes))).sort((a,b)=>a.localeCompare(b,'fr'));
  const instruments=uniq(catalog.flatMap(a=>arr(a.aidTypes))).sort((a,b)=>aidTypeLabel(a).localeCompare(aidTypeLabel(b),'fr'));
  const guichets=uniq(catalog.flatMap(guichetLabels)).sort((a,b)=>a.localeCompare(b,'fr'));
  const list=catalog.filter(a=>{
    const dm=libraryDateMeta(a);
    if(q&&!matchesSearch(a,q))return false;
    if(region&&!arr(a.regions).includes(region)&&!arr(a.regions).includes('Toutes les Régions'))return false;
    if(kind&&a.kind!==kind)return false;
    if(theme&&!arr(a.themes).includes(theme))return false;
    if(instrument&&!arr(a.aidTypes).includes(instrument))return false;
    if(guichet&&!guichetLabels(a).includes(guichet))return false;
    if(time==='open'&&dm.state!=='open')return false;
    if(time==='recent'&&dm.state!=='recent-closed')return false;
    if(time==='nodate'&&dm.state!=='unknown')return false;
    if(selectedCategories.length&&!selectedCategories.some(c=>arr(a.companyCategories).includes(c)))return false;
    return true;
  }).sort((a,b)=>{
    const titleRank=x=>q?norm(q).split(' ').filter(t=>t.length>2&&norm(displayAidTitle(x)).includes(t)).length:0;
    const ra=titleRank(a),rb=titleRank(b);if(ra!==rb)return rb-ra;
    const da=libraryDateMeta(a),db=libraryDateMeta(b);
    const stateRank={open:0,unknown:1,'recent-closed':2,closed:3};
    if(stateRank[da.state]!==stateRank[db.state])return stateRank[da.state]-stateRank[db.state];
    const ad=a.finalClosingDate||a.closingDate||'9999',bd=b.finalClosingDate||b.closingDate||'9999';
    return ad.localeCompare(bd);
  });
  window.__lastLibraryList=list;
  const pageSize=50,page=Math.max(0,Math.min(window.__libPage||0,Math.max(0,Math.ceil(list.length/pageSize)-1)));window.__libPage=page;
  const view=list.slice(page*pageSize,(page+1)*pageSize);
  const markup=`<div class="page-head library-head"><div><div class="eyebrow">Bibliothèque des aides & appels à projets</div><h1>Référentiel des financements publics</h1><p class="sub">Dispositifs ouverts, permanents et clôturés depuis moins de 60 jours. Filtrez par région, thématique, instrument, guichet et bénéficiaire.</p></div><div class="row end"><span class="badge info" id="libraryCount" aria-live="polite">${list.length} résultat(s)</span><button class="btn primary" id="exportLibraryCsv">Exporter CSV</button></div></div>
  <div class="filters funding-filters">
    <input class="input search-main" id="libQ" aria-label="Rechercher dans les aides" placeholder="Rechercher un dispositif, une thématique, un financeur…" value="${esc(q)}">
    <select id="libGuichet" aria-label="Guichet"><option value="">Tous les guichets</option>${guichets.map(g=>`<option value="${esc(g)}" ${g===guichet?'selected':''}>${esc(g)}</option>`).join('')}</select>
    <select id="libRegion"><option value="">Toutes régions</option>${REGIONS.map(r=>`<option ${r===region?'selected':''}>${esc(r)}</option>`).join('')}</select>
    <select id="libTheme" aria-label="Thématique"><option value="">Toutes thématiques</option>${themes.map(t=>`<option value="${esc(t)}" ${t===theme?'selected':''}>${esc(t)}</option>`).join('')}</select>
    <select id="libInstrument" aria-label="Instrument"><option value="">Tous instruments</option>${instruments.map(t=>`<option value="${esc(t)}" ${t===instrument?'selected':''}>${esc(aidTypeLabel(t))}</option>`).join('')}</select>
    <select id="libKind"><option value="">Tous les dispositifs</option><option ${kind==='AAP / AMI'?'selected':''}>AAP / AMI</option><option ${kind==='AIDE'?'selected':''}>AIDE</option></select>
    <select id="libTime"><option value="">Ouverts + J-60</option><option value="open" ${time==='open'?'selected':''}>Ouverts / permanents</option><option value="recent" ${time==='recent'?'selected':''}>Clôturés depuis ≤ 60 jours</option><option value="nodate" ${time==='nodate'?'selected':''}>Date non publiée</option></select>
    <button class="btn" id="libRefresh">Rafraîchir</button>
  </div>
  <div role="group" aria-label="Taille d’entreprise" class="library-size-filter"><span class="mini">Taille d’entreprise</span>${['PME','ETI','GE','STARTUP'].map(c=>`<label class="pill"><input type="checkbox" class="libCategory" value="${c}" ${selectedCategories.includes(c)?'checked':''}> ${c==='STARTUP'?'Startup':c}</label>`).join('')}</div>
  <div id="libraryResults"><div class="table-wrap library-table"><table><thead><tr><th>Dispositif</th><th>Guichet</th><th>Portée</th><th>Instrument</th><th>Entreprise</th><th>Échéance</th><th>Documents</th></tr></thead><tbody>${view.map(a=>{const dm=libraryDateMeta(a),url=officialUrl(a),title=displayAidTitle(a),gu=guichetLabels(a);return`<tr class="${dm.state==='recent-closed'?'recent-closed-row':''}"><td>${url?`<a href="${esc(url)}" target="_blank" rel="noopener" class="link aid-name"><b>${esc(title)} ↗</b></a>`:`<b class="aid-name">${esc(title)}</b>`}<div class="mini">${esc(arr(a.funder).join(', ')||'Financeur non précisé')}</div><a class="link-button open-aid" data-id="${esc(a.id)}" href="?aid=${encodeURIComponent(a.id)}">Voir la fiche</a></td><td>${gu.map(g=>`<span class="pill">${esc(g)}</span>`).join(' ')||'—'}</td><td>${a.scope==='NATIONAL'?'<span class="pill">National</span>':`<span class="pill">${esc(arr(a.regions).join(', ')||'Régional')}</span>`}</td><td>${arr(a.aidTypes).map(x=>`<span class="pill ok">${esc(aidTypeLabel(x))}</span>`).join(' ')||'—'}</td><td>${esc(arr(a.companyCategories).join(', ')||'—')}</td><td>${dm.state==='recent-closed'?'<span class="badge warn">Clôturé</span> ':''}${esc(dm.label)}${dm.days!=null?` <span class="mini">${dm.days>=0?'J+':'J'}${dm.days}</span>`:''}</td><td>${arr(a.cdcLinks).length?`<span class="badge ok">${arr(a.cdcLinks).length} CdC</span>`:''}${arr(a.formLinks).length?` <span class="badge info">${arr(a.formLinks).length} dossier</span>`:(!arr(a.cdcLinks).length?'—':'')}</td></tr>`}).join('')}</tbody></table></div>${!list.length?'<div class="empty">Aucun dispositif ne correspond à ces filtres.</div>':''}<div class="row between pagination"><button class="btn" id="libPrev" ${page===0?'disabled':''}>Précédent</button><span>Page ${page+1} / ${Math.max(1,Math.ceil(list.length/pageSize))} · ${list.length} résultats</span><button class="btn" id="libNext" ${(page+1)*pageSize>=list.length?'disabled':''}>Suivant</button></div></div>`;
  if(resultsOnly&&$('#libraryResults')){
    const template=document.createElement('template');template.innerHTML=markup;
    $('#libraryResults').replaceWith(template.content.querySelector('#libraryResults'));
    $('#libraryCount').textContent=list.length+' résultat(s)';
  }else $('#app').innerHTML=markup;
  $('#libPrev').onclick=()=>{window.__libPage=page-1;library(true)};
  $('#libNext').onclick=()=>{window.__libPage=page+1;library(true)};
  const qInput=$('#libQ');
  const scheduleSearch=()=>{window.__q=qInput.value;window.__libPage=0;clearTimeout(window.__libSearchTimer);window.__libSearchTimer=setTimeout(()=>{if(state.route==='library')library(true)},180)};
  qInput.oninput=e=>{if(!e.isComposing)scheduleSearch()};qInput.oncompositionend=scheduleSearch;
  $('#libGuichet').onchange=e=>{window.__guichet=e.target.value;window.__libPage=0;library()};
  $('#libRegion').onchange=e=>{window.__reg=e.target.value;window.__libPage=0;library()};
  $('#libKind').onchange=e=>{window.__kind=e.target.value;window.__libPage=0;library()};
  $('#libTheme').onchange=e=>{window.__theme=e.target.value;window.__libPage=0;library()};
  $('#libInstrument').onchange=e=>{window.__instrument=e.target.value;window.__libPage=0;library()};
  $('#libTime').onchange=e=>{window.__time=e.target.value;window.__libPage=0;library()};
  $$('.libCategory').forEach(x=>x.onchange=()=>{window.__categories=$$('.libCategory:checked').map(y=>y.value);window.__libPage=0;library()});
  $('#libRefresh').onclick=loadAll;
  $('#exportLibraryCsv').onclick=()=>exportLibraryCsv(window.__lastLibraryList||list);
  $$('.open-aid').forEach(x=>x.onclick=e=>{e.preventDefault();openAid(x.dataset.id)});
}
function watch(){
  const ch=state.changes.slice().sort((a,b)=>String(b.at||'').localeCompare(String(a.at||'')));
  const creations=ch.filter(x=>x.type==='CREATION');
  const businessFields=new Set(['closingDate','finalClosingDate','deadlines','aidRate','aidAmount','aidTypes','eligibleExpenses','prerequisites','selectionCriteria','beneficiaries','themes','minimumProjectCost','maximumProjectCost']);
  const updates=ch.filter(x=>x.type==='MODIFICATION'&&arr(x.fields).some(f=>businessFields.has(f)));
  const closures=ch.filter(x=>/SORTIE|CLOS|ARCHIVE/.test(x.type));
  const findAid=x=>state.lib.find(a=>a.id===x.id)||state.lib.find(a=>norm(a.title)===norm(x.title||''));
  const item=(x,label)=>{const a=findAid(x),url=a?officialUrl(a):null,title=a?displayAidTitle(a):(x.title||x.id);return`<div class="watch-item"><div><span class="pill ${label==='Nouveau'?'ok':label==='Clôture'?'warn':'info'}">${label}</span> <b>${esc(title)}</b><div class="mini">${x.at?esc(new Date(x.at).toLocaleString('fr-FR')):'Date d’intégration non renseignée'}</div>${arr(x.fields).length?`<div class="mini">Mise à jour : ${esc(arr(x.fields).join(', '))}</div>`:''}</div><div class="row">${a?`<a class="btn small open-aid" data-id="${esc(a.id)}" href="?aid=${encodeURIComponent(a.id)}">Voir la fiche</a>`:''}${url?`<a class="btn small" target="_blank" rel="noopener" href="${esc(url)}">Source officielle ↗</a>`:''}</div></div>`};
  $('#app').innerHTML=`<div class="page-head"><div><div class="eyebrow">Veille des financements</div><h1>Nouveaux AAP & aides</h1><p class="sub">Suivez les aides et appels à projets ajoutés à la base. La date d’intégration est distincte de la date de publication par le financeur. Les modifications et clôtures sont présentées séparément.</p></div><button class="btn primary" id="watchCollect">Actualiser la bibliothèque</button></div>
  <div class="grid g3"><div class="metric"><b>${creations.length}</b><span>nouveaux dispositifs intégrés</span></div><div class="metric"><b>${updates.length}</b><span>mises à jour utiles</span></div><div class="metric"><b>${closures.length}</b><span>sorties / clôtures</span></div></div>
  <div class="card watch-card" style="margin-top:16px"><h3>Derniers dispositifs intégrés</h3>${creations.length?creations.slice(0,40).map(x=>item(x,'Nouveau')).join(''):'<div class="empty">Aucune nouvelle intégration enregistrée dans le journal disponible.</div>'}</div>
  ${updates.length?`<div class="card watch-card" style="margin-top:16px"><h3>Évolutions à prendre en compte</h3>${updates.slice(0,30).map(x=>item(x,'Mise à jour')).join('')}</div>`:''}
  ${closures.length?`<div class="card watch-card" style="margin-top:16px"><h3>Dispositifs sortis ou clôturés</h3>${closures.slice(0,20).map(x=>item(x,'Clôture')).join('')}</div>`:''}`;
  $('#watchCollect').onclick=requestCollection;
  $$('.open-aid').forEach(x=>x.onclick=e=>{e.preventDefault();openAid(x.dataset.id)});
}
function sourceMeta(id){return state.sources.find(s=>s.id===id)||null}
function sourceIsControl(id){const s=sourceMeta(id);return s?.type==='control'||s?.strategy==='control-only'}
function sources(){
  const coverageById=new Map(arr(state.coverage).map(x=>[x.id,x]));
  const rows=arr(state.sources);
  const national=rows.filter(s=>s.scope==='France').length;
  const regional=rows.length-national;
  $('#app').innerHTML=`<div class="page-head"><div><div class="eyebrow">Référentiel officiel</div><h1>Sources publiques</h1><p class="sub">Chaque source référencée est accessible directement. Les fiches reprennent les informations disponibles ; la date et le règlement propres au dispositif restent déterminants.</p></div><button class="btn" id="sourcesRefresh">Rafraîchir</button></div>
  <div class="grid g3"><div class="metric"><b>${rows.length||state.meta.sourceCount||'—'}</b><span>sources officielles référencées</span></div><div class="metric"><b>${national}</b><span>sources nationales</span></div><div class="metric"><b>${regional}</b><span>sources régionales</span></div></div>
  <div class="table-wrap sources-table" style="margin-top:14px"><table><thead><tr><th>Source officielle</th><th>Périmètre</th><th>Accès</th><th>Dernière synchronisation</th></tr></thead><tbody>${rows.map(s=>{const cv=coverageById.get(s.id);return`<tr><td><a class="link source-name" href="${esc(s.url)}" target="_blank" rel="noopener"><b>${esc(s.name)}</b> ↗</a></td><td>${esc(s.scope==='France'?'National':s.scope)}</td><td><span class="badge ok">Source officielle</span></td><td>${cv?.checkedAt?new Date(cv.checkedAt).toLocaleString('fr-FR'):'—'}</td></tr>`}).join('')}</tbody></table></div>`;
  $('#sourcesRefresh').onclick=loadAll;
}
function production(){const r=state.readiness;const gates=r?.gates||[];$('#app').innerHTML=`<div class="page-head"><div><div class="eyebrow">Production Readiness</div><h1>Validation interne</h1><p class="sub">Les 10 gates de passage en production. Un point n'est considéré validé qu'après preuve d'exécution réelle.</p></div><span class="badge ${r?.goProduction?'ok':'warn'}">${r?.goProduction?'GO PRODUCTION':'EN COURS'}</span></div>${gates.length?`<div class="grid g2">${gates.map(g=>`<div class="card"><div class="row between"><h3>Gate ${g.id}</h3><span class="badge ${/PASS/.test(g.status)?'ok':g.status==='FAIL'||g.status==='BLOCKED'?'block':'warn'}">${esc(g.status)}</span></div><b>${esc(g.name)}</b><p class="mini">${esc(g.detail)}</p></div>`).join('')}</div>`:'<div class="callout warn">Le rapport de readiness sera généré par le pipeline de production.</div>'}`}

async function requestCollection(){if(CONFIG.refreshEndpoint){const token=window.prompt('Code administrateur (non enregistré)');if(!token)return;try{toast('Demande de collecte envoyée…');const r=await fetch(CONFIG.refreshEndpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({action:'full-refresh'})});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||('HTTP '+r.status));toast('Collecte demandée. Le rapport sera mis à jour après le cycle.')}catch(e){toast(`Impossible de déclencher la collecte : ${esc(e.message)}`)}}else if(hostedProduction()){await loadAll();toast('Bibliothèque officielle publiée rechargée. La collecte complète reste exécutée côté serveur.')}else{clientLiveRefresh({full:true,silent:false}).catch(()=>{})}}
document.addEventListener('click',e=>{const t=e.target.closest('.open-result,.open-aid');if(t){e.preventDefault();openAid(t.dataset.id)}});
loadAll().then(()=>{scheduleClientDailyRefresh();return maybeAutoClientRefresh()}).catch(e=>{$('#app').innerHTML=`<div class="callout warn"><b>Bibliothèque publiée indisponible.</b><br>${esc(e.message)}<br>La dernière version embarquée reste accessible si elle est présente.</div>`});


