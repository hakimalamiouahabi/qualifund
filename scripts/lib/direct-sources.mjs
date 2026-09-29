import { createHash } from 'node:crypto';
export const directPageId=(sourceId,url)=>sourceId+'_'+createHash('sha256').update(url).digest('hex');
const forbidden=/(?:aides[-_]entreprises|aides[-_]territoires|data\.gouv\.fr)/i;
export function assertDirectSources(cfg){
  if(cfg.sourcePolicy!=='DIRECT_OFFICIAL_ONLY')throw new Error('Politique de sources directes manquante');
  for(const s of cfg.sources||[]){
    if(!s.official||!s.url||forbidden.test(JSON.stringify(s))||!['catalog-html','official-page','opendatasoft','control-only'].includes(s.strategy))throw new Error('Source interdite: '+s.id);
  }
}
export function isDirectAid(a,cfg){
  if(!a||forbidden.test(JSON.stringify(a))||/^ae_|^qf_ae_/.test(a.id||''))return false;
  const source=(cfg.sources||[]).find(s=>s.id===a.sourceId);
  if(!source||source.strategy==='control-only')return false;
  try{
    const u=new URL(a.officialPage);
    if(u.protocol!=='https:'||u.pathname==='/')return false;
    const hosts=(cfg.sources||[]).map(s=>new URL(s.url).hostname);
    if(!hosts.includes(u.hostname))return false;
    const normalize=x=>{const z=new URL(x);z.hash='';return z.href.replace(/\/$/,'')};
    if((cfg.sources||[]).some(s=>s.strategy!=='official-page'&&normalize(s.url)===normalize(u.href)))return false;
    if(/\/(?:stock|catalogue|appels|aides|les-aides|nos-appels-a-projets-concours|api\/explore\/v2\.1)\/?$/.test(u.pathname))return false;
    return true;
  }catch{return false}
}
export const filterDirectLibrary=(records,cfg)=>(records||[]).filter(a=>isDirectAid(a,cfg));
