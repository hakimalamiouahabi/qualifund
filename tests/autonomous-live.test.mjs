import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('aucun import stock ni rafraîchissement tiers dans le navigateur',()=>{
 const app=fs.readFileSync(new URL('../site/app.js',import.meta.url),'utf8');
 const html=fs.readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
 for(const name of ['refreshAidesTerritoiresClient','refreshAidesEntreprisesClient','importOfficialStockFile'])assert.ok(!app.includes(name));
 assert.doesNotMatch(html,/importStockInput/);
 assert.match(app,/DIRECT_OFFICIAL_ONLY/);
 assert.match(app,/async function loadClientLibrary\(\)\{return false\}/);
});
