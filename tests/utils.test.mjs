import test from 'node:test';import assert from 'node:assert/strict';import {detectDates,detectRates,normalizeAidTypes,normalizeCompanyCategories} from '../scripts/lib/utils.mjs';
test('dates françaises',()=>assert.deepEqual(detectDates('Relève le 15 novembre 2026 puis le 15 janvier 2027'),['2026-11-15','2027-01-15']));
test('taux',()=>assert.deepEqual(detectRates('PME 45 %, ETI 35%'),[45,35]));
test('instruments',()=>assert.deepEqual(normalizeAidTypes('subvention et avance remboursable'),['SUBVENTION','AVANCE_REMBOURSABLE']));
test('catégories',()=>assert.deepEqual(normalizeCompanyCategories('PME, ETI et grandes entreprises'),['PME','ETI','GE']));
