import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../site/app.js',import.meta.url),'utf8');
const match=source.match(/function eligibility\(a,p\)\{[\s\S]*?\n\}\nfunction relevance/);
assert.ok(match,'moteur d’éligibilité présent');
const context={
  arr:x=>Array.isArray(x)?x:[],
  REGIONS:['Île-de-France','Bretagne'],
  nextDeadline:()=>({ok:false,reason:'DATE_MISSING'}),
  explicitExclusion:()=>null,
  specializedMismatch:()=>null,
  fmtDate:x=>x,
  money:x=>String(x)
};
vm.createContext(context);
vm.runInContext(match[0].replace(/\nfunction relevance$/,''),context);
const project={category:'PME',region:'Île-de-France',budget:100000,sector:'industrie'};
const aid={aidTypes:['SUBVENTION'],companyCategories:['ETI'],scope:'REGIONAL',regions:['Bretagne'],minimumProjectCost:200000,lifecycleStatus:'ACTIVE',selectionCriteria:'Impact industriel'};

test('une catégorie, région et assiette sans preuve restent à vérifier',()=>{
  const result=context.eligibility(aid,project);
  assert.equal(result.eligible,true);
  assert.equal(result.status,'À VÉRIFIER');
  for(const label of ['Taille entreprise','Territoire','Budget','Critères de sélection'])
    assert.equal(result.criteria.find(c=>c.label===label)?.status,'À VÉRIFIER');
});

test('une incompatibilité documentée par preuve A/B est bloquante',()=>{
  const documented={...aid,verification:{fieldEvidence:[
    {field:'beneficiaries',sourceTier:'A',sourceUrl:'https://example.gouv.fr/reglement.pdf',evidenceText:'Entreprises de taille intermédiaire situées en Bretagne'},
    {field:'financialTerms',sourceTier:'B',sourceUrl:'https://example.gouv.fr/aide',evidenceText:'Assiette minimale de 200 000 euros'}
  ]}};
  const result=context.eligibility(documented,project);
  assert.equal(result.eligible,false);
  assert.equal(result.status,'NON CONFORME');
  assert.equal(result.criteria.find(c=>c.label==='Taille entreprise')?.status,'NON CONFORME');
  assert.equal(result.criteria.find(c=>c.label==='Budget')?.status,'NON CONFORME');
  assert.equal(result.criteria.find(c=>c.label==='Critères de sélection')?.status,'À VÉRIFIER');
});

test('une taille ou région non renseignée ne déclenche pas une exclusion',()=>{
  const documented={...aid,verification:{fieldEvidence:[
    {field:'beneficiaries',sourceTier:'A',sourceUrl:'https://example.gouv.fr/reglement.pdf',evidenceText:'ETI en Bretagne'}
  ]}};
  const result=context.eligibility(documented,{...project,category:'À préciser',region:'À préciser'});
  assert.equal(result.eligible,true);
  assert.equal(result.criteria.find(c=>c.label==='Taille entreprise')?.status,'À VÉRIFIER');
  assert.equal(result.criteria.find(c=>c.label==='Territoire')?.status,'À VÉRIFIER');
});
