import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  parseAdemeRss,
  parseAdemeCatalogueHtml,
  ademeStatusProof,
  ademeKindFromOfficialUrl,
  selectAdemeInventory,
  ademeInstrumentEvidence,
  ademeAttributionEvidence,
  ademeAccessBlockReason,
  ademeCataloguePolicy
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

test('le certificat ADEME historique reste structurellement cohérent avant recertification v13',()=>{
  const cert=JSON.parse(fs.readFileSync(new URL('../site/data/ademe-certification.json',import.meta.url),'utf8'));
  assert.equal(cert.status,'PASS');
  assert.equal(cert.lock?.name,'ADEME');
  const row=cert.bySource?.ademe||{};
  assert.ok(Number(row.rssActive||0)>0);
  assert.ok(Number(row.catalogue||0)>0);
  assert.equal(Number(row.catalogueAap||0)+Number(row.catalogueAid||0),Number(row.catalogue||0));
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

test('le certificat ADEME archivé conserve les preuves de complétude',()=>{
  const cert=JSON.parse(fs.readFileSync(new URL('../site/data/ademe-certification.json',import.meta.url),'utf8'));
  assert.equal(cert.status,'PASS');
  assert.ok(Number(cert.libraryRecords||0)>0);
  assert.ok(Number(cert.bySource?.ademe?.catalogue||0)>0);
  assert.equal(Number(cert.bySource?.ademe?.catalogueUnclassified||0),0);
  assert.equal(cert.problems?.length,0);
});

test("ADEME ne dépend d'aucun contre-audit externe",()=>{
  const cfg=JSON.parse(fs.readFileSync(new URL('../config/sources.json',import.meta.url),'utf8'));
  const source=cfg.sources.find(x=>x.id==='ademe');
  const connector=fs.readFileSync(new URL('../scripts/connectors/ademe.mjs',import.meta.url),'utf8');
  assert.equal(source.externalAuditFile,undefined);
  assert.doesNotMatch(connector,/externalAudit|Exa|Tavily|Parallel|Firecrawl/i);
  assert.match(connector,/rssLinks/);
  assert.match(connector,/catalogueLinks/);
});

test('une fiche directe indiquée close entre en conflit avec un inventaire actif',()=>{
  const out=ademeStatusProof({deadlines:['2026-12-31'],finalClosingDate:'2026-12-31'},"Cet appel à projets est maintenant clos.",new Date('2026-09-30T12:00:00Z'));
  assert.equal(out.state,'STATUS_CONFLICT');
  assert.equal(out.retain,false);
});

test('ADEME matérialise seulement les instruments financiers explicitement prouvés',()=>{
  const proof=ademeInstrumentEvidence(
    "L'aide prend la forme d'une subvention de 40 %. Une avance remboursable peut compléter le financement.",
    ['SUBVENTION','AVANCE_REMBOURSABLE']
  );
  assert.match(proof,/SUBVENTION:/);
  assert.match(proof,/AVANCE_REMBOURSABLE:/);
  assert.equal(ademeInstrumentEvidence("Une aide est proposée aux entreprises.",['AUTRE']),null);
});

test('la preuve instrument ADEME vient exclusivement de la page directe officielle',()=>{
  const connector=fs.readFileSync(new URL('../scripts/connectors/ademe.mjs',import.meta.url),'utf8');
  assert.match(connector,/field:'instrument'/);
  assert.match(connector,/sourceUrl:requested/);
  assert.match(connector,/loaded\?ademeInstrumentEvidence\(text,a\.aidTypes\):null/);
  assert.doesNotMatch(connector,/catalogueKind.*SUBVENTION/);
});

test('la présence sur le portail seule ne suffit pas ; seule une politique ADEME versionnée peut porter la preuve de guichet',()=>{
  const connector=fs.readFileSync(new URL('../scripts/connectors/ademe.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(connector,/field:'guichet'.*ademe-enterprises-inventory/);
  assert.match(connector,/field:'guichet'.*ademe-catalogue-policy/);
  assert.match(connector,/status:'UNVERIFIED'/);
  assert.match(connector,/catalogueScope!=='ADEME_ONLY'/);
});

test('la preuve de guichet ADEME exige une attribution explicite sur la fiche directe',()=>{
  const proof=ademeAttributionEvidence("Cette aide est accordée par l’ADEME aux entreprises éligibles.");
  assert.ok(proof);
  assert.equal(ademeAttributionEvidence("Ce dispositif est référencé sur le portail ADEME Entreprises."),null);
});

test('ADEME identifie explicitement le challenge Cloudflare sans le contourner',()=>{
  assert.equal(ademeAccessBlockReason('<html><title>Un instant…</title><div id="challenge-platform"></div></html>'),'CLOUDFLARE_CHALLENGE');
  assert.equal(ademeAccessBlockReason('<html><title>Aide ADEME</title><main>Aide en cours</main></html>','Aide ADEME'),null);
});

test('le collecteur ADEME comptabilise les motifs de non-lecture des fiches directes',()=>{
  const connector=fs.readFileSync(new URL('../scripts/connectors/ademe.mjs',import.meta.url),'utf8');
  assert.match(connector,/FICHE_DIRECTE_PROTEGEE_CLOUDFLARE_RSS_CONSERVE/);
  assert.match(connector,/detailWarningReasons/);
  assert.match(connector,/accès fiches directes/);
});

test('la politique de référentiel ADEME expire automatiquement',()=>{
  const source={
    cataloguePolicy:{
      verifiedAt:'2026-10-03',
      maxAgeDays:120,
      sourceUrl:'https://agirpourlatransition.ademe.fr/entreprises/aides-financieres',
      catalogueScope:'ADEME_ONLY',
      guichet:'ADEME',
      aidKindInstrument:'SUBVENTION',
      evidence:'Politique ADEME'
    }
  };
  assert.ok(ademeCataloguePolicy(source,{now:new Date('2026-12-01T12:00:00Z')}));
  assert.equal(ademeCataloguePolicy(source,{now:new Date('2027-03-01T12:00:00Z')}),null);
});

test('la politique ADEME ne transforme en subvention que les cartes classées Aide',()=>{
  const connector=fs.readFileSync(new URL('../scripts/connectors/ademe.mjs',import.meta.url),'utf8');
  assert.match(connector,/link\.catalogueKind==='AIDE'/);
  assert.match(connector,/ademe-catalogue-policy:aide=subvention/);
  assert.doesNotMatch(connector,/catalogueKind==='AAP \/ AMI'.*SUBVENTION/s);
});

test('la source ADEME porte une preuve institutionnelle officielle et exclut les fonds propres',()=>{
  const cfg=JSON.parse(fs.readFileSync(new URL('../config/sources.json',import.meta.url),'utf8'));
  const source=cfg.sources.find(x=>x.id==='ademe');
  assert.equal(source.cataloguePolicy?.catalogueScope,'ADEME_ONLY');
  assert.equal(source.cataloguePolicy?.guichet,'ADEME');
  assert.equal(source.cataloguePolicy?.aidKindInstrument,'SUBVENTION');
  assert.match(source.cataloguePolicy?.sourceUrl||'',/^https:\/\/agirpourlatransition\.ademe\.fr\/entreprises\/aides-financieres$/);
  assert.ok(source.cataloguePolicy?.excludes?.includes('ADEME_INVESTISSEMENT_FONDS_PROPRES'));
  assert.ok(Number(source.cataloguePolicy?.maxAgeDays)>0);
});
