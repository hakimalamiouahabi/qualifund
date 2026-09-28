import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const cfg=JSON.parse(await fs.readFile(path.join(ROOT,'config','sources.json'),'utf8'));
const problems=[];const seen=new Set();
const expectedRegions=['Auvergne-Rhône-Alpes','Bourgogne-Franche-Comté','Bretagne','Centre-Val de Loire','Corse','Grand Est','Hauts-de-France','Île-de-France','Normandie','Nouvelle-Aquitaine','Occitanie','Pays de la Loire',"Provence-Alpes-Côte d'Azur",'Guadeloupe','Guyane','Martinique','La Réunion','Mayotte'];
for(const s of cfg.sources||[]){
  if(!s.id||!s.name||!s.strategy) problems.push(`${s.id||'?'}: métadonnées minimales manquantes`);
  if(seen.has(s.id)) problems.push(`${s.id}: identifiant dupliqué`); seen.add(s.id);
  if(!s.url && !s.query) problems.push(`${s.id}: ni URL ni requête de découverte`);
  for(const [k,v] of Object.entries({url:s.url,api:s.api})) if(v && !/^https:\/\//i.test(v)) problems.push(`${s.id}: ${k} non HTTPS (${v})`);
}
const sources=cfg.sources||[];
if(sources.length<140) problems.push(`Couverture insuffisante: ${sources.length} sources (<140)`);
const scopes=new Set(sources.map(s=>s.scope));
for(const r of expectedRegions) if(!scopes.has(r)) problems.push(`Région absente du registre: ${r}`);
if(!scopes.has('France')) problems.push('Portée nationale absente du registre');
const official=sources.filter(s=>s.official).length;
const national=sources.filter(s=>s.scope==='France').length;
const regional=sources.length-national;
const reviewedRegions=expectedRegions.filter(r=>scopes.has(r)).length;
console.log(JSON.stringify({version:cfg.version,total:sources.length,official,national,regional,reviewedRegions,expectedRegions:expectedRegions.length,problems},null,2));
if(problems.length) process.exit(1);
