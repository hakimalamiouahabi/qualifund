// Enrichissement entreprise : source publique DINUM en priorité, Pappers facultatif.
// Les clés Pappers restent uniquement côté serveur.
async function fetchWithTimeout(url,options={},timeoutMs=12000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{return await fetch(url,{...options,signal:controller.signal})}
  finally{clearTimeout(timer)}
}
const digits=v=>String(v||'').replace(/\D/g,'');

export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const raw=digits(req.query?.siren),siren=raw.length===14?raw.slice(0,9):raw;
  if(siren.length!==9)return res.status(400).json({error:'SIREN invalide'});
  const officialUrl=`https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(siren)}&per_page=10`;
  let r;
  try{r=await fetchWithTimeout(officialUrl,{headers:{Accept:'application/json','User-Agent':'LEYTON-RADAR/12.2.0'}})}
  catch(error){return res.status(502).json({error:'API Recherche d’entreprises indisponible',reason:error?.name==='AbortError'?'timeout':'network_error'})}
  if(!r.ok)return res.status(502).json({error:'API Recherche d’entreprises indisponible',status:r.status});
  const j=await r.json();
  const x=(j.results||[]).find(item=>digits(item?.siren)===siren);
  if(!x)return res.status(404).json({error:'Entreprise non trouvée'});
  const official={source:'API Recherche d’entreprises — DINUM',siren,company:x.nom_complet||x.nom_raison_sociale||null,naf:x.activite_principale||null,sector:x.libelle_activite_principale||null,legalForm:x.nature_juridique||null,creationDate:x.date_creation||null,employees:x.tranche_effectif_salarie||null,category:x.categorie_entreprise||null,headOffice:x.siege||null};
  let pappers=null;
  if(process.env.PAPPERS_API_TOKEN){
    try{
      const pr=await fetchWithTimeout(`https://api.pappers.fr/v2/entreprise?api_token=${encodeURIComponent(process.env.PAPPERS_API_TOKEN)}&siren=${siren}`,{},12000);
      if(pr.ok){const pj=await pr.json();if(digits(pj.siren||siren)===siren)pappers={source:'Pappers API (optionnel)',siren:pj.siren||siren,denomination:pj.nom_entreprise||pj.denomination||null,formeJuridique:pj.forme_juridique||null,effectif:pj.effectif||null,capital:pj.capital||null,dirigeants:pj.representants||null,finances:pj.finances||null}}
    }catch{}
  }
  res.setHeader('Cache-Control','private, max-age=0, must-revalidate');
  return res.status(200).json({official,pappers});
}
