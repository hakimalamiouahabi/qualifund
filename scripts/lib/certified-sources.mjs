import fs from 'node:fs/promises';
import path from 'node:path';

const CERT_SUFFIX='-certification.json';
const ACTIVE_CERT='active-source-certification.json';

async function readJson(file,fallback=null){
  try{return JSON.parse(await fs.readFile(file,'utf8'))}
  catch(e){if(e.code==='ENOENT')return fallback;throw e}
}

export function aidSourceIds(a){
  const ids=[a?.sourceId];
  for(const x of Array.isArray(a?.sourceAliases)?a.sourceAliases:[]){
    ids.push(typeof x==='string'?x:(x?.id||x?.sourceId||null));
  }
  return ids.filter(Boolean);
}

export function aidIsCertified(a,certifiedIds){
  const set=certifiedIds instanceof Set?certifiedIds:new Set(certifiedIds||[]);
  return aidSourceIds(a).some(id=>set.has(id));
}

export async function loadCertifiedSources(root,cfg,{includeActivePass=true}={}){
  const data=path.join(root,'site','data');
  const configured=new Set((cfg?.sources||[]).map(s=>s.id));
  const files=await fs.readdir(data).catch(()=>[]);
  const candidates=files.filter(name=>name.endsWith(CERT_SUFFIX)&&name!==ACTIVE_CERT);
  if(includeActivePass&&files.includes(ACTIVE_CERT))candidates.push(ACTIVE_CERT);

  const ids=new Set(),guichets=new Set(),certificates=[];
  const seenFingerprint=new Set();
  for(const name of candidates){
    const cert=await readJson(path.join(data,name),null);
    if(!cert||cert.status!=='PASS')continue;
    const sourceIds=(cert.lock?.allowedSourceIds||[]).filter(id=>configured.has(id));
    if(!sourceIds.length)continue;
    const fingerprint=[cert.lock?.name||'',...sourceIds.sort()].join('|');
    if(seenFingerprint.has(fingerprint))continue;
    seenFingerprint.add(fingerprint);
    sourceIds.forEach(id=>ids.add(id));
    if(cert.lock?.name)guichets.add(cert.lock.name);
    certificates.push({
      file:name,
      name:cert.lock?.name||name.replace(CERT_SUFFIX,''),
      generatedAt:cert.generatedAt||null,
      sourceIds
    });
  }
  return{ids,guichets,certificates};
}

export async function writeCertifiedSourcesArtifact(root,cfg){
  const data=path.join(root,'site','data');
  const state=await loadCertifiedSources(root,cfg);
  const payload={
    generatedAt:new Date().toISOString(),
    sourceIds:[...state.ids].sort(),
    guichets:[...state.guichets].sort((a,b)=>a.localeCompare(b,'fr')),
    certificates:state.certificates.sort((a,b)=>String(a.name).localeCompare(String(b.name),'fr'))
  };
  await fs.writeFile(path.join(data,'certified-sources.json'),JSON.stringify(payload,null,2)+'\n','utf8');
  return payload;
}
