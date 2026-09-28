import crypto from 'node:crypto';
import { fetchText, fetchBuffer } from './http.mjs';
import { browserHtml } from './browser.mjs';
import { extractFromHtml, extractFromPdf } from './extract.mjs';
import { mergeAid } from './merge.mjs';
import { arr } from './utils.mjs';
import { specificOfficialPage } from './source-proof.mjs';

async function pageHtml(url){
  try{return (await fetchText(url,{timeoutMs:25000,retries:2})).text}
  catch{return (await browserHtml(url,{timeoutMs:45000})).html}
}

export async function enrichAid(a,{log=()=>{}}={}){
  if(!a) return a;
  let out=a;
  const page=specificOfficialPage(a);
  if(page){
    try{
      const html=await pageHtml(page);
      const b=extractFromHtml(html,{url:page,sourceTier:'B',scope:a.scope,region:a.scope==='REGIONAL'?a.regions?.[0]:null});
      out=mergeAid(out,b);
    }catch(e){
      out.attentionPoints=[...new Set([...(out.attentionPoints||[]),`Source officielle inaccessible au dernier contrôle : ${e.message}`])];
    }
  }

  const docCandidates=[...arr(out.cdcLinks),...arr(out.regulationLinks),...arr(out.sourceLinks)]
    .filter(x=>x&&/^https?:/i.test(x.url||'')&&/\.pdf(?:$|\?)/i.test(x.url));
  const docs=[...new Map(docCandidates.map(x=>[x.url,x])).values()].slice(0,12),updated=[];
  for(const d of docs){
    try{
      const {buffer,contentType}=await fetchBuffer(d.url,{timeoutMs:40000,retries:2});
      if(contentType.includes('pdf')||d.url.toLowerCase().includes('.pdf')){
        const hash=crypto.createHash('sha256').update(buffer).digest('hex');
        out=mergeAid(out,await extractFromPdf(buffer,{url:d.url,scope:out.scope,region:out.scope==='REGIONAL'?out.regions?.[0]:null}));
        updated.push({...d,sourceTier:'A',sha256:hash,checkedAt:new Date().toISOString(),bytes:buffer.length});
      }else updated.push(d);
    }catch(e){
      log(`PDF non extrait ${d.url}: ${e.message}`);
      updated.push({...d,documentError:e.message});
    }
  }
  if(updated.length){
    const by=new Map(arr(out.cdcLinks).map(x=>[x.url,x]));
    for(const d of updated)by.set(d.url,{...(by.get(d.url)||{}),...d});
    out.cdcLinks=[...by.values()];
  }
  return out;
}
