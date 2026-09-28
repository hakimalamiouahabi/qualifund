(function(root){
  'use strict';
  const arr=v=>Array.isArray(v)?v:(v==null||v===''?[]:[v]);
  const uniq=a=>[...new Set(a.filter(Boolean))];
  const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,"'").replace(/[^a-z0-9%€+\- /]/g,' ').replace(/\s+/g,' ').trim();
  const STOP=new Set('avec pour dans des les une un aux sur par est sont ou et du de la le ce cette ces au en à a d l se son sa ses leur leurs qui que quoi dont plus moins tout tous toute toutes entre vers afin ainsi peut peuvent sera seront doit doivent projet projets aide aides entreprise entreprises financement programme appel appels dispositif dispositifs'.split(' '));
  const tokens=s=>uniq(norm(s).split(' ').filter(x=>x.length>3&&!STOP.has(x)));

  const CONCEPTS={
    innovation:['innovation','r&d','recherche','prototype','poc','demonstrateur','technologie','experimental','brevet','preuve de concept'],
    industrialisation:['industrialisation','usine','production','machine','equipement','capacite','ligne','atelier','modernisation','outil productif'],
    digital:['numerique','digital','logiciel','data','cloud','saas','automatisation','digitalisation','systeme information'],
    ai:['ia','intelligence artificielle','machine learning','apprentissage','modele predictif'],
    cyber:['cyber','cybersecurite','securite informatique','securisation'],
    decarbonation:['decarbonation','carbone','co2','gaz a effet de serre','sobriete','emissions'],
    energy:['energie','energetique','chaleur','electrique','hydrogene','photovolta','efficacite energetique'],
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
    investment:['investissement','capex','equipement','immobilier','batiment','travaux']
  };

  function conceptSet(text){
    const n=norm(text),out=[];
    for(const[k,ws]of Object.entries(CONCEPTS))if(ws.some(w=>n.includes(norm(w))))out.push(k);
    return out;
  }
  function lexical(text,queryTokens){
    if(!queryTokens.length)return 0;
    const s=new Set(tokens(text));
    const hits=queryTokens.filter(t=>s.has(t)).length;
    const target=Math.max(3,Math.min(10,Math.ceil(queryTokens.length*.28)));
    return Math.min(1,hits/target);
  }
  function conceptMatch(a,b){
    const A=new Set(conceptSet(a)),B=new Set(conceptSet(b));
    if(!B.size)return 0;
    let h=0;for(const x of B)if(A.has(x))h++;
    return Math.min(1,h/Math.max(1,Math.ceil(B.size*.55)));
  }
  function combinedFit(aText,pText){
    const q=tokens(pText);
    return Math.max(lexical(aText,q),conceptMatch(aText,pText));
  }
  function typeFit(a,p){
    const at=norm([a.title,a.objective,...arr(a.themes),...arr(a.projectsExpected)].join(' '));
    let h=0;
    for(const t of arr(p.types)){
      const c={
        'R&D / Innovation':['innovation','recherche','prototype','demonstrateur','poc'],
        'Investissement productif':['investissement','industrialisation','production','equipement','machine','modernisation'],
        'Transition numérique':['numerique','digital','ia','cyber','logiciel','robot','cloud','data'],
        'Transition écologique':['decarbonation','energie','recyclage','eau','ecologique','sobriete','carbone']
      }[t]||[];
      if(c.some(x=>at.includes(norm(x))))h++;
    }
    return arr(p.types).length?Math.min(1,h/arr(p.types).length):0.55;
  }
  function maturityFit(a,p){
    if(!p.maturity||p.maturity==='À préciser')return .65;
    const m=norm(p.maturity),t=norm([a.objective,...arr(a.projectsExpected),a.prerequisites].join(' '));
    const groups={
      faisabilite:['faisabilite','etude'],
      poc:['poc','preuve de concept','faisabilite'],
      prototype:['prototype','prototypage'],
      demonstrateur:['demonstrateur','pilote','demonstration'],
      industrialisation:['industrialisation','premiere usine','pre-industrialisation'],
      investissement:['investissement','deploiement','modernisation','production']
    };
    const key=Object.keys(groups).find(k=>m.includes(k))||null;
    if(!key)return .65;
    return groups[key].some(x=>t.includes(norm(x)))?1:.35;
  }
  function validDate(v){return String(v||'').match(/^\d{4}-\d{2}-\d{2}/)?.[0]||null}
  function calendarFit(a){
    if(a.permanent)return 1;
    const ds=[...arr(a.deadlines).map(x=>typeof x==='string'?x:x?.date),a.finalClosingDate,a.closingDate].map(validDate).filter(Boolean);
    if(!ds.length)return .55;
    const now=new Date();now.setHours(0,0,0,0);
    return ds.some(d=>Math.ceil((new Date(d+'T00:00:00')-now)/86400000)>=1)?1:0;
  }
  function financeFit(a,p){
    const b=Number(p.budget||0);
    const min=(a.minimumProjectCost!=null&&a.minimumProjectCost!==''&&Number.isFinite(Number(a.minimumProjectCost)))?Number(a.minimumProjectCost):null;
    const max=(a.maximumProjectCost!=null&&a.maximumProjectCost!==''&&Number.isFinite(Number(a.maximumProjectCost)))?Number(a.maximumProjectCost):null;
    const hasTerms=a.aidRate?.min!=null||a.aidRate?.max!=null||a.aidAmount?.min!=null||a.aidAmount?.max!=null||a.aidRate?.raw||a.aidAmount?.raw;
    if(b>0&&(min!=null||max!=null)){
      if(min!=null&&b<min)return 0;
      if(max!=null&&b>max)return 0;
      return 1;
    }
    if(b>0&&hasTerms)return .85;
    if(hasTerms)return .7;
    return .5;
  }
  function territoryFit(a,p){
    if(a.scope==='NATIONAL')return 1;
    if(a.scope==='REGIONAL'&&p.region&&p.region!=='À préciser')return arr(a.regions).includes(p.region)?1:0;
    if(a.scope==='REGIONAL')return .55;
    return .4;
  }
  function beneficiaryFit(a,p){
    const aid=[a.beneficiaries,...arr(a.companyCategories),a.objective].join(' ');
    const project=[p.category,p.startup?'startup':'',p.sector,p.naf,p.company].join(' ');
    if(!String(a.beneficiaries||'').trim()&&!arr(a.companyCategories).length)return .55;
    const categoryOk=arr(a.companyCategories).includes(p.category)||(p.startup&&arr(a.companyCategories).includes('STARTUP'));
    const lexicalFit=combinedFit(aid,project);
    return Math.max(categoryOk?1:0,lexicalFit);
  }
  function relevance(a,p){
    const description=[p.name,p.summary,p.sector,p.naf,p.impacts,p.environment,p.digital,p.partners,...arr(p.types)].join(' ');
    const expenseQuery=[p.expenses,p.summary,p.name].join(' ');
    const objectiveText=[a.title,a.objective,...arr(a.themes),a.programme].join(' ');
    const expectedText=arr(a.projectsExpected).join(' ');
    const expenseText=String(a.eligibleExpenses||'');
    const dims=[];
    const add=(label,max,ratio,detail)=>dims.push({label,max,score:Math.round(max*Math.max(0,Math.min(1,ratio))),detail});

    const objectiveRatio=combinedFit(objectiveText,description);
    add('Description, objectifs & thématiques',30,objectiveRatio,objectiveRatio>=.75?'Forte concordance avec la description du projet':objectiveRatio>=.45?'Concordance significative':'Concordance limitée');

    const expectedRatio=expectedText?combinedFit(expectedText,description):.5;
    add('Projets attendus',20,expectedRatio,expectedText?'Projets attendus rapprochés du projet':'Champ non documenté : impact neutralisé');

    const expenseRatio=expenseText?combinedFit(expenseText,expenseQuery):.5;
    add('Dépenses éligibles',15,expenseRatio,expenseText?'Lots de coûts comparés':'Champ non documenté : impact neutralisé');

    const bf=beneficiaryFit(a,p);
    add('Bénéficiaires & secteur',10,bf,bf>=.8?'Profil entreprise cohérent':'Profil à confirmer');

    const tf=typeFit(a,p),mf=maturityFit(a,p);
    add('Typologie & maturité',10,.65*tf+.35*mf,tf>=.75?'Typologie bien couverte':'Typologie ou maturité à confirmer');

    const ff=financeFit(a,p);
    add('Modalités financières',5,ff,ff>=.8?'Budget compatible avec les données disponibles':'Modalités à sécuriser');

    const cf=calendarFit(a);
    add('Calendrier',5,cf,cf===1?'Fenêtre exploitable':'Calendrier à sécuriser');

    const tr=territoryFit(a,p);
    add('Territorialité',5,tr,tr===1?'Territoire compatible':'Territoire à confirmer');

    return{score:dims.reduce((s,x)=>s+x.score,0),dims};
  }
  root.LEYTON_SCORING={relevance,tokens,norm,conceptMatch,typeFit,maturityFit,version:'12.3.0'};
})(typeof globalThis!=='undefined'?globalThis:this);
