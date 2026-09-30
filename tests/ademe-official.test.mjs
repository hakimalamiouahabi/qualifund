import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  parseAdemeRss,
  parseAdemeCatalogueHtml,
  ademeStatusProof,
  ademeKindFromOfficialUrl,
  selectAdemeInventory
} from '../scripts/connectors/ademe.mjs';

const NOW=new Date('2026-09-30T18:30:00Z');

test('le RSS ADEME conserve les fiches officielles et expose leur période active',()=>{
  const xml=`<rss><channel>
    <item>
      <title>AAP Décarbonation</title>
      <link>https://agirpourlatransition.ademe.fr/entreprises/aides-financieres/catalogue/aap/decarbonation</link>
      <description>&lt;p&gt;Délai de dépôt des dossiers : du 01/09/2026 - 12:00 au 31/12/2026 - 23:00 - Heure de Paris&lt;/p&gt;</description>
    </item>
    <item>
      <title>Aide ancienne</title>
      <link>https://agirpourlatransition.ademe.fr/entreprises/aides-financieres/catalogue/2026/aide-ancienne</link>
      <description>&lt;p&gt;Délai de dépôt des dossiers : du 01/01/2026 - 00:00 au 01/09/2026 - 00:00 - Heure de Paris&lt;/p&gt;</description>
    </item>
    <item><title>Retour d'expérience</title><link>https://agirpourlatransition.ademe.fr/entreprises/aides-financieres/catalogue-rex/demo</link></item>
    <item><title>Actualité</title><link>https://agirpourlatransition.ademe.fr/entreprises/actualites/demo</link></item>
  </channel></rss>`;
  const links=parseAdemeRss(xml,{now:NOW});
  assert.equal(links.length,2);
  const aap=links.find(x=>x.label==='AAP Décarbonation');
  const old=links.find(x=>x.label==='Aide ancienne');
  assert.equal(aap.rssActive,true);
  assert.equal(aap.rssClosingDate,'2026-12-31');
  assert.equal(aap.catalogueKind,'AAP / AMI');
  assert.equal(old.rssActive,false);
  assert.equal(old.catalogueKind,'AIDE');
});

test('la taxonomie URL officielle ADEME distingue AAP et aides',()=>{
  assert.equal(ademeKindFromOfficialUrl('https://agirpourlatransition.ademe.fr/entreprises/aides-financieres/catalogue/aap/demo'),'AAP / AMI');
  assert.equal(ademeKindFromOfficialUrl('https://agirpourlatransition.ademe.fr/entreprises/aides-financieres/catalogue/2026/demo'),'AIDE');
  assert.equal(ademeKindFromOfficialUrl('https://agirpourlatransition.ademe.fr/entreprises/aides-financieres/catalogue'),null);
});

test('si le HTML du catalogue est bloqué, seules les entrées RSS encore actives reconstruisent le catalogue',()=>{
  const rss=[
    {url:'https://agirpourlatransition.ademe.fr/entreprises/aides-financieres/catalogue/aap/a',label:'AAP A',rssActive:true,rssClosingDate:'2026-12-31',catalogueKind:'AAP / AMI',catalogueEvidence:'échéance 31/12/2026'},
    {url:'https://agirpourlatransition.ademe.fr/entreprises/aides-financieres/catalogue/2026/b',label:'Aide B',rssActive:true,rssClosingDate:'2027-01-31',catalogueKind:'AIDE',catalogueEvidence:'échéance 31/01/2027'},
    {url:'https://agirpourlatransition.ademe.fr/entreprises/aides-financieres/catalogue/aap/c',label:'AAP clos',rssActive:false,rssClosingDate:'2026-08-01',catalogueKind:'AAP / AMI'}
  ];
  const selected=selectAdemeInventory({minExpected:60},rss,{links:[],expectedTotal:null,pagesScanned:8,discoveryErrors:[{url:'catalogue',reason:'blocked'}]});
  assert.equal(selected.inventoryMode,'RSS_ACTIVE_MIRROR');
  assert.equal(selected.catalogue.length,2);
  assert.equal(selected.catalogueData.aapCount,1);
  assert.equal(selected.catalogueData.aidCount,1);
  assert.equal(selected.catalogueData.expectedTotal,2);
  assert.ok(selected.catalogue.every(x=>x.inventoryMode==='RSS_ACTIVE_MIRROR'));
});

test('un catalogue HTML complet reste prioritaire sur le fallback RSS',()=>{
  const rss=[{url:'https://agirpourlatransition.ademe.fr/entreprises/aides-financieres/catalogue/aap/a',rssActive:true,catalogueKind:'AAP / AMI'}];
  const html={links:Array.from({length:60},(_,i)=>({
    url:`https://agirpourlatransition.ademe.fr/entreprises/aides-financieres/catalogue/2026/aide-${i}`,
    label:`Aide ${i}`,catalogueKind:'AIDE',catalogueStatus:'OPEN'
  })),expectedTotal:60,aapCount:0,aidCount:60,unclassified:[],pagesScanned:6,discoveryErrors:[]};
  const selected=selectAdemeInventory({minExpected:60},rss,html);
  assert.equal(selected.inventoryMode,'CATALOGUE_HTML');
  assert.equal(selected.catalogue.length,60);
});

