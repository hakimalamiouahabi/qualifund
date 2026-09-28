import test from 'node:test';import assert from 'node:assert/strict';import {qaAid} from '../scripts/lib/qa.mjs';
test('date absente signalée',()=>{const f=qaAid({title:'x',officialPage:'https://x',objective:'o',beneficiaries:'b',aidTypes:['SUBVENTION'],companyCategories:['PME'],eligibleExpenses:'e',prerequisites:'p',cdcLinks:[],permanent:false});assert.ok(f.includes('MISSING_DEADLINE'));});
