export function parseCsv(text){
  const rows=[];let row=[],cell='',q=false;for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(c==='"'){if(q&&n==='"'){cell+='"';i++;}else q=!q;}else if(c===','&&!q){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&n==='\n')i++;row.push(cell);cell='';if(row.some(x=>x!==''))rows.push(row);row=[];}else cell+=c;}if(cell||row.length){row.push(cell);rows.push(row)}if(!rows.length)return[];const h=rows[0].map(x=>x.trim());return rows.slice(1).map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]??''])));
}
