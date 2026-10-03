import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const core=fs.readFileSync(new URL('../site/scoring-core.js',import.meta.url),'utf8');
const ctx={};ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(core,ctx);
const relevance=ctx.FUNDING_RADAR_SCORING.relevance;

test('la description détaillée du projet influence directement le classement des AAP',()=>{
  const project={
    region:'Île-de-France',category:'PME',startup:false,budget:800000,
    name:'Prototype IA industriel',
    summary:'Développement d’un prototype logiciel d’intelligence artificielle avec travaux de R&D, données et démonstrateur industriel.',
    sector:'logiciel intelligence artificielle',
    expenses:'personnel R&D logiciel cloud données sous-traitance',
    impacts:'innovation technologique et productivité',
    digital:'IA machine learning cloud data',
    environment:'',partners:'laboratoire',types:['R&D / Innovation','Transition numérique'],maturity:'Prototype'
  };
  const common={scope:'NATIONAL',regions:['Toutes les Régions'],aidTypes:['SUBVENTION'],aidRate:{min:20,max:50},minimumProjectCost:100000,maximumProjectCost:2000000,closingDate:'2027-12-31',companyCategories:['PME'],beneficiaries:'PME'};
  const matched={...common,title:'Projets de R&D en intelligence artificielle',objective:'Recherche innovation prototype démonstrateur IA logiciel data cloud',themes:['innovation','numérique','IA'],projectsExpected:['prototype et démonstrateur logiciel IA'],eligibleExpenses:'personnel R&D logiciel cloud données',prerequisites:'travaux de R&D'};
  const unrelated={...common,title:'Aide au tourisme et hébergement',objective:'Modernisation des hébergements touristiques et hôteliers',themes:['tourisme'],projectsExpected:['rénovation hôtelière'],eligibleExpenses:'travaux immobiliers hébergement',prerequisites:'activité touristique'};
  assert.ok(relevance(matched,project).score>relevance(unrelated,project).score+20);
  assert.ok(relevance(matched,project).score>=75);
});


test('l’analyse reste exploitable sans description détaillée grâce à l’activité, au NAF et aux thématiques',()=>{
  const project={
    region:'Île-de-France',category:'PME',startup:false,budget:0,
    name:'',summary:'',sector:'édition de logiciels et intelligence artificielle',naf:'62.01Z',
    expenses:'',impacts:'',digital:'',environment:'',partners:'',
    types:['R&D / Innovation','Transition numérique'],maturity:'À préciser'
  };
  const aid={
    scope:'NATIONAL',regions:['Toutes les Régions'],aidTypes:['AVANCE_REMBOURSABLE'],
    title:'Aide au développement de l’innovation',
    objective:'Soutenir les projets de recherche développement innovation, logiciels, données et technologies numériques',
    themes:['R&D / Innovation','Transition numérique'],
    projectsExpected:['développement de produits procédés ou services innovants'],
    beneficiaries:'PME et entreprises innovantes',companyCategories:['PME'],
    prerequisites:'projet de recherche industrielle ou développement expérimental',
    closingDate:'2027-12-31'
  };
  const out=relevance(aid,project);
  assert.equal(out.basis,'activité / NAF / thématiques');
  assert.ok(out.score>=55);
});
