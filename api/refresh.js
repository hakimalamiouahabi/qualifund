import { createHash, timingSafeEqual } from 'node:crypto';

function secureEqual(a,b){
  const da=createHash('sha256').update(String(a||''),'utf8').digest();
  const db=createHash('sha256').update(String(b||''),'utf8').digest();
  return timingSafeEqual(da,db);
}

async function fetchWithTimeout(url,options={},timeoutMs=15000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{return await fetch(url,{...options,signal:controller.signal})}
  finally{clearTimeout(timer)}
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const admin=process.env.RADAR_ADMIN_TOKEN;
  if(!admin)return res.status(503).json({error:'RADAR_ADMIN_TOKEN non configuré'});
  const supplied=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'')||String(req.headers['x-radar-admin-token']||'');
  if(!supplied||!secureEqual(supplied,admin))return res.status(401).json({error:'Authentification administrateur requise'});
  const repo=process.env.GITHUB_REPOSITORY,token=process.env.GITHUB_TOKEN,branch=process.env.GITHUB_BRANCH||'main';
  if(!repo||!token)return res.status(503).json({error:'Déclenchement GitHub non configuré'});
  try{
    const r=await fetchWithTimeout(`https://api.github.com/repos/${repo}/actions/workflows/update-and-deploy.yml/dispatches`,{
      method:'POST',
      headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10','Content-Type':'application/json','User-Agent':'LEYTON-RADAR/12.2.0'},
      body:JSON.stringify({ref:branch,inputs:{full_refresh:'true'}})
    });
    if(!r.ok)return res.status(r.status).json({error:'GitHub workflow dispatch failed',details:(await r.text()).slice(0,2000)});
    return res.status(202).json({ok:true,message:'Collecte LEYTON RADAR demandée',repository:repo,branch});
  }catch(error){
    const reason=error?.name==='AbortError'?'timeout':'network_error';
    return res.status(502).json({error:'GitHub workflow dispatch indisponible',reason});
  }
}
