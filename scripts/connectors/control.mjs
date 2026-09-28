import { fetchText } from '../lib/http.mjs';
export async function collectControl(source){try{await fetchText(source.url,{timeoutMs:15000,retries:1});return{aids:[],discovered:0,message:'Source de contrôle accessible — aucune ingestion massive'}}catch(e){return{aids:[],discovered:0,message:'Source de contrôle inaccessible: '+e.message}}}
