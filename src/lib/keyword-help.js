import {normalize,rateable,compact,coreOf,stems,relevant} from './keyword-ratings.js';
const headOf=word=>stems(coreOf(word).core).at(-1)?.slice(0,4) ?? '';
const sharesHead=(a,b)=>{const head=headOf(a);return !!head && stems(coreOf(b).core).some(stem=>stem.slice(0,4)===head);};
export const relatedFromDesk=(word,ratings)=>{
  const vocabulary=new Set(Object.keys(ratings).flatMap(stems));
  return Object.keys(ratings).filter(tag=>rateable(tag)&&tag.length<=70&&!/[<>@:/~]/.test(tag)&&normalize(tag)!==normalize(word)&&sharesHead(word,tag)&&relevant(coreOf(word).core,{tag:normalize(tag)},vocabulary)).slice(0,8);
};

export function activeKeyword(value, caret=String(value).length) {
  const text=String(value ?? '');
  const at=Math.max(0,Math.min(text.length,caret ?? text.length));
  const start=text.lastIndexOf(',',at-1)+1;
  const next=text.indexOf(',',at);
  return text.slice(start,next<0?text.length:next).trim();
}
export function addKeyword(value, word) {
  const tags=String(value??'').split(',').map(s=>s.trim()).filter(Boolean);
  if(!tags.some(tag=>normalize(tag)===normalize(word)))tags.push(word.trim());
  return tags.join(', ');
}
export const trendsUrl=word=>'https://trends.google.com/trends/explore?'+new URLSearchParams({geo:'NL',date:'today 12-m',q:word});
export function interestText(rating) {
  if(!rating || typeof rating.views!=='number')return 'Topic interest: no measured data for this keyword.';
  const trend=rating.bing==null && typeof rating.trend==='number' && Number.isFinite(rating.trend) ? ` · topic trend ${rating.trend>=0?'↑':'↓'} ${Math.abs(Math.round(rating.trend*100))}%` : '';
  return `Topic interest${rating.approx?' (related topic)':''}: ${compact(rating.views)} Wikipedia readers / 30 days${rating.topic?` · ${rating.topic}`:''}${trend}`;
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

export function mountKeywordHelp({input,ratings={},updatedAt,onAdd}) {
  const make=(tag,text)=>{const el=document.createElement(tag);if(text)el.textContent=text;return el;};
  const root=make('section');root.className='keyword-help';root.setAttribute('aria-label','Keyword interest and related ideas');
  const heading=make('strong','Keyword help'),interest=make('p'),volume=make('p'),source=make('p'),link=make('a','Check Google Trends · Netherlands');
  link.target='_blank';link.rel='noopener noreferrer';
  const hint=make('p','Topic interest is not Google search volume or a prediction of ranking.');hint.className='hint';
  const related=make('div');related.className='keyword-related';
  const status=make('p');status.setAttribute('role','status');status.className='hint';
  source.className='hint';
  root.append(heading,interest,volume,link,hint,source,related,status);
  input.closest('label').after(root);
  const cache=new Map();let key='',timer,controller;
  const showRelated=words=>{
    related.replaceChildren();
    const selected=new Set(input.value.split(',').map(normalize));
    for(const word of words.filter(word=>!selected.has(normalize(word)))){
      const button=make('button',`Add ${word}`);button.type='button';button.addEventListener('click',()=>{
        input.value=addKeyword(input.value,word);onAdd(input.value);input.focus();input.setSelectionRange(input.value.length,input.value.length);refresh();
      });related.append(button);
    }
  };
  function refresh() {
    const word=activeKeyword(input.value,document.activeElement===input?input.selectionStart:input.value.length);
    heading.textContent=word?`Keyword: ${word}`:'Keyword help';
    const rating=ratings[normalize(word)];
    interest.textContent=word?interestText(rating):'Type a keyword to see available topic interest and related ideas.';
    if(rating?.title)interest.title=rating.title;else interest.removeAttribute('title');
    volume.textContent=word?(typeof rating?.bing==='number'?`Bing searches: ${rating.bing.toLocaleString('en')} · Netherlands, last 4 weeks`:'Search volume: not measured.') : '';
    const fetched=rating?.fetchedAt ?? updatedAt;
    source.textContent=word&&fetched?`Cached topic data · ${new Date(fetched).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}`:'';
    link.hidden=!word;link.href=trendsUrl(word);
    root.hidden=!input.closest('.piece-inputs') || input.closest('.piece-inputs').hidden;
    const next=normalize(word);
    if(next===key)return;
    key=next;clearTimeout(timer);controller?.abort();
    const deskWords=relatedFromDesk(word,ratings);
    const combine=words=>[...new Set([...deskWords,...words])].slice(0,6);
    showRelated(deskWords);
    if(!rateable(word)||word.length>100||/[@:/<>]/.test(word)){status.textContent='';return;}
    const cached=cache.get(next);
    if(cached){showRelated(combine(cached));status.textContent=combine(cached).length?'Related ideas · desk vocabulary and Datamuse. Not search-volume rankings.':'No related ideas found.';return;}
    status.textContent='Looking for related words…';
    timer=setTimeout(async()=>{
      const request=new AbortController();controller=request;const timeout=setTimeout(()=>request.abort(),8000);
      try {
        const words=await relatedKeywords(word,{signal:request.signal});
        cache.set(next,words);
        if(key!==next)return;
        showRelated(combine(words));status.textContent=combine(words).length?'Related ideas · desk vocabulary and Datamuse. Not search-volume rankings.':'No related ideas found. Google Trends can help compare your wording.';
      } catch {if(key===next)status.textContent=deskWords.length?'Related lookup unavailable; showing your desk vocabulary. Your keywords still save normally.':'Related lookup unavailable. Your keywords still save normally; Google Trends opens separately.';}
      finally{clearTimeout(timeout);}
    },650);
  }
  for(const event of ['input','keyup','click','focus'])input.addEventListener(event,refresh);
  return {refresh};
}
