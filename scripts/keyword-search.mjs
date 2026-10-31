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
  if(unique.length<8||now-unique.at(-1).at>21*DAY)return null;
  if(unique.some((p,i)=>i&&p.at-unique[i-1].at>10*DAY))return null;
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
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const key=process.env.BING_WEBMASTER_API_KEY;
  const words=['signage','custom signage','digital signage','stage design','interior design','photography','portrait photography','brand activation'];
  const output={source:'Bing Webmaster keyword research',market:'NL',language:'nl-NL',updatedAt:new Date().toISOString(),keywords:{},unavailable:{}};
  if(!key)throw new Error('Bing keyword connection is not configured');
  for(const word of words){const result=await fetchKeyword(word,key);if(result.error)output.unavailable[word]=result.error;else output.keywords[word]=result;console.log(word+': '+(result.error??`${result.recent} searches, latest weekly point ${result.end}`));await new Promise(r=>setTimeout(r,1000));}
  const out=path.resolve(process.argv[2]??'keyword-search-probe.json');fs.writeFileSync(out,JSON.stringify(output,null,2)+'\n');
  console.log(`Keyword data: ${Object.keys(output.keywords).length} usable, ${Object.keys(output.unavailable).length} unavailable`);
}
