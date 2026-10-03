import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson } from './lib/utils.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const schema=await readJson(path.join(root,'schemas/aap.schema.json'));
const lib=await readJson(path.join(root,'site/data/library.json'),{aaps:[]});
const cov=await readJson(path.join(root,'site/data/coverage.json'),[]);

function basicValidate(a){
  const errors=[];
  const required=['id','title','scope','regions','aidTypes','companyCategories','verification'];
  for(const k of required) if(a?.[k]===undefined||a?.[k]===null) errors.push(`${k}: required`);
  if(typeof a?.id!=='string'||!a.id.trim()) errors.push('id: non-empty string required');
  if(typeof a?.title!=='string'||!a.title.trim()) errors.push('title: non-empty string required');
  if(!['NATIONAL','REGIONAL'].includes(a?.scope)) errors.push('scope: invalid enum');
  if(!Array.isArray(a?.regions)||a.regions.some(x=>typeof x!=='string')) errors.push('regions: string[] required');
  const aidTypes=new Set(['SUBVENTION','AVANCE_REMBOURSABLE','PRET_TAUX_ZERO','PRET','BONIFICATION_INTERET','GARANTIE','ALLEGEMENT_FISCAL','PARTICIPATION_CAPITAL','APPEL_A_PROJET','ACCOMPAGNEMENT_GRATUIT','CREDIT_BAIL','AUTRE']);
  if(!Array.isArray(a?.aidTypes)||a.aidTypes.some(x=>!aidTypes.has(x))) errors.push('aidTypes: invalid enum');
  const cats=new Set(['STARTUP','PME','ETI','GE']);
  if(!Array.isArray(a?.companyCategories)||a.companyCategories.some(x=>!cats.has(x))) errors.push('companyCategories: invalid enum');
  if(!a?.verification||typeof a.verification!=='object'||!['VERIFIE','A_REVERIFIER'].includes(a.verification.status)) errors.push('verification.status: invalid enum');
  for(const k of ['themes','projectsExpected','deadlines','attentionPoints','cdcLinks','sourceLinks','regulationLinks','formLinks','funder']) if(a?.[k]!==undefined&&!Array.isArray(a[k])) errors.push(`${k}: array required`);
  for(const k of ['minimumProjectCost','maximumProjectCost']) if(a?.[k]!==undefined&&a[k]!==null&&typeof a[k]!=='number') errors.push(`${k}: number|null required`);
  return errors;
}

let validate=null, engine='BASIC_FALLBACK';
try{
  const {default:Ajv2020}=await import('ajv/dist/2020.js');
  const ajv=new Ajv2020({allErrors:true,strict:false});
  validate=ajv.compile(schema);
  engine='AJV';
}catch(e){
  console.warn(`WARN validation AJV indisponible (${e.code||e.message}); fallback structurel local activé.`);
}

let bad=0;
for(const a of lib.aaps||[]){
  const errors=validate?(validate(a)?[]:(validate.errors||[]).slice(0,5)):basicValidate(a);
  if(errors.length){bad++;console.error(a.id,a.title,errors)}
}
if(bad) throw new Error(`${bad} fiche(s) invalides`);
if(!(lib.aaps||[]).length) throw new Error('Aucune fiche directe disponible');
if(cov.length&&cov.filter(x=>x.success).length===0) throw new Error('Aucune source saine');
const cycleLabel=cov.length?`${cov.filter(x=>x.success).length}/${cov.length} sources saines`:'cycle sources non exécuté';
console.log(`OK ${(lib.aaps||[]).length} fiches, ${cycleLabel} — moteur ${engine}`);

