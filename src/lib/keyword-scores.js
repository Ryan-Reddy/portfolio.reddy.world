import {normalize,stems} from './keyword-ratings.js';
const DAY=86400000;
export function demandScore(entry,now=Date.now()) {
  const end=Date.parse(entry?.end);
  if(!entry||!Number.isFinite(entry.recent)||entry.recent<0||!Number.isFinite(end)||now-end>14*DAY||end>now+DAY)return null;
  // A fixed logarithmic scale: 0 observed searches = 0; 10,000+ in 4 reported weeks = 100.
  const score=Math.min(100,Math.round(100*Math.log10(entry.recent+1)/4));
  const change=entry.previous>=20?(entry.recent-entry.previous)/entry.previous:null;
  return {score,change,newlyActive:entry.previous===0&&entry.recent>=20,recent:entry.recent,previous:entry.previous,end:entry.end};
}
export function keywordChoices(query,data,selected=[],{rising=false,limit=5,now=Date.now(),extra=[]}={}) {
  const q=normalize(query);if(q.length<2)return [];
  const roots=stems(q).map(s=>s.slice(0,4));
  const used=new Set(selected.map(normalize));
  const words=[...new Set([...Object.keys(data?.keywords??{}),...extra])];
  return words.filter(word=>!used.has(normalize(word))).map(word=>{
    const clean=normalize(word),parts=stems(clean).map(s=>s.slice(0,4));
    const exact=clean===q,prefix=clean.startsWith(q),shared=parts.filter(p=>roots.includes(p)).length;
    return {word,metric:demandScore(data?.keywords?.[clean],now),fit:exact?4:prefix?3:clean.includes(q)?2:shared?1:0};
  }).filter(item=>item.fit>0&&(!rising||(item.metric?.change??0)>0||item.metric?.newlyActive)).sort((a,b)=>{
    if(a.fit===4||b.fit===4)return b.fit-a.fit;
    const scored=Number(Boolean(b.metric))-Number(Boolean(a.metric));if(scored)return scored;
    if(rising){const fresh=Number(b.metric?.newlyActive)-Number(a.metric?.newlyActive);if(fresh)return fresh;const growth=(b.metric?.change??0)-(a.metric?.change??0);if(growth)return growth;}
    return (b.metric?.score??-1)-(a.metric?.score??-1)||b.fit-a.fit||a.word.localeCompare(b.word);
  }).slice(0,limit);
}
