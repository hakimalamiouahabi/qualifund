import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const core=await fs.readFile(path.join(ROOT,'site','scoring-core.js'),'utf8');
const ctx={};ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(core,ctx,{filename:'scoring-core.js'});
const score=ctx.LEYTON_SCORING?.relevance;if(typeof score!=='function')throw new Error('Moteur partagé de pertinence indisponible');

const CASES=[
  {
    id:'innovation-ai-poc',name:'R&D / IA — prototype et PoC',min:75,
    project:{region:'Île-de-France',budget:750000,name:'Prototype IA industriel',summary:'Développer un prototype innovant de logiciel IA et machine learning avec travaux de recherche et démonstrateur.',sector:'logiciel intelligence artificielle',naf:'62.01Z',expenses:'personnel R&D prototype logiciel cloud data sous-traitance recherche',impacts:'innovation technologique brevet performance industrielle',environment:'',digital:'IA machine learning logiciel data cloud',partners:'laboratoire recherche',types:['R&D / Innovation','Transition numérique'],maturity:'Prototype',jobs:'ingénieurs R&D'},
    aid:{scope:'NATIONAL',regions:['Toutes les Régions'],aidTypes:['SUBVENTION'],aidRate:{min:25,max:50},minimumProjectCost:100000,maximumProjectCost:2000000,closingDate:'2027-12-31',title:'Soutien aux projets de R&D et innovation numérique IA',objective:'Financer recherche innovation prototype démonstrateur intelligence artificielle logiciel data cloud',themes:['innovation','numérique','IA'],projectsExpected:['projets de R&D prototype PoC démonstrateur logiciel IA'],eligibleExpenses:'personnel R&D prototype logiciel cloud data sous-traitance recherche',selectionCriteria:'innovation technologique qualité du démonstrateur impacts emplois',beneficiaries:'PME innovantes logiciel numérique',prerequisites:'prototype et travaux de R&D'}
  },
  {
    id:'industrialisation',name:'Investissement productif — industrialisation',min:75,
    project:{region:'Grand Est',budget:1800000,name:'Nouvelle ligne de production',summary:'Industrialiser un produit en installant une nouvelle ligne de production et des machines automatisées.',sector:'industrie manufacturière production',naf:'25.62B',expenses:'machines équipements ligne de production automatisation bâtiment industriel',impacts:'augmentation capacité production emplois productivité',environment:'',digital:'automatisation robotisation',partners:'intégrateur industriel',types:['Investissement productif'],maturity:'Investissement / déploiement',jobs:'20 emplois'},
    aid:{scope:'NATIONAL',regions:['Toutes les Régions'],aidTypes:['SUBVENTION'],aidRate:{min:20,max:40},minimumProjectCost:250000,maximumProjectCost:5000000,closingDate:'2027-12-31',title:'Aide à l’investissement productif et à l’industrialisation',objective:'Soutenir industrialisation usine production équipements machines capacité et modernisation',themes:['industrialisation','industrie'],projectsExpected:['investissement productif déploiement ligne de production machines équipements'],eligibleExpenses:'machines équipements ligne de production automatisation bâtiment industriel',selectionCriteria:'capacité de production productivité emplois investissement',beneficiaries:'PME ETI industrielles',prerequisites:'projet d investissement et déploiement production'}
  },
  {
    id:'cyber-digital',name:'Transformation numérique / cybersécurité',min:75,
    project:{region:'Île-de-France',budget:400000,name:'Programme cyber et cloud',summary:'Déployer une plateforme cloud sécurisée, cybersécurité, automatisation et logiciel SaaS pour digitaliser les processus.',sector:'services numériques cybersécurité',naf:'62.02A',expenses:'logiciels cloud cybersécurité audit sécurité automatisation intégration',impacts:'résilience cyber productivité transformation numérique',environment:'',digital:'cloud SaaS cybersécurité sécurité informatique automatisation logiciel',partners:'prestataire cyber',types:['Transition numérique'],maturity:'Investissement / déploiement',jobs:'experts cyber'},
    aid:{scope:'NATIONAL',regions:['Toutes les Régions'],aidTypes:['SUBVENTION'],aidRate:{min:20,max:50},minimumProjectCost:50000,maximumProjectCost:1000000,closingDate:'2027-12-31',title:'Transformation numérique et cybersécurité des PME',objective:'Accompagner numérique digital logiciel cloud automatisation cybersécurité sécurité informatique',themes:['numérique','cyber'],projectsExpected:['déploiement logiciel SaaS cloud cyber automatisation'],eligibleExpenses:'logiciels cloud cybersécurité audit sécurité automatisation intégration',selectionCriteria:'maturité numérique résilience cybersécurité productivité',beneficiaries:'PME du secteur privé',prerequisites:'projet de déploiement numérique'}
  },
  {
    id:'decarbonation-energy',name:'Décarbonation / efficacité énergétique',min:75,
    project:{region:'Hauts-de-France',budget:2500000,name:'Décarbonation du site industriel',summary:'Réduire les émissions CO2 par efficacité énergétique, récupération de chaleur et électrification des procédés.',sector:'industrie énergie',naf:'20.14Z',expenses:'équipements efficacité énergétique récupération chaleur électrification études énergie',impacts:'réduction carbone CO2 énergie émissions gaz à effet de serre',environment:'décarbonation carbone CO2 sobriété énergétique chaleur',digital:'',partners:'bureau études énergie',types:['Transition écologique','Investissement productif'],maturity:'Investissement / déploiement',jobs:'maintien emplois industriels'},
    aid:{scope:'NATIONAL',regions:['Toutes les Régions'],aidTypes:['SUBVENTION'],aidRate:{min:20,max:60},minimumProjectCost:500000,maximumProjectCost:10000000,closingDate:'2027-12-31',title:'Décarbonation et efficacité énergétique de l’industrie',objective:'Financer décarbonation carbone CO2 énergie efficacité énergétique chaleur électrification équipements industriels',themes:['décarbonation','énergie'],projectsExpected:['investissements de décarbonation équipements efficacité énergétique récupération chaleur'],eligibleExpenses:'équipements efficacité énergétique récupération chaleur électrification études énergie',selectionCriteria:'tonnes CO2 évitées économies énergie impact carbone',beneficiaries:'PME ETI industrielles',prerequisites:'investissement de déploiement énergétique'}
  },
  {
    id:'circular-water',name:'Économie circulaire / eau',min:75,
    project:{region:'Occitanie',budget:900000,name:'Boucle de réemploi eau et matières',summary:'Créer une boucle d économie circulaire avec recyclage, réemploi de matières et réutilisation de l eau industrielle.',sector:'industrie recyclage environnement',naf:'38.32Z',expenses:'équipements recyclage réemploi traitement eau réutilisation effluents écoconception',impacts:'réduction déchets matières vierges consommation eau économie circulaire',environment:'recyclage réemploi écoconception eau hydrique effluents',digital:'',partners:'filière recyclage',types:['Transition écologique'],maturity:'Démonstrateur / pilote',jobs:'emplois économie circulaire'},
    aid:{scope:'NATIONAL',regions:['Toutes les Régions'],aidTypes:['SUBVENTION'],aidRate:{min:20,max:50},minimumProjectCost:100000,maximumProjectCost:3000000,closingDate:'2027-12-31',title:'Économie circulaire, recyclage et réutilisation de l’eau',objective:'Soutenir économie circulaire recyclage réemploi matière recyclée écoconception eau réutilisation effluents',themes:['économie circulaire','eau'],projectsExpected:['pilote démonstrateur recyclage réemploi réutilisation eau'],eligibleExpenses:'équipements recyclage réemploi traitement eau réutilisation effluents écoconception',selectionCriteria:'réduction déchets économie de matière réduction consommation eau impacts environnementaux',beneficiaries:'entreprises industrielles',prerequisites:'démonstrateur pilote environnemental'}
  }
];

