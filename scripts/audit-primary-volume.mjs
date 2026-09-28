import fs from 'node:fs/promises';
import { collectAidesEntreprises } from '../scripts/connectors/aides-entreprises.mjs';
import { collectAidesTerritoires } from '../scripts/connectors/aides-territoires.mjs';

const cfg=JSON.parse(await fs.readFile(new URL('../config/sources.json',import.meta.url),'utf8'));
const ae=cfg.sources.find(x=>x.id==='aides_entreprises');
const at=cfg.sources.find(x=>x.id==='aides_territoires');
const out={generatedAt:new Date().toISOString(),version:cfg.version};

try{
  const r=await collectAidesEntreprises(ae,{log:console.log});
  out.aidesEntreprises={discovered:r.discovered,retained:r.aids.length,scopeCounts:r.aids.reduce((m,a)=>(m[a.scope]=(m[a.scope]||0)+1,m),{}),sizeKnown:r.aids.filter(a=>(a.companyCategories||[]).length).length,sizeUnknown:r.aids.filter(a=>!(a.companyCategories||[]).length).length};
}catch(e){out.aidesEntreprises={error:e.message}}

try{
  const r=await collectAidesTerritoires(at,{log:console.log});
  out.aidesTerritoires={discovered:r.discovered,retained:r.aids.length,scopeCounts:r.aids.reduce((m,a)=>(m[a.scope]=(m[a.scope]||0)+1,m),{})};
}catch(e){out.aidesTerritoires={error:e.message}}

console.log('PRIMARY_VOLUME_AUDIT='+JSON.stringify(out));
