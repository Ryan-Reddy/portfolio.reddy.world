import {normalize,rateable,coreOf,stems,relevant} from './keyword-ratings.js';
const headOf=word=>stems(coreOf(word).core).at(-1)?.slice(0,4) ?? '';
const sharesHead=(a,b)=>{const head=headOf(a);return !!head && stems(coreOf(b).core).some(stem=>stem.slice(0,4)===head);};
export const relatedFromDesk=(word,ratings)=>{
  const vocabulary=new Set(Object.keys(ratings).flatMap(stems));
  return Object.keys(ratings).filter(tag=>rateable(tag)&&tag.length<=70&&!/[<>@:/~]/.test(tag)&&normalize(tag)!==normalize(word)&&sharesHead(word,tag)&&relevant(coreOf(word).core,{tag:normalize(tag)},vocabulary)).slice(0,8);
};

export function addKeyword(value, word) {
  const tags=String(value??'').split(',').map(s=>s.trim()).filter(Boolean);
  if(!tags.some(tag=>normalize(tag)===normalize(word)))tags.push(word.trim());
  return tags.join(', ');
}
export async function relatedKeywords(word,{fetchImpl=fetch,signal}={}) {
  if(!rateable(word)||word.length>100||/[@:/<>]/.test(word))return [];
  const core=coreOf(word).core;
  const subject=core.split(/\s+/).at(-1);
  const url='https://api.datamuse.com/words?'+new URLSearchParams({ml:subject,topics:core,max:'24'});
  const response=await fetchImpl(url,{signal,credentials:'omit',referrerPolicy:'no-referrer'});
  if(!response.ok)throw new Error('Related words unavailable');
  const data=await response.json();
  if(!Array.isArray(data))throw new Error('Unexpected related words response');
  const seen=new Set([normalize(word)]);
  return data.filter(item=>typeof item.word==='string'&&item.word.length<=70&&rateable(item.word)&&!/[<>@:/]/.test(item.word))
    .map(item=>item.word.trim()).filter(tag=>sharesHead(word,tag)).filter(tag=>{const key=normalize(tag);if(seen.has(key))return false;seen.add(key);return true;}).slice(0,6);
}