const NEGATIVE_CASES=[
  {
    id:'negative-culture-vs-ai',name:'Contrôle négatif — culture vs IA industrielle',max:45,project:CASES[0].project,
    aid:{scope:'REGIONAL',regions:['Bretagne'],aidTypes:['SUBVENTION'],minimumProjectCost:1000,maximumProjectCost:100000,closingDate:'2027-12-31',
      title:'Soutien aux festivals et manifestations culturelles',objective:'Soutenir les festivals, expositions, spectacles, patrimoine et diffusion artistique',
      themes:['culture','patrimoine','spectacle'],projectsExpected:['festival exposition programmation artistique'],
      eligibleExpenses:'cachets artistiques diffusion communication culturelle',selectionCriteria:'rayonnement culturel fréquentation des publics qualité artistique',
      beneficiaries:'associations culturelles et collectivités',prerequisites:'porter une manifestation culturelle ouverte au public'}
  },
  {
    id:'negative-agri-vs-cyber',name:'Contrôle négatif — agriculture vs cybersécurité',max:45,project:CASES[2].project,
    aid:{scope:'REGIONAL',regions:['Nouvelle-Aquitaine'],aidTypes:['SUBVENTION'],minimumProjectCost:5000,maximumProjectCost:150000,closingDate:'2027-12-31',
      title:'Modernisation des exploitations agricoles',objective:'Soutenir élevage agriculture bâtiments agricoles matériel de production végétale',
      themes:['agriculture','élevage'],projectsExpected:['investissement exploitation agricole matériel élevage'],
      eligibleExpenses:'tracteurs équipements élevage bâtiments agricoles',selectionCriteria:'performance agricole installation exploitant',
      beneficiaries:'agriculteurs exploitants agricoles',prerequisites:'être exploitant agricole'}
  },
  {
    id:'negative-tourism-vs-carbon',name:'Contrôle négatif — tourisme vs décarbonation industrielle',max:45,project:CASES[3].project,
    aid:{scope:'REGIONAL',regions:['Corse'],aidTypes:['SUBVENTION'],minimumProjectCost:10000,maximumProjectCost:200000,closingDate:'2027-12-31',
      title:'Développement de l’offre touristique et culturelle',objective:'Améliorer hébergements touristiques accueil visiteurs patrimoine et loisirs',
      themes:['tourisme','culture'],projectsExpected:['hébergement touristique animation loisirs visiteurs'],
      eligibleExpenses:'aménagement chambres accueil signalétique touristique',selectionCriteria:'attractivité touristique fréquentation saisonnalité',
      beneficiaries:'opérateurs touristiques associations',prerequisites:'projet implanté en Corse'}
  }
];

