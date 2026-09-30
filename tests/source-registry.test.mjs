import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const cfg=JSON.parse(fs.readFileSync(new URL('../config/sources.json',import.meta.url)));
test('registre limité aux sources directes de guichet ou de région',()=>{assert.equal(cfg.sourcePolicy,'DIRECT_OFFICIAL_ONLY');assert.equal(cfg.sourceSelectionPolicy,'GUICHET_OR_REGION_OFFICIAL_ONLY');assert.ok(cfg.sources.length>0);assert.ok(!cfg.sources.some(s=>s.id==='aides_entreprises'));assert.ok(!cfg.sources.some(s=>s.id==='europe_france'));});
test('la grande majorité des sources sont officielles',()=>{const s=cfg.sources||[],n=s.filter(x=>x.official).length;assert.ok(n/s.length>=.95)});



test('le registre courant ne contient ni doublon URL ni contrôle superflu retiré',()=>{
 const normalize=raw=>{const u=new URL(raw);u.hash='';u.pathname=u.pathname.replace(/\/+$/,'')||'/';return u.href.replace(/\/$/,'')};
 const seen=new Map();
 for(const src of cfg.sources){
   const key=normalize(src.url);
   assert.equal(seen.has(key),false,`URL source dupliquée: ${key}`);
   seen.set(key,src.id);
 }
 const removed=['aura_reglementation','bretagne_opendata','cvl_depot','cvl_opendata','corse_opendata','hdf_depot','idf_depot','idf_europe_resources','idf_actes','reunion_opendata','martinique_europe_beneficiaires','normandie_europe_suivi','normandie_adn','nouvelle_aquitaine_beneficiaires_europe','occitanie_dataset_aides','pdl_opendata_interventions','pdl_open_data_portal'];
 for(const id of removed)assert.equal(cfg.sources.some(x=>x.id===id),false,id);
});

test('aucun agrégateur national généraliste n’est présent dans les URLs du registre',()=>{
 const forbidden=/(?:aides-entreprises\.fr|aides-territoires\.beta\.gouv\.fr|data\.gouv\.fr|service-public\.gouv\.fr|mes-aides\.gouv\.fr|les-aides\.fr|aides\.gouv\.fr)/i;
 for(const src of cfg.sources)assert.doesNotMatch(src.url,forbidden,src.id);
});
