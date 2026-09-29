import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const node=()=>({classList:{add(){},remove(){},toggle(){}},style:{},addEventListener(){},setAttribute(){},textContent:'',value:'',innerHTML:''});
const context={console,URL,URLSearchParams,setTimeout,clearTimeout,performance,localStorage:{getItem(){return null},setItem(){}},location:{protocol:'https:',search:''},document:{querySelector:()=>node(),querySelectorAll:()=>[],createElement:()=>node(),addEventListener(){}}};
context.window=context;context.globalThis=context;
vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('../site/scoring-core.js',import.meta.url),'utf8'),context);
vm.runInContext(fs.readFileSync(new URL('../site/app.js',import.meta.url),'utf8').split('loadAll().then(')[0],context);
const aid={id:'test',title:'Recherche innovation',aidTypes:['SUBVENTION'],scope:'REGIONAL',regions:[],companyCategories:['PME'],closingDate:'2099-12-31',objective:'Projets de recherche industrielle',prerequisites:'Projet collaboratif ou individuel',eligibleExpenses:'Dépenses de personnel de recherche'};
const project={category:'PME',region:'Île-de-France',sector:'logiciel',naf:'62.01Z',summary:'',types:[],partners:'aucun partenaire'};
test('une région absente et un consortium optionnel ne bloquent pas',()=>{
 const result=context.eligibility(aid,project);assert.equal(result.eligible,true);assert.equal(result.status,'À VÉRIFIER');assert.equal(result.criteria.find(x=>x.label==='Territoire').status,'À VÉRIFIER');
});
test('une exclusion lexicale potentielle reste à vérifier',()=>{
 const result=context.eligibility({...aid,prerequisites:'Sont exclus les achats de logiciel standard.'},project);assert.equal(result.eligible,true);
});
test('prospection NAF autorisée sans description',()=>assert.equal(context.validateProjectForStudy({naf:'62.01Z'}).length,0));
test('dépenses, budget, maturité absents neutralisés',()=>{
 const out=context.LEYTON_SCORING.relevance(aid,project);for(const key of ['expenses','finance','maturity'])assert.equal(out.dims.find(d=>d.key===key).documented,false);
});
test('IA ne correspond pas à une sous-chaîne dans social',()=>assert.equal(context.LEYTON_SCORING.conceptSet('innovation sociale').includes('ai'),false));
test('recherche mots indépendants, accents, pluriels et alias BPI',()=>assert.equal(context.matchesSearch({title:'Aide pour le développement de l’innovation',funder:['Bpifrance']},'bpi innovation développement'),true));
test('une fiche territoriale innovation n’est pas attribuée à Bpifrance',()=>assert.equal(context.LEYTON_SCORING.detectFamily({title:'Aide aux projets d’innovation',funder:['CC des Montagnes du Giffre'],scope:'REGIONAL'}),'REGIONAL'));
test('catégories non exhaustives ne suffisent pas à exclure',()=>assert.equal(context.eligibility({...aid,companyCategories:['PME']},{...project,category:'ETI'}).eligible,true));
test('une contradiction territoriale sans preuve officielle reste à vérifier',()=>{const r=context.eligibility({...aid,regions:['Bretagne']},project);assert.equal(r.eligible,true);assert.equal(r.criteria.find(x=>x.label==='Territoire').status,'À VÉRIFIER')});
test('les cartes de résultats sont rendues sans fonction manquante',()=>{
 const result={a:aid,elig:context.eligibility(aid,project),relevance:context.LEYTON_SCORING.relevance(aid,project)};
 assert.match(context.resultCard(result,1),/Conditions à confirmer/);
});