const SPARSE_CASE={
  id:'sparse-evidence-guard',name:'Garde-fou — aide très peu documentée',project:CASES[0].project,
  aid:{scope:'NATIONAL',regions:['Toutes les Régions'],aidTypes:['SUBVENTION'],closingDate:'2027-12-31',
    title:'Innovation IA',objective:'Soutenir innovation intelligence artificielle prototype logiciel'}
};

const positiveResults=CASES.map(c=>{const r=score(c.aid,c.project);return{id:c.id,name:c.name,type:'positive',score:r.score,min:c.min,pass:r.score>=c.min,documentedWeight:r.documentedWeight,dims:r.dims};});
const negativeResults=NEGATIVE_CASES.map(c=>{const r=score(c.aid,c.project);return{id:c.id,name:c.name,type:'negative',score:r.score,max:c.max,pass:r.score<=c.max,documentedWeight:r.documentedWeight,dims:r.dims};});
const sparse=score(SPARSE_CASE.aid,SPARSE_CASE.project);
const sparseStrong=(sparse.dims||[]).filter(d=>d.documented&&(d.ratio??0)>=65).length;
const sparseGuard={id:SPARSE_CASE.id,name:SPARSE_CASE.name,type:'evidence-guard',score:sparse.score,documentedWeight:sparse.documentedWeight,strongDimensions:sparseStrong,pass:sparse.documentedWeight<5,dims:sparse.dims};
const results=[...positiveResults,...negativeResults,sparseGuard];
const passed=results.filter(x=>x.pass).length;
const positivePassed=positiveResults.filter(x=>x.pass).length;
const negativePassed=negativeResults.filter(x=>x.pass).length;
const positiveFloor=Math.min(...positiveResults.map(x=>x.score));
const negativeCeiling=Math.max(...negativeResults.map(x=>x.score));
const separation=positiveFloor-negativeCeiling;
const separationPass=separation>=20;
const output={
  version:ctx.LEYTON_SCORING.version,
  generatedAt:new Date().toISOString(),
  engineVersion:ctx.LEYTON_SCORING.version,
  total:results.length+1,
  passed:passed+(separationPass?1:0),
  positive:{total:positiveResults.length,passed:positivePassed,minScore:positiveFloor},
  negative:{total:negativeResults.length,passed:negativePassed,maxScore:negativeCeiling},
  sparseEvidenceGuard:{pass:sparseGuard.pass,documentedWeight:sparseGuard.documentedWeight,score:sparseGuard.score},
  separation:{points:separation,minRequired:20,pass:separationPass},
  threshold:'tests positifs, contrôles négatifs, séparation des scores et garde-fou documentaire',
  results
};
await fs.mkdir(path.join(ROOT,'site','data'),{recursive:true});
await fs.writeFile(path.join(ROOT,'site','data','uat-results.json'),JSON.stringify(output,null,2),'utf8');
console.log(JSON.stringify(output,null,2));
if(passed!==results.length||!separationPass)process.exitCode=1;
