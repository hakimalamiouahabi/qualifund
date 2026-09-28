import { fetchText } from '../lib/http.mjs';
import { browserHtml } from '../lib/browser.mjs';

export async function collectControl(source,{log=console.log}={}){
  let directError=null;
  try{
    await fetchText(source.url,{timeoutMs:18000,retries:1});
    return{aids:[],discovered:0,reachable:true,message:'Source de contrôle accessible — aucune ingestion massive'};
  }catch(e){directError=e}
  if(source.browserFallback!==false){
    try{
      await browserHtml(source.url,{timeoutMs:30000});
      log(`[${source.id}] contrôle accessible via navigateur automatisé`);
      return{aids:[],discovered:0,reachable:true,message:'Source de contrôle accessible via navigateur automatisé — aucune ingestion massive'};
    }catch(e){
      return{aids:[],discovered:0,reachable:false,message:`Source de contrôle inaccessible: ${directError?.message||''} ; navigateur: ${e.message}`};
    }
  }
  return{aids:[],discovered:0,reachable:false,message:'Source de contrôle inaccessible: '+(directError?.message||'erreur inconnue')};
}
