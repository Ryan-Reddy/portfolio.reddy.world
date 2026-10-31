// Only aggregate keyword counts leave this script. The Bing key stays in the job environment.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const DAY=86400000;
export function weeklyStats(rows,now=Date.now()) {
  if(!Array.isArray(rows)||!rows.length)return null;
  const points=rows.map(row=>({at:Number(/\/Date\((\d+)/.exec(String(row.Date))?.[1])||Date.parse(row.Date),views:Number(row.Impressions)}))
    .filter(p=>Number.isFinite(p.at)&&Number.isFinite(p.views)&&p.views>=0&&p.at<=now+DAY).sort((a,b)=>a.at-b.at);
  const unique=[...new Map(points.map(p=>[p.at,p])).values()].slice(-8);
  if(unique.length<8||now-unique.at(-1).at>14*DAY)return null;
  if(unique.some((p,i)=>i&&(p.at-unique[i-1].at>9*DAY||p.at-unique[i-1].at<5*DAY)))return null;
  const sum=points=>points.reduce((n,p)=>n+p.views,0);
  return {recent:sum(unique.slice(4)),previous:sum(unique.slice(0,4)),end:new Date(unique.at(-1).at).toISOString().slice(0,10),weeks:unique.map(p=>p.views)};
}
export async function fetchKeyword(word,key,{fetchImpl=fetch,now=Date.now()}={}) {
  const url='https://ssl.bing.com/webmaster/api.svc/json/GetKeywordStats?'+new URLSearchParams({q:word,country:'nl',language:'nl-NL',apikey:key});
  const response=await fetchImpl(url,{signal:AbortSignal.timeout(20000)});
  if(!response.ok)return {error:'http-'+response.status};
  const data=await response.json();
  const stats=weeklyStats(data.d,now);
  return stats?{...stats,fetchedAt:new Date(now).toISOString()}:{error:Array.isArray(data.d)?'no-recent-series':'provider-unavailable'};
}
export function catalog(root) {
  const base=['signage','custom signage','digital signage','stage design','interior design','photography','portrait photography','brand activation','event decor','festival decor','exhibition design','exhibition stands','exhibition stand design','furniture design','product design','industrial design','lighting design','light installations','creative fabrication','custom fabrication','custom props','set design','stage lighting','sculpture','installation art','art installations','festival production','event production','visual design','graphic design','creative technologist','experiential design','retail design','window display','shop signage','lightbox','neon signs','sign making','interior architecture','architectural photography','fashion photography','fashion model','male model','modelling','photoshoot','video production','portfolio','Amsterdam','decor','meubilair','interieur','lichtinstallatie','kunstinstallatie','merkactivatie','beursstand','festivaldecor','fotografie'];
  const ratings=JSON.parse(fs.readFileSync(path.join(root,'src/data/keyword-ratings.json'),'utf8'));
  const extra=Object.entries(ratings.topics??{}).flatMap(([word,topic])=>[word,...(topic.related??[]).map(item=>item.tag)]);
  return [...new Set([...base,...extra].map(s=>String(s).toLowerCase().replace(/\s+/g,' ').trim()))]
    .filter(word=>word.length>=3&&word.length<=65&&word.split(' ').length<=5&&!/[\d<>:@/~]/.test(word)).slice(0,180);
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const key=process.env.BING_WEBMASTER_API_KEY;
  const root=path.resolve(import.meta.dirname,'..'),probe=process.env.KEYWORD_PROBE==='1';
  const words=probe?['signage','custom signage','digital signage','stage design','interior design','photography','portrait photography','brand activation']:catalog(root);
  const out=path.resolve(process.argv[2]??'src/data/keyword-search.json');
  const previous=!probe&&fs.existsSync(out)?JSON.parse(fs.readFileSync(out,'utf8')):{};
  const output={source:'Bing Webmaster keyword research',market:'NL',language:'nl-NL',updatedAt:previous.updatedAt??null,keywords:{...previous.keywords},unavailable:{...previous.unavailable}};
  if(!key)throw new Error('Bing keyword connection is not configured');
  let checked=0;
  for(const word of words){
    const known=output.keywords[word]??output.unavailable[word];
    if(!probe&&process.env.KEYWORD_FORCE!=='1'&&Date.now()-Date.parse(known?.fetchedAt??known?.checkedAt)<6*DAY)continue;
    let result;try{result=await fetchKeyword(word,key);}catch{result={error:'provider-unavailable'};}
    if(result.error)output.unavailable[word]={reason:result.error,checkedAt:new Date().toISOString()};else{output.keywords[word]=result;delete output.unavailable[word];}
    checked++;console.log(word+': '+(result.error??`${result.recent} searches, latest weekly point ${result.end}`));await new Promise(r=>setTimeout(r,1000));
  }
  if(checked)output.updatedAt=new Date().toISOString();
  fs.writeFileSync(out,JSON.stringify(output,null,2)+'\n');
  console.log(`Keyword data: ${Object.keys(output.keywords).length} usable, ${Object.keys(output.unavailable).length} unavailable`);
}
