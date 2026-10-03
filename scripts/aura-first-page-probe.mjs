import {browserHtml} from './scripts/lib/browser.mjs';
import {parseAuraEnterpriseListingHtml} from './scripts/connectors/aura.mjs';
const url='https://www.auvergnerhonealpes.fr/aides?f%5B0%5D=profil%3A3&page=0';
const r=await browserHtml(url,{timeoutMs:45000,waitForSelector:'article.node--type-aid.node--view-mode-search-result',waitAfterMs:1200});
const p=parseAuraEnterpriseListingHtml(r.html,r.url||url);
console.log(JSON.stringify({finalUrl:r.url,title:r.title,expectedCount:p.expectedCount,cards:p.items.length,samples:p.items.slice(0,12)},null,2));
