import * as cheerio from 'cheerio';
import { fetchText } from '../lib/http.mjs';
import { browserHtml } from '../lib/browser.mjs';
import { extractFromHtml } from '../lib/extract.mjs';
import { uniq } from '../lib/utils.mjs';

async function getHtml(source){
  try{return (await fetchText(source.url,{timeoutMs:30000,retries:2})).text}
  catch(e){if(source.browserFallback!==false)return (await browserHtml(source.url,{timeoutMs:45000})).html;throw e}
}

export async function collectOfficialPage(source,{log=console.log}={}){
  const html=await getHtml(source);
  const $=cheerio.load(html);
  $('script,style,noscript,nav,header,footer,svg').remove();
  const pageText=String(($('main').first().length?$('main').first():$('body')).text()||'').replace(/\s+/g,' ').trim();
  const scope=source.scope==='France'?'NATIONAL':'REGIONAL';
  const rec=extractFromHtml(html,{url:source.url,sourceTier:'B',scope,region:scope==='REGIONAL'?source.scope:null});
  if(source.titleOverride)rec.title=source.titleOverride;
  const forcedAidTypes=uniq([...(Array.isArray(source.forceAidTypes)?source.forceAidTypes:[]),source.forceAidType].filter(Boolean));
  if(forcedAidTypes.length)rec.aidTypes=uniq([...(rec.aidTypes||[]),...forcedAidTypes]);
  if(source.forceCompanyCategories)rec.companyCategories=uniq([...(rec.companyCategories||[]),...source.forceCompanyCategories]);
  if(source.operator)rec.operator=source.operator;
  rec.id=`${source.id}_official`;
  rec.canonicalId=rec.id;
  rec.sourceId=source.id;
  rec.sourceRecordId='official';
  rec.kind=source.kindOverride||rec.kind||'AIDE';
  rec.funder=uniq([source.funder||source.name.replace(/ —.*/,''),...(rec.funder||[])]);
  rec.officialPage=source.url;
  rec.sourceLinks=uniq([source.url,...(rec.sourceLinks||[]).map(x=>x?.url).filter(Boolean)]).map((url,i)=>({label:i?'Source officielle complémentaire':'Page officielle',url}));
  const checkedAt=new Date().toISOString();
  const extra=[];
  const instrumentPatterns={
    SUBVENTION:/\bsubventions?\b/i,
    AVANCE_REMBOURSABLE:/\bavance(?:s)?\s+(?:remboursable|r[eé]cup[eé]rable)s?\b/i,
    PRET_TAUX_ZERO:/\bpr[êe]t[^.;]{0,60}(?:taux\s*(?:0|z[eé]ro)|sans\s+int[eé]r[êe]t)\b/i
  };
  for(const type of forcedAidTypes){
    const rx=instrumentPatterns[type];if(!rx)continue;
    const m=pageText.match(rx);if(!m)continue;
    const i=Math.max(0,(m.index||0)-180),j=Math.min(pageText.length,(m.index||0)+m[0].length+300);
    extra.push({field:'instrument',sourceUrl:source.url,sourceTier:'B',locator:'official-page-instrument',evidenceText:pageText.slice(i,j),checkedAt});
  }
  if(source.guichetVerified){
    const needle=String(source.guichetVerified);
    const idx=pageText.toLowerCase().indexOf(needle.toLowerCase());
    if(idx>=0){
      const i=Math.max(0,idx-180),j=Math.min(pageText.length,idx+needle.length+300);
      rec.guichetVerified=source.guichetVerified;
      extra.push({field:'guichet',sourceUrl:source.url,sourceTier:'B',locator:'official-page-guichet',evidenceText:pageText.slice(i,j),checkedAt});
    }
  }
  const company=/\b(?:entreprises?|tpe|pme|eti|start[- ]?ups?|soci[eé]t[eé]s?|industriels?)\b/i;
  const cue=/\b(?:[eé]ligib|port[eé]s par|b[eé]n[eé]ficiaire|projets? industriels?|toutes tailles|votre profil|vous [eê]tes)\b/i;
  const sentence=pageText.split(/(?<=[.!?;:])\s+/).find(s=>company.test(s)&&cue.test(s));
  if(sentence){
    rec.enterpriseEligible=true;
    extra.push({field:'enterpriseEligibility',sourceUrl:source.url,sourceTier:'B',locator:'official-page-enterprise',evidenceText:sentence.slice(0,850),checkedAt});
  }
  rec.verification={...(rec.verification||{}),sourceTier:'B',lastChecked:checkedAt,fieldEvidence:[...(rec.verification?.fieldEvidence||[]),...extra]};
  log(`[${source.id}/official-page] 1 page officielle -> ${rec.aidTypes?.join(', ')||'type non détecté'}`);
  return {aids:[rec],discovered:1,message:`Page officielle analysée: ${rec.title}`};
}
