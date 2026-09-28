import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const cfg=JSON.parse(fs.readFileSync(new URL('../config/sources.json',import.meta.url),'utf8'));
const regions=['Auvergne-Rhône-Alpes','Bourgogne-Franche-Comté','Bretagne','Centre-Val de Loire','Corse','Grand Est','Hauts-de-France','Île-de-France','Normandie','Nouvelle-Aquitaine','Occitanie','Pays de la Loire',"Provence-Alpes-Côte d'Azur",'Guadeloupe','Guyane','Martinique','La Réunion','Mayotte'];
test('les 18 régions sont présentes dans le registre',()=>{const scopes=new Set(cfg.sources.map(s=>s.scope));for(const r of regions)assert.ok(scopes.has(r),r)});
test('les identifiants de sources sont uniques',()=>{const ids=cfg.sources.map(s=>s.id);assert.equal(new Set(ids).size,ids.length)});
test('la couverture nationale est présente',()=>assert.ok(cfg.sources.some(s=>s.scope==='France')));
