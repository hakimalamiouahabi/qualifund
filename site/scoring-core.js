(function(root){
  'use strict';
  const arr=v=>Array.isArray(v)?v:(v==null||v===''?[]:[v]);
  const uniq=a=>[...new Set(a.filter(Boolean))];
  const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,"'").replace(/[^a-z0-9%€+\- /]/g,' ').replace(/\s+/g,' ').trim();
  const STOP=new Set('avec pour dans des les une un aux sur par est sont ou et du de la le ce cette ces au en a d l se son sa ses leur leurs qui que quoi dont plus moins tout tous toute toutes entre vers afin ainsi peut peuvent sera seront doit doivent projet projets aide aides entreprise entreprises financement programme appel appels dispositif dispositifs travaux objectif objectifs attendu attendus'.split(' '));
  const tokens=s=>uniq(norm(s).split(' ').filter(x=>x.length>2&&!STOP.has(x)));
  const bigrams=s=>{const t=tokens(s),o=[];for(let i=0;i<t.length-1;i++)o.push(t[i]+' '+t[i+1]);return uniq(o)};

  const CONCEPTS={
    innovation:['innovation','r&d','recherche industrielle','developpement experimental','prototype','poc','demonstrateur','technologie','brevet','preuve de concept','deeptech'],
    industrialisation:['industrialisation','usine','production','machine','equipement','capacite','ligne','atelier','modernisation','outil productif','premiere usine','passage a l echelle'],
    digital:['numerique','digital','logiciel','data','cloud','saas','automatisation','digitalisation','systeme information'],
    ai:['ia','intelligence artificielle','machine learning','apprentissage','modele predictif','deep learning'],
    cyber:['cyber','cybersecurite','securite informatique','securisation'],
    decarbonation:['decarbonation','carbone','co2','gaz a effet de serre','sobriete','emissions','bas carbone'],
    energy:['energie','energetique','chaleur','electrique','hydrogene','photovolta','efficacite energetique','recuperation chaleur'],
    circular:['economie circulaire','recyclage','reemploi','matiere recyclee','dechet','ecoconception','valorisation'],
    water:['eau','hydrique','reutilisation','effluent','traitement eau'],
    health:['sante','medical','biotherapie','dispositif medical','medicament','diagnostic'],
    agri:['agriculture','agricole','agroalimentaire','elevage','viticulture','alimentaire'],
    mobility:['mobilite','transport','vehicule','ferroviaire','logistique'],
    aero:['aeronautique','spatial','aerospace','drone'],
    maritime:['maritime','naval','portuaire','aquaculture'],
    tourism:['tourisme','hotel','hebergement','touristique'],
    culture:['cinema','audiovisuel','jeu video','livre','culture'],
    employment:['emploi','emplois','recrutement','competences','formation'],
    export:['export','international','prospection','marche etranger'],
    investment:['investissement','capex','equipement','immobilier','batiment','travaux'],
    sovereignty:['souverainete','relocalisation','strategique','chaine de valeur','independance technologique'],
    collaboration:['consortium','collaboratif','partenaire','laboratoire','cooperation','filiere','ecosysteme'],
    market:['marche','commercialisation','industrialisation','business model','chiffre affaires','clients','debouches'],
    environment:['performance environnementale','biodiversite','adaptation climatique','economie ressources','impact environnemental']
  };

  const NAF_BUCKETS=[
    [/^(01|02|03)/,'agriculture agroalimentaire biomasse'],
    [/^(10|11|12)/,'agroalimentaire alimentation industrie'],
    [/^(13|14|15)/,'textile mode recyclage industrie'],
    [/^(16|17|18)/,'bois papier impression industrie'],
    [/^(19|20|21|22)/,'chimie pharmacie plasturgie materiaux industrie'],
    [/^(23|24|25)/,'materiaux metallurgie metal industrie'],
    [/^(26|27|28)/,'electronique electrique machines industrie numerique'],
    [/^(29|30)/,'automobile transport aeronautique naval industrie mobilite'],
    [/^(31|32|33)/,'fabrication maintenance industrie'],
    [/^(35)/,'energie electricite gaz chaleur'],
    [/^(36|37|38|39)/,'eau dechets recyclage environnement'],
    [/^(41|42|43)/,'construction batiment travaux ecoconstruction'],
    [/^(49|50|51|52|53)/,'transport logistique mobilite'],
    [/^(55|56)/,'tourisme hotel restauration'],
    [/^(58|59|60|61|62|63)/,'numerique logiciel data telecom audiovisuel'],
    [/^(64|65|66)/,'finance assurance'],
    [/^(69|70|71|72|73|74|75)/,'services professionnels ingenierie recherche conseil'],
    [/^(85)/,'formation education competences'],
    [/^(86|87|88)/,'sante medical social'],
    [/^(90|91|92|93)/,'culture loisirs sport']
  ];
  function nafText(naf=''){
    const n=String(naf).replace(/\D/g,'').slice(0,2);
    return (NAF_BUCKETS.find(([re])=>re.test(n))||[])[1]||'';
  }
  function conceptSet(text){
    const n=norm(text),out=[];
    for(const[k,ws]of Object.entries(CONCEPTS))if(ws.some(w=>new RegExp('(?:^|[^a-z0-9])'+norm(w).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:$|[^a-z0-9])').test(n)))out.push(k);
    return out;
  }
  function overlapDetails(aText,pText){
    const A=new Set(tokens(aText)),P=tokens(pText),B=new Set(bigrams(aText)),PB=bigrams(pText);
    const matched=P.filter(x=>A.has(x));
    const bigramHits=PB.filter(x=>B.has(x));
    const coverage=P.length?matched.length/Math.min(P.length,16):0;
    const precision=A.size?matched.length/Math.min(A.size,20):0;
    const bigram=PB.length?bigramHits.length/Math.min(PB.length,8):0;
    const ac=new Set(conceptSet(aText)),pc=conceptSet(pText),concepts=pc.filter(x=>ac.has(x));
    const concept=pc.length?concepts.length/Math.max(1,Math.ceil(pc.length*.55)):0;
    let ratio=Math.max(
      Math.min(1,.52*coverage+.16*precision+.14*bigram+.18*Math.min(1,concept)),
      Math.min(1,.68*concept+.32*coverage)
    );
    if(matched.length>=4)ratio+=.07;
    if(concepts.length>=2)ratio+=.07;
    return{ratio:Math.max(0,Math.min(1,ratio)),matched:uniq([...matched,...concepts]).slice(0,14),tokenHits:matched.length,conceptHits:concepts.length,bigramHits:bigramHits.length};
  }

  function detectFamily(a){
    const t=norm([a.sourceId,a.programme,a.operator,...arr(a.funder),...arr(a.sourceAliases)].join(' '));
    if(/ademe|agir pour la transition/.test(t))return'ADEME';
    if(/feder|fse\+?|ftj|europe en france|fonds europeen|programme regional 2021 2027/.test(t))return'FEDER';
    if(/bpifrance|france 2030|pia ?4|pia4/.test(t))return'BPIFRANCE_FRANCE2030';
    if(a.scope==='REGIONAL')return'REGIONAL';
    return'GENERAL';
  }
  // Internal retrieval dimensions; never an official funder selection scale.
  const RETRIEVAL_DIMENSIONS={strategic:1,expected:1,expenses:1,selection:1,beneficiary:1,maturity:1,impacts:1,finance:1,access:1};
  const PROFILE_LABEL={
    GENERAL:'Tous financeurs',
    BPIFRANCE_FRANCE2030:'Bpifrance / France 2030',
    ADEME:'ADEME',
    FEDER:'FEDER / fonds européens',
    REGIONAL:'Aide régionale'
  };

  function projectContext(p){
    const naf=nafText(p.naf);
    const anchor=[p.name,p.summary,p.sector,p.naf,naf,...arr(p.types),p.digital,p.environment].join(' ');
    return{
      anchor,
      expenses:String(p.expenses||''),
      impacts:[p.impacts,p.jobs,p.environment,p.digital,p.summary,p.name].join(' '),
      capacity:[p.partners,p.financing,p.group,p.employees,p.turnover,p.balanceSheet,p.summary].join(' '),
      maturity:[p.maturity,...arr(p.types),p.summary,p.name].join(' '),
      access:[p.region,p.startDate,p.endDate,p.budget,p.sector,p.naf,naf].join(' ')
    };
  }
  function validDate(v){return String(v||'').match(/^\d{4}-\d{2}-\d{2}/)?.[0]||null}
  function calendarFit(a,p){
    if(a.permanent)return 1;
    const ds=[...arr(a.deadlines).map(x=>typeof x==='string'?x:x?.date),a.finalClosingDate,a.closingDate].map(validDate).filter(Boolean);
    if(!ds.length)return .55;
    const now=new Date();now.setHours(0,0,0,0);
    const open=ds.filter(d=>new Date(d+'T23:59:59')>=now);
    return open.length?1:0;
  }
  function financeFit(a,p){
    const b=Number(p.budget||0);
    const min=(a.minimumProjectCost!=null&&a.minimumProjectCost!==''&&Number.isFinite(Number(a.minimumProjectCost)))?Number(a.minimumProjectCost):null;
    const max=(a.maximumProjectCost!=null&&a.maximumProjectCost!==''&&Number.isFinite(Number(a.maximumProjectCost)))?Number(a.maximumProjectCost):null;
    const hasTerms=a.aidRate?.min!=null||a.aidRate?.max!=null||a.aidAmount?.min!=null||a.aidAmount?.max!=null||a.aidRate?.raw||a.aidAmount?.raw;
    if(!b)return hasTerms?.65:.5;
    if(min!=null&&b<min)return 0;
    if(max!=null&&b>max)return 0;
    return (min!=null||max!=null||hasTerms)?1:.65;
  }
  function territoryFit(a,p){
    if(a.scope==='NATIONAL')return 1;
    if(a.scope==='REGIONAL'&&p.region&&p.region!=='À préciser')return arr(a.regions).includes(p.region)||arr(a.regions).includes('Toutes les Régions')?1:0;
    if(a.scope==='REGIONAL')return .5;
    return .4;
  }
  function beneficiaryFit(a,p,ctx){
    const cats=arr(a.companyCategories),cat=String(p.category||'');
    let size=.55;
    if(cat&&cat!=='À préciser'&&cats.length)size=(cats.includes(cat)||(p.startup&&cats.includes('STARTUP')))?1:0;
    const aidText=[a.beneficiaries,...cats,a.objective].join(' ');
    const sector=aidText.trim()?overlapDetails(aidText,[p.sector,p.naf,nafText(p.naf),ctx.anchor].join(' ')).ratio:.55;
    return .68*size+.32*sector;
  }
  function maturityFit(a,p,ctx){
    const aid=norm([a.objective,...arr(a.projectsExpected),a.prerequisites,a.selectionCriteria].join(' '));
    if(!aid)return .55;
    const m=norm(p.maturity||'');
    const groups={
      faisabilite:['faisabilite','etude','preuve de concept','poc'],
      poc:['poc','preuve de concept','faisabilite'],
      prototype:['prototype','prototypage','developpement experimental'],
      demonstrateur:['demonstrateur','pilote','demonstration'],
      industrialisation:['industrialisation','premiere usine','pre industrialisation','passage a l echelle'],
      investissement:['investissement','deploiement','modernisation','production']
    };
    let stage=.55;
    const key=Object.keys(groups).find(k=>m.includes(k));
    if(key)stage=groups[key].some(x=>aid.includes(norm(x)))?1:.25;
    const type=overlapDetails(aid,ctx.maturity).ratio;
    return Math.max(stage,.75*type+.25*stage);
  }
  function impactFit(a,p,ctx,family){
    const aid=[a.selectionCriteria,a.objective,...arr(a.projectsExpected),a.prerequisites].filter(Boolean).join(' ');
    if(!aid)return{ratio:0,matched:[],documented:false};
    let project=ctx.impacts;
    if(family==='ADEME')project=[p.environment,p.impacts,p.summary,p.expenses].join(' ');
    if(family==='BPIFRANCE_FRANCE2030')project=[p.impacts,p.jobs,p.summary,p.digital,p.partners,ctx.capacity].join(' ');
    if(family==='FEDER')project=[p.impacts,p.jobs,p.summary,p.sector,p.region,p.partners,ctx.capacity].join(' ');
    const d=overlapDetails(aid,project);
    return{...d,documented:true};
  }
  function accessFit(a,p){
    return .58*territoryFit(a,p)+.42*calendarFit(a,p);
  }

  function relevance(a,p){
    const family=detectFamily(a),w=RETRIEVAL_DIMENSIONS,ctx=projectContext(p),dims=[];
    const present=v=>String(v??'').trim()!==''&&v!=='À préciser'&&v!=='À vérifier';
    const available={
      strategic:[p.summary,p.name,p.sector,p.naf,...arr(p.types),p.digital,p.environment].some(present),
      expected:present(p.summary)||arr(p.types).length>0,
      expenses:present(p.expenses),selection:present(p.summary),
      beneficiary:present(p.category)||present(p.sector),maturity:present(p.maturity),
      impacts:[p.impacts,p.environment,p.jobs].some(present),finance:Number(p.budget)>0,
      access:present(p.region)
    };
    const add=(key,label,ratio,detail,matched=[],documented=true)=>{
      documented=Boolean(documented&&available[key]);
      if(!available[key])detail='Information projet non renseignée — à instruire';
      const max=w[key],safe=Math.max(0,Math.min(1,ratio));
      dims.push({key,label,max,score:documented?max*safe:0,ratio:documented?Math.round(100*safe):null,detail,matched:arr(matched).slice(0,12),documented});
    };

    const strategicText=[a.title,a.objective,...arr(a.themes),a.programme].filter(Boolean).join(' ');
    const strategic=overlapDetails(strategicText,ctx.anchor);
    add('strategic','Objectifs, priorités & thématiques',strategic.ratio,strategic.ratio>=.72?'Alignement stratégique fort':strategic.ratio>=.45?'Alignement partiel':'Alignement faible',strategic.matched,Boolean(strategicText));

    const expectedText=arr(a.projectsExpected).join(' ');
    const expected=expectedText?overlapDetails(expectedText,ctx.anchor):{ratio:0,matched:[]};
    add('expected','Nature des projets attendus',expected.ratio,expectedText?'Projet comparé aux opérations attendues':'Projet attendu non documenté',expected.matched,Boolean(expectedText));

    const expenseText=String(a.eligibleExpenses||'');
    const expenses=expenseText?overlapDetails(expenseText,ctx.expenses):{ratio:0,matched:[]};
    add('expenses','Dépenses & assiette éligible',expenses.ratio,expenseText?'Postes de dépenses rapprochés de l’assiette publiée':'Dépenses éligibles non documentées',expenses.matched,Boolean(expenseText));

    const selectionText=[a.selectionCriteria,a.prerequisites].filter(Boolean).join(' ');
    const selection=selectionText?overlapDetails(selectionText,[ctx.anchor,ctx.impacts,ctx.capacity,ctx.maturity].join(' ')):{ratio:0,matched:[]};
    add('selection','Critères de sélection & prérequis',selection.ratio,selectionText?'Critères de sélection rapprochés du projet':'Critères de sélection non documentés',selection.matched,Boolean(selectionText));

    const beneficiaryDocumented=Boolean(String(a.beneficiaries||'').trim()||arr(a.companyCategories).length);
    const beneficiary=beneficiaryFit(a,p,ctx);
    add('beneficiary','Bénéficiaire, activité & secteur',beneficiary,beneficiaryDocumented?(beneficiary>=.8?'Profil porteur cohérent':beneficiary<=.2?'Profil porteur peu compatible':'Profil porteur à confirmer'):'Bénéficiaires non documentés',[],beneficiaryDocumented);

    const maturityDocumented=Boolean(a.objective||arr(a.projectsExpected).length||a.prerequisites||a.selectionCriteria);
    const maturity=maturityFit(a,p,ctx);
    add('maturity','Maturité technique & typologie',maturity,maturity>=.8?'Maturité et typologie cohérentes':maturity<=.3?'Maturité peu alignée':'Maturité à confirmer',[],maturityDocumented);

    const impact=impactFit(a,p,ctx,family);
    const impactLabel=family==='ADEME'?'Performance environnementale & impacts':family==='BPIFRANCE_FRANCE2030'?'Innovation, retombées & capacité d’exécution':family==='FEDER'?'Impacts, indicateurs & cohérence programme':'Impacts attendus & valeur du projet';
    add('impacts',impactLabel,impact.ratio,impact.documented?'Impacts rapprochés des attendus du financeur':'Impacts / attendus non documentés',impact.matched,impact.documented);

    const financeDocumented=Boolean(a.minimumProjectCost!=null||a.maximumProjectCost!=null||a.aidRate?.min!=null||a.aidRate?.max!=null||a.aidAmount?.min!=null||a.aidAmount?.max!=null||a.aidRate?.raw||a.aidAmount?.raw);
    const finance=financeFit(a,p);
    add('finance','Budget, intensité & montage financier',finance,financeDocumented?(finance>=.8?'Budget compatible avec les modalités connues':finance===0?'Budget hors assiette connue':'Montage financier à confirmer'):'Modalités financières non documentées',[],financeDocumented);

    const accessDocumented=Boolean(a.scope||a.permanent||a.closingDate||a.finalClosingDate||arr(a.deadlines).length);
    const access=accessFit(a,p);
    add('access','Territoire, calendrier & accessibilité',access,access>=.85?'Accès temporel et territorial cohérent':access<=.25?'Accès peu compatible':'Accès à confirmer',[],accessDocumented);

    const documentedWeight=dims.filter(d=>d.documented).reduce((s,d)=>s+d.max,0);
    const earned=dims.filter(d=>d.documented).reduce((s,d)=>s+d.score,0);
    const normalized=documentedWeight?100*earned/documentedWeight:0;
    const coverageFactor=1;
    const score=Math.round(Math.min(100,normalized*coverageFactor));
    return{
      score,dims,checks:dims.length,documentedWeight,
      coverageFactor:Math.round(coverageFactor*100),
      family,profileLabel:PROFILE_LABEL[family]||PROFILE_LABEL.GENERAL,
      basis:String(p.summary||'').trim()?'description projet':'activité / NAF / thématiques'
    };
  }

  root.LEYTON_SCORING={relevance,tokens,norm,conceptSet,overlapDetails,detectFamily,nafText,projectContext,version:'12.5.0'};
})(typeof globalThis!=='undefined'?globalThis:this);

