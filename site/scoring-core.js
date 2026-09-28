(function(root){
  'use strict';
  const arr=v=>Array.isArray(v)?v:(v==null||v===''?[]:[v]);
  const uniq=a=>[...new Set(a.filter(Boolean))];
  const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,"'").replace(/[^a-z0-9%€+\- /]/g,' ').replace(/\s+/g,' ').trim();
  const STOP=new Set('avec pour dans des les une un aux sur par est sont ou et du de la le ce cette ces au en à a d l se son sa ses leur leurs qui que quoi dont plus moins tout tous toute toutes entre vers afin ainsi peut peuvent sera seront doit doivent projet projets aide aides entreprise entreprises financement programme appel appels dispositif dispositifs travaux objectif objectifs attendu attendus'.split(' '));
  const tokens=s=>uniq(norm(s).split(' ').filter(x=>x.length>2&&!STOP.has(x)));
  const bigrams=s=>{const t=tokens(s),o=[];for(let i=0;i<t.length-1;i++)o.push(t[i]+' '+t[i+1]);return uniq(o)};

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
    investment:['investissement','capex','equipement','immobilier','batiment','travaux'],
    sovereignty:['souverainete','relocalisation','strategique','chaine de valeur'],
    circularity:['eco-conception','ecoconception','cycle de vie','matiere secondaire']
  };

  function conceptSet(text){
    const n=norm(text),out=[];
    for(const[k,ws] of Object.entries(CONCEPTS))if(ws.some(w=>n.includes(norm(w))))out.push(k);
    return out;
  }
  function overlapDetails(aText,pText){
    const A=new Set(tokens(aText)),P=tokens(pText),B=new Set(bigrams(aText)),PB=bigrams(pText);
    const matched=P.filter(x=>A.has(x));
    const bigramHits=PB.filter(x=>B.has(x));
    const coverage=P.length?matched.length/Math.min(P.length,14):0;
    const precision=A.size?matched.length/Math.min(A.size,18):0;
    const bigram=PB.length?bigramHits.length/Math.min(PB.length,8):0;
    const ac=new Set(conceptSet(aText)),pc=conceptSet(pText),concepts=pc.filter(x=>ac.has(x));
    const concept=pc.length?concepts.length/Math.max(1,Math.ceil(pc.length*.55)):0;
    let ratio=Math.max(
      Math.min(1,.55*coverage+.15*precision+.15*bigram+.15*Math.min(1,concept)),
      Math.min(1,.72*concept+.28*coverage)
    );
    // Bonus de cohérence seulement lorsque plusieurs termes/concepts précis convergent.
    if(matched.length>=4)ratio+=.08;
    if(concepts.length>=2)ratio+=.06;
    return{ratio:Math.max(0,Math.min(1,ratio)),matched:uniq([...matched,...concepts]).slice(0,12),tokenHits:matched.length,conceptHits:concepts.length,bigramHits:bigramHits.length};
  }
  function fit(aText,pText){return overlapDetails(aText,pText).ratio}
  function typeFit(a,p){
    const at=norm([a.title,a.objective,...arr(a.themes),...arr(a.projectsExpected)].join(' '));
    const pts=arr(p.types);if(!pts.length)return .55;
    let h=0;
    for(const t of pts){
      const c={
        'R&D / Innovation':['innovation','recherche','prototype','demonstrateur','poc','r&d'],
        'Investissement productif':['investissement','industrialisation','production','equipement','machine','modernisation'],
        'Transition numérique':['numerique','digital','ia','cyber','logiciel','robot','cloud','data'],
        'Transition écologique':['decarbonation','energie','recyclage','eau','ecologique','sobriete','carbone']
      }[t]||[];
      if(c.some(x=>at.includes(norm(x))))h++;
    }
    return Math.min(1,h/pts.length);
  }
  function maturityFit(a,p){
    if(!p.maturity||p.maturity==='À préciser')return .6;
    const m=norm(p.maturity),t=norm([a.objective,...arr(a.projectsExpected),a.prerequisites,a.selectionCriteria].join(' '));
    const groups={
      faisabilite:['faisabilite','etude'],
      poc:['poc','preuve de concept','faisabilite'],
      prototype:['prototype','prototypage'],
      demonstrateur:['demonstrateur','pilote','demonstration'],
      industrialisation:['industrialisation','premiere usine','pre-industrialisation'],
      investissement:['investissement','deploiement','modernisation','production']
    };
    const key=Object.keys(groups).find(k=>m.includes(k));
    if(!key)return .6;
    return groups[key].some(x=>t.includes(norm(x)))?1:.3;
  }
  function validDate(v){return String(v||'').match(/^\d{4}-\d{2}-\d{2}/)?.[0]||null}
  function calendarFit(a,p){
    if(a.permanent)return 1;
    const ds=[...arr(a.deadlines).map(x=>typeof x==='string'?x:x?.date),a.finalClosingDate,a.closingDate].map(validDate).filter(Boolean);
    if(!ds.length)return .55;
    const now=new Date();now.setHours(0,0,0,0);
    const open=ds.filter(d=>new Date(d+'T23:59:59')>=now);
    if(!open.length)return 0;
    if(p.endDate){
      const pe=new Date(p.endDate+'T23:59:59');
      if(Number.isFinite(pe.getTime())&&open.every(d=>new Date(d+'T23:59:59')<now))return 0;
    }
    return 1;
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
    if(b>0&&hasTerms)return .8;
    if(hasTerms)return .7;
    return .5;
  }
  function territoryFit(a,p){
    if(a.scope==='NATIONAL')return 1;
    if(a.scope==='REGIONAL'&&p.region&&p.region!=='À préciser')return arr(a.regions).includes(p.region)?1:0;
    if(a.scope==='REGIONAL')return .5;
    return .35;
  }
  function beneficiaryFit(a,p){
    const cats=arr(a.companyCategories),cat=String(p.category||'');
    if(cat&&cat!=='À préciser'&&cats.length){
      if(cats.includes(cat)||(p.startup&&cats.includes('STARTUP')))return 1;
      return 0;
    }
    const aid=[a.beneficiaries,...cats,a.objective].join(' ');
    const project=[p.category,p.startup?'startup':'',p.sector,p.naf,p.company].join(' ');
    if(!aid.trim())return .55;
    return Math.max(.35,fit(aid,project));
  }
  function selectionFit(a,p){
    const atext=[a.selectionCriteria,a.prerequisites].filter(Boolean).join(' ');
    if(!atext)return{ratio:.5,matched:[]};
    const ptext=[p.summary,p.impacts,p.environment,p.digital,p.jobs,p.partners,p.maturity].join(' ');
    const d=overlapDetails(atext,ptext);
    return{ratio:d.ratio,matched:d.matched};
  }
  function relevance(a,p){
    const description=[p.name,p.summary,p.sector,p.naf,p.impacts,p.environment,p.digital,p.partners,...arr(p.types)].join(' ');
    const expenseQuery=[p.expenses,p.summary,p.name].join(' ');
    const objectiveText=[a.title,a.objective,...arr(a.themes),a.programme].join(' ');
    const expectedText=arr(a.projectsExpected).join(' ');
    const expenseText=String(a.eligibleExpenses||'');
    const dims=[];
    const add=(label,max,ratio,detail,matched=[])=>dims.push({label,max,score:Math.round(max*Math.max(0,Math.min(1,ratio))),ratio:Math.round(100*Math.max(0,Math.min(1,ratio))),detail,matched:arr(matched).slice(0,10)});

    const objective=overlapDetails(objectiveText,description);
    add('Objectifs & thématiques',22,objective.ratio,objective.ratio>=.72?'Concordance forte':objective.ratio>=.45?'Concordance significative':'Concordance faible',objective.matched);

    const expected=expectedText?overlapDetails(expectedText,description):{ratio:.5,matched:[]};
    add('Projets attendus',18,expected.ratio,expectedText?'Rapprochement avec les projets attendus':'Champ non documenté : pondération neutralisée',expected.matched);

    const expenses=expenseText?overlapDetails(expenseText,expenseQuery):{ratio:.5,matched:[]};
    add('Dépenses éligibles',15,expenses.ratio,expenseText?'Rapprochement des postes de dépenses':'Champ non documenté : pondération neutralisée',expenses.matched);

    const sel=selectionFit(a,p);
    add('Critères de sélection & prérequis',12,sel.ratio,(a.selectionCriteria||a.prerequisites)?'Critères rapprochés des impacts, travaux et maturité':'Critères non documentés : pondération neutralisée',sel.matched);

    const bf=beneficiaryFit(a,p);
    add('Bénéficiaires & secteur',10,bf,bf>=.8?'Profil entreprise cohérent':bf===0?'Profil incompatible':'Profil à confirmer');

    const tf=typeFit(a,p),mf=maturityFit(a,p);
    add('Typologie & maturité',8,.65*tf+.35*mf,tf>=.75?'Typologie bien couverte':'Typologie ou maturité à confirmer');

    const ff=financeFit(a,p);
    add('Budget & modalités financières',6,ff,ff>=.8?'Budget compatible avec les données disponibles':ff===0?'Budget hors assiette connue':'Modalités à sécuriser');

    const cf=calendarFit(a,p);
    add('Calendrier',5,cf,cf===1?'Fenêtre exploitable':cf===0?'Fenêtre non exploitable':'Calendrier à sécuriser');

    const tr=territoryFit(a,p);
    add('Territorialité',4,tr,tr===1?'Territoire compatible':tr===0?'Territoire incompatible':'Territoire à confirmer');

    return{score:dims.reduce((s,x)=>s+x.score,0),dims,checks:dims.length};
  }
  root.LEYTON_SCORING={relevance,tokens,norm,conceptSet,overlapDetails,typeFit,maturityFit,version:'12.4.0'};
})(typeof globalThis!=='undefined'?globalThis:this);