test('ADEME est le seul guichet actif du verrou courant',()=>{
  const lock=JSON.parse(fs.readFileSync(new URL('../config/collection-lock.json',import.meta.url),'utf8'));
  assert.equal(lock.locked,true);
  assert.equal(lock.name,'ADEME');
  assert.equal(lock.version,5);
  assert.deepEqual(lock.allowedSourceIds,['ademe']);
  assert.equal(lock.certification.allowOfficialRssFallback,true);
});

test('le catalogue Entreprises reste la référence ADEME et le RSS officiel est son fallback actif',()=>{
  const cfg=JSON.parse(fs.readFileSync(new URL('../config/sources.json',import.meta.url),'utf8'));
  const s=cfg.sources.find(x=>x.id==='ademe');
  assert.equal(s.strategy,'ademe-official');
  assert.equal(s.url,'https://agirpourlatransition.ademe.fr/entreprises/aides-financieres/catalogue');
  assert.equal(s.inventoryFallback,'rss-active-deadlines');
  assert.match(s.closedCatalogueUrl,/catalogue-aides-closes$/);
  assert.match(s.rssUrl,/agirpourlatransition\.ademe\.fr/);
});

test('le catalogue ADEME reprend directement la classification Appel à projet / Aide',()=>{
  const html=`<main>
    <p>2 dispositifs d’aide correspondent à vos critères</p>
    <article class="card"><span>Appel à projet</span><a href="/entreprises/aides-financieres/catalogue/aap/decarbonation">Décarbonation</a><span>Ouvert jusqu'au 09 février 2027</span><span>Toutes les Régions</span></article>
    <article class="card"><span>Aide</span><a href="/entreprises/aides-financieres/catalogue/2026/etude-x">Étude X</a><span>Ouvert jusqu'au 31 décembre 2026</span><span>Toutes les Régions</span></article>
    <a href="/entreprises/aides-financieres/catalogue-rex/demo">REX</a>
    <a href="/entreprises/aides-financieres/catalogue?page=1">Suite</a>
  </main>`;
  const out=parseAdemeCatalogueHtml(html,'https://agirpourlatransition.ademe.fr/entreprises/aides-financieres/catalogue');
  assert.equal(out.totalCount,2);
  assert.equal(out.aids.length,2);
  assert.equal(out.aapCount,1);
  assert.equal(out.aidCount,1);
  assert.equal(out.unclassifiedCount,0);
  assert.equal(out.aids.find(x=>x.label==='Décarbonation').catalogueKind,'AAP / AMI');
  assert.equal(out.aids.find(x=>x.label==='Étude X').catalogueKind,'AIDE');
  assert.equal(out.aids.find(x=>x.label==='Décarbonation').catalogueClosingDate,'2027-02-09');
  assert.ok(out.pages.some(x=>x.includes('page=1')));
});

test('un titre contenant aide ne suffit jamais à classifier une carte sans statut ouvert',()=>{
  const html='<main><h2><a href="/entreprises/aides-financieres/catalogue/aap/aide-experimentale">Aide expérimentale</a></h2></main>';
  const out=parseAdemeCatalogueHtml(html,'https://agirpourlatransition.ademe.fr/entreprises/aides-financieres/catalogue');
  assert.equal(out.aids.length,1);
  assert.equal(out.aids[0].catalogueKind,null);
  assert.equal(out.unclassifiedCount,1);
});

test('la certification ADEME exige complétude, classification, appartenance et RSS officiel',()=>{
  const lock=JSON.parse(fs.readFileSync(new URL('../config/collection-lock.json',import.meta.url),'utf8'));
  assert.equal(lock.certification.requireCatalogueDiscovery,true);
  assert.equal(lock.certification.requireCatalogueCompleteness,true);
  assert.equal(lock.certification.requireCatalogueClassification,true);
  assert.equal(lock.certification.requireCatalogueMasterMembership,true);
  assert.equal(lock.certification.requireRssDiscovery,true);
  assert.equal(lock.certification.requireExternalAuditDiscovery,true);
});

test("le contre-audit multi-moteurs reste un contrôle et n'est pas vide",()=>{
  const audit=JSON.parse(fs.readFileSync(new URL('../config/ademe-v2-external-audit.json',import.meta.url),'utf8'));
  assert.ok(audit.candidateCount>0);
  assert.ok(audit.engines.includes('Exa'));
  assert.ok(audit.engines.includes('Tavily'));
  assert.ok(audit.engines.includes('Parallel Search'));
  assert.ok(audit.engines.includes('Firecrawl'));
});

test('une fiche directe indiquée close entre en conflit avec un inventaire actif',()=>{
  const out=ademeStatusProof({deadlines:['2026-12-31'],finalClosingDate:'2026-12-31'},"Cet appel à projets est maintenant clos.",new Date('2026-09-30T12:00:00Z'));
  assert.equal(out.state,'STATUS_CONFLICT');
  assert.equal(out.retain,false);
});
