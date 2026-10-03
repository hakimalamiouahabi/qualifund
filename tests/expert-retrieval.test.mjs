import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code=fs.readFileSync(new URL('../site/scoring-core.js',import.meta.url),'utf8');
const ctx={};ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(code,ctx);
const {bm25fRank,relevance}=ctx.FUNDING_RADAR_SCORING;

test('BM25F classe un dispositif innovation IA devant un dispositif touristique sans rapport',()=>{
  const p={name:'Prototype IA industriel',summary:'Développer un prototype logiciel d intelligence artificielle, R&D, données et démonstrateur',sector:'logiciel',naf:'6201Z',types:['R&D / Innovation','Transition numérique'],digital:'IA data cloud',environment:'',impacts:'innovation productivité',expenses:'personnel R&D logiciel cloud',maturity:'Prototype',partners:''};
  const aids=[
    {id:'ia',title:'Projets d innovation en intelligence artificielle',themes:['R&D / Innovation','Transition numérique'],objective:'recherche développement prototype démonstrateur IA',projectsExpected:['prototype logiciel IA'],selectionCriteria:'innovation technologique',eligibleExpenses:'personnel R&D logiciel cloud',prerequisites:'PME innovante',beneficiaries:'PME',companyCategories:['PME'],regions:['Toutes les Régions'],scope:'NATIONAL'},
    {id:'tourisme',title:'Aide à la rénovation des hébergements touristiques',themes:['Tourisme'],objective:'moderniser hôtels et hébergements',projectsExpected:['rénovation immobilière'],selectionCriteria:'qualité touristique',eligibleExpenses:'travaux bâtiment',prerequisites:'activité touristique',beneficiaries:'PME tourisme',companyCategories:['PME'],regions:['Toutes les Régions'],scope:'NATIONAL'}
  ];
  const rank=bm25fRank(aids,p);
  assert.ok(rank.get('ia')>rank.get('tourisme'));
});

test('l activité et le code NAF suffisent à alimenter le moteur lorsque la description projet est absente',()=>{
  const p={name:'',summary:'',sector:'édition de logiciels et services numériques',naf:'6201Z',types:['Transition numérique'],digital:'',environment:'',impacts:'',expenses:'',maturity:'À préciser',partners:'',category:'PME',region:'Île-de-France'};
  const a={id:'num',title:'Soutien à la transformation numérique',themes:['Transition numérique'],objective:'logiciel data cloud transformation numérique',projectsExpected:[],selectionCriteria:null,eligibleExpenses:null,prerequisites:null,beneficiaries:'PME',companyCategories:['PME'],regions:['Toutes les Régions'],scope:'NATIONAL',aidTypes:['SUBVENTION']};
  const out=relevance(a,p);
  assert.equal(out.basis,'activité / NAF / thématiques');
  assert.ok(out.score>0);
});
