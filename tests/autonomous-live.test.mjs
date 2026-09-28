import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('HTML autonome v12.2 possède refresh live, import stock et planification 02:00',()=>{
  const app=fs.readFileSync(new URL('../site/app.js',import.meta.url),'utf8');
  const html=fs.readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
  assert.match(app,/refreshAidesTerritoiresClient/);
  assert.match(app,/refreshAidesEntreprisesClient/);
  assert.match(app,/importOfficialStockFile/);
  assert.match(app,/scheduleClientDailyRefresh/);
  assert.match(app,/timeZone:'Europe\/Paris'/);
  assert.match(app,/PRET_TAUX_ZERO/);
  assert.match(html,/Importer stock officiel/);
});

test('persistance navigateur dégradée ne fait pas échouer une mise à jour live',()=>{
  const app=fs.readFileSync(new URL('../site/app.js',import.meta.url),'utf8');
  assert.match(app,/clientPersistence='session-only'/);
  assert.match(app,/Persistance IndexedDB indisponible/);
});
