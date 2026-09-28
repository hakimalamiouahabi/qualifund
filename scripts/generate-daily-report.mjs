import fs from 'node:fs/promises';
import path from 'node:path';
const ROOT=path.resolve(process.cwd());
const beforePath=process.argv[2]||path.join(ROOT,'site','data','library.previous.json');
const afterPath=process.argv[3]||path.join(ROOT,'site','data','library.json');
const outDir=process.argv[4]||path.join(ROOT,'site','bibliotheque','rapports');
const read=async p=>{try{return JSON.parse(await fs.readFile(p,'utf8'))}catch{return null}};
const list=o=>Array.isArray(o)?o:(Array.isArray(o?.aaps)?o.aaps:[]);
const key=a=>String(a.canonicalId||a.id||a.title||'');
const status=a=>String(a.lifecycleStatus||a.verification?.status||'').toUpperCase();
const date=a=>a.finalClosingDate||a.closingDate||(a.deadlines||[])[0]?.date||(a.deadlines||[])[0]||'';
const url=a=>a.officialPage||a.sourceLinks?.[0]?.url||'';
const fingerprint=a=>JSON.stringify({title:a.title,status:status(a),deadline:date(a),aidTypes:a.aidTypes,aidRate:a.aidRate,aidAmount:a.aidAmount,beneficiaries:a.beneficiaries,cdc:a.cdcLinks,objective:a.objective});
const afterObj=await read(afterPath);
if(!afterObj)throw new Error(`Bibliothèque après introuvable: ${afterPath}`);
const explicitBefore=await read(beforePath);
// Au premier rapport, l'absence de baseline ne signifie pas que tout le stock est "nouveau".
// On initialise donc la référence avec le snapshot courant et on publie zéro mouvement.
const baselineInitialized=!explicitBefore;
const beforeObj=explicitBefore||afterObj;
const before=list(beforeObj), after=list(afterObj), B=new Map(before.map(a=>[key(a),a])), A=new Map(after.map(a=>[key(a),a]));
const created=[],modified=[],obsolete=[];
for(const[k,a]of A){if(!B.has(k))created.push(a);else if(fingerprint(a)!==fingerprint(B.get(k)))modified.push({before:B.get(k),after:a})}
for(const[k,b]of B){if(!A.has(k))obsolete.push({...b,reason:'DISPARU_DE_LA_COLLECTE'});else{const a=A.get(k);if(!/(ARCHIVE|STALE|CLOS|CLOSED|EXPIRED|OBSOLETE)/.test(status(b))&&/(ARCHIVE|STALE|CLOS|CLOSED|EXPIRED|OBSOLETE)/.test(status(a)))obsolete.push({...a,reason:'DEVENU_CLOS_OU_OBSOLETE'})}}
const compact=a=>({id:a.id||null,titre:a.title||'',statut:status(a),echeance:date(a),source:url(a),verification:a.verification?.status||'A_REVERIFIER',confiance:a.verification?.confidence??null});
const now=new Date(),day=now.toISOString().slice(0,10),report={generatedAt:now.toISOString(),date:day,baselineInitialized,totals:{before:before.length,after:after.length,new:created.length,modified:modified.length,obsolete:obsolete.length},nouvellesAides:created.map(compact),aidesModifiees:modified.map(x=>({avant:compact(x.before),apres:compact(x.after)})),aidesObsoletes:obsolete.map(compact)};
await fs.mkdir(outDir,{recursive:true});
await fs.writeFile(path.join(outDir,`${day}.json`),JSON.stringify(report,null,2));
await fs.writeFile(path.join(outDir,'latest.json'),JSON.stringify(report,null,2));
const md=[`# LEYTON RADAR — rapport quotidien ${day}`,'',`Généré : ${report.generatedAt}`,'',...(baselineInitialized?['> Baseline initialisée sur le snapshot courant : aucun dispositif n’est compté artificiellement comme nouveau.','']:[]),`- Bibliothèque avant : **${report.totals.before}**`,`- Bibliothèque après : **${report.totals.after}**`,`- Nouvelles aides / AAP : **${report.totals.new}**`,`- Dispositifs modifiés : **${report.totals.modified}**`,`- Clos / obsolètes / disparus : **${report.totals.obsolete}**`,'','## Nouvelles aides retenues',...(report.nouvellesAides.length?report.nouvellesAides.map(x=>`- **${x.titre}** — ${x.echeance||'échéance à vérifier'} — ${x.source||'source à vérifier'}`):['- Aucune.']),'','## Modifications',...(report.aidesModifiees.length?report.aidesModifiees.map(x=>`- **${x.apres.titre}** — échéance/statut actuel : ${x.apres.echeance||x.apres.statut||'à vérifier'}`):['- Aucune.']),'','## Aides devenues closes / obsolètes',...(report.aidesObsoletes.length?report.aidesObsoletes.map(x=>`- **${x.titre}** — ${x.statut||'disparu'} — ${x.source||''}`):['- Aucune.']),'','> Toute information sans preuve publique reste « NON DOCUMENTÉ — À VÉRIFIER ».'].join('\n');
await fs.writeFile(path.join(outDir,`${day}.md`),md);await fs.writeFile(path.join(outDir,'latest.md'),md);console.log(JSON.stringify({...report.totals,baselineInitialized}));
