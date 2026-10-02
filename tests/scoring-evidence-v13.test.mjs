import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ctx={};ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../site/scoring-core.js',import.meta.url),'utf8'),ctx,{filename:'scoring-core.js'});
const score=ctx.LEYTON_SCORING.relevance;

const project={
  region:'Auvergne-Rhône-Alpes',category:'PME',startup:false,budget:500000,
  name:'Modernisation industrielle',summary:'Investissement industriel avec ligne de production automatisée et gains énergétiques.',
  sector:'industrie',naf:'25.62B',expenses:'machines équipements automatisation',
  impacts:'productivité réduction énergie',environment:'efficacité énergétique',
  digital:'automatisation',partners:'',types:['Investissement productif'],maturity:'Investissement / déploiement',jobs:'5'
};

const base={
  title:'Modernisation industrielle',scope:'REGIONAL',regions:['Auvergne-Rhône-Alpes'],
  companyCategories:['PME'],aidTypes:['SUBVENTION'],closingDate:'2099-12-31',
  objective:'Modernisation industrielle équipements automatisation efficacité énergétique'
};

test('une fiche mieux documentée obtient un rankingScore supérieur à un match sparse comparable',()=>{
  const sparse={...base};
  const complete={
    ...base,
    projectsExpected:['investissement productif modernisation ligne de production'],
    eligibleExpenses:'machines équipements automatisation',
    prerequisites:'PME implantée en Auvergne-Rhône-Alpes',
    selectionCriteria:'productivité performance énergétique emplois',
    beneficiaries:'PME industrielles',
    aidRate:{min:20,max:30},
    minimumProjectCost:100000
  };
  const s=score(sparse,project),c=score(complete,project);
  assert.ok(s.score>=0);
  assert.ok(c.coverageFactor>s.coverageFactor);
  assert.ok(c.rankingScore>s.rankingScore);
  assert.ok(s.rankingScore<=s.score);
  assert.equal(ctx.LEYTON_SCORING.version,'13.0.0');
});

test('la couverture de preuve est un facteur de classement et non une inéligibilité',()=>{
  const r=score(base,project);
  assert.ok(r.coverageFactor>0&&r.coverageFactor<100);
  assert.ok(Number.isFinite(r.score));
  assert.ok(Number.isFinite(r.rankingScore));
});

test('le front ne rejette pas automatiquement un AAP faute de forme financière structurée',()=>{
  const app=fs.readFileSync(new URL('../site/app.js',import.meta.url),'utf8');
  assert.match(app,/isCall=a\.kind==='AAP \/ AMI'\|\|types\.includes\('APPEL_A_PROJET'\)/);
  assert.match(app,/forme financière à confirmer/);
  assert.match(app,/evidenceCoverage>=\.55/);
  assert.match(app,/rankingScore/);
});
