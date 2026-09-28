import { sleep } from './utils.mjs';

const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36 LEYTON-RADAR';
export async function fetchWithRetry(url,{timeoutMs=25000,retries=2,headers={},method='GET'}={}){
  let last;
  for(let i=0;i<=retries;i++){
    const ac=new AbortController();const timer=setTimeout(()=>ac.abort(),timeoutMs);
    try{
      const r=await fetch(url,{method,redirect:'follow',signal:ac.signal,headers:{'user-agent':UA,'accept':'text/html,application/json,application/xml,text/csv,*/*;q=0.8',...headers}});
      clearTimeout(timer);
      if(r.status===429||r.status>=500){last=new Error(`HTTP ${r.status}`);if(i<retries){await sleep(800*Math.pow(2,i));continue}}
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      return r;
    }catch(e){clearTimeout(timer);last=e;if(i<retries)await sleep(700*Math.pow(2,i));}
  }
  throw last;
}
export async function fetchText(url,opts){const r=await fetchWithRetry(url,opts);return {text:await r.text(),headers:r.headers,status:r.status,url:r.url}}
export async function fetchJson(url,opts){const r=await fetchWithRetry(url,{...opts,headers:{accept:'application/json',...(opts?.headers||{})}});return {json:await r.json(),headers:r.headers,status:r.status,url:r.url}}
export async function fetchBuffer(url,opts){const r=await fetchWithRetry(url,opts);return {buffer:Buffer.from(await r.arrayBuffer()),headers:r.headers,status:r.status,url:r.url,contentType:r.headers.get('content-type')||''}}
