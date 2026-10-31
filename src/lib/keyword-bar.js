import {addKeyword,relatedKeywords} from './keyword-help.js';
import {normalize} from './keyword-ratings.js';
import {demandScore,keywordChoices} from './keyword-scores.js';

export function mountKeywordBar({input,data={keywords:{}},onAdd,getContext=()=>''}) {
  const make=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
  const root=make('div');root.className='keyword-bar';input.hidden=true;
  const chips=make('div');chips.className='keyword-chips';
  const entry=make('div');entry.className='keyword-entry';
  const query=make('input');query.type='search';query.placeholder='Add a keyword…';query.autocomplete='off';query.setAttribute('aria-label','Add keyword');query.setAttribute('role','combobox');query.setAttribute('aria-autocomplete','list');query.setAttribute('aria-controls','keyword-options');
  const score=make('span','—');score.className='keyword-score';score.setAttribute('role','status');
  const info=make('button','ⓘ');info.type='button';info.setAttribute('aria-label','About keyword scores');info.setAttribute('aria-expanded','false');
  const explanation=make('p','Demand score: 0–100 from observed Bing Netherlands searches in the latest four reported weeks (logarithmic scale; 10,000+ = 100). The arrow compares the previous four weeks when there are at least 20 prior searches. New means the previous four weeks had no observed searches. Google searches and ranking difficulty are not included. — means no recent data.');explanation.className='keyword-explanation';explanation.hidden=true;
  info.onclick=()=>{open=false;explanation.hidden=!explanation.hidden;info.setAttribute('aria-expanded',String(!explanation.hidden));draw();};
  const add=make('button','+');add.type='button';add.setAttribute('aria-label','Add typed keyword');add.title='Add keyword';add.onclick=()=>{if(query.value.trim())choose(query.value.trim());};
  entry.append(query,score,add,info);
  const popup=make('div');popup.className='keyword-popup';popup.hidden=true;
  const modes=make('div');modes.className='keyword-sort';
  const demand=make('button','Demand'),risingButton=make('button','Rising');
  for(const button of [demand,risingButton]){button.type='button';modes.append(button);}
  const options=make('div');options.id='keyword-options';options.setAttribute('role','listbox');options.setAttribute('aria-label','Keyword suggestions');
  const message=make('p');message.className='hint';message.setAttribute('role','status');
  popup.append(modes,options,message);root.append(chips,entry,popup,explanation);input.closest('label').after(root);
  let expanded=false,rising=false,open=false,active=-1,choices=[],context=null,timer,request;
  const cache=new Map();let extras=[],pendingKey='';
  const selected=()=>input.value.split(',').map(s=>s.trim()).filter(Boolean);
  const describe=metric=>metric?`${metric.recent} observed Bing NL searches in 4 reported weeks, latest week dated ${metric.end}${metric.change===null?'':`; ${Math.round(metric.change*100)}% vs previous 4 weeks`}`:'No recent measured search data';
  function choose(word){input.value=addKeyword(input.value,word);query.value='';open=false;active=-1;extras=[];request?.abort();clearTimeout(timer);onAdd(input.value);refresh();query.focus();}
  function draw(){
    add.disabled=!query.value.trim();
    const metric=demandScore(data.keywords?.[normalize(query.value)]);score.textContent=metric?`${metric.score}/100${metric.change!=null?` ${metric.change>=0?'↑':'↓'}${Math.abs(Math.round(metric.change*100))}%`:metric.newlyActive?' New':''}`:'—';score.title=describe(metric);
    query.setAttribute('aria-expanded',String(open&&query.value.trim().length>=2));popup.hidden=!(open&&query.value.trim().length>=2);
    demand.setAttribute('aria-pressed',String(!rising));risingButton.setAttribute('aria-pressed',String(rising));
    choices=keywordChoices(query.value,data,selected(),{rising,extra:extras});
    if(active>=choices.length)active=-1;
    options.replaceChildren(...choices.map((item,i)=>{
      const button=make('button');button.type='button';button.className='keyword-option';button.id=`keyword-option-${i}`;button.setAttribute('role','option');button.setAttribute('aria-selected',String(i===active));button.title=describe(item.metric);
      const word=make('span',item.word),value=make('b',item.metric?String(item.metric.score):'—'),change=make('small',item.metric?.change!=null?`${item.metric.change>=0?'↑':'↓'}${Math.abs(Math.round(item.metric.change*100))}%`:item.metric?.newlyActive?'New':'');
      button.append(word,value,change);button.onmousedown=e=>e.preventDefault();button.onclick=()=>choose(item.word);return button;
    }));
    if(active>=0)query.setAttribute('aria-activedescendant',`keyword-option-${active}`);else query.removeAttribute('aria-activedescendant');
    message.textContent=choices.length?'':rising?'No rising terms with recent data.':'No match yet. Enter adds your wording.';
  }
  function refresh(){
    const next=getContext();if(next!==context){context=next;query.value='';expanded=false;open=false;active=-1;extras=[];pendingKey='';request?.abort();clearTimeout(timer);}
    const tags=selected();chips.replaceChildren();
    for(const word of expanded?tags:tags.slice(0,6)){
      const chip=make('span');chip.className='keyword-chip';const metric=demandScore(data.keywords?.[normalize(word)]);
      const name=make('span',word);chip.append(name);if(metric){const n=make('small',String(metric.score));n.title=describe(metric);chip.append(n);}
      const remove=make('button','×');remove.type='button';remove.setAttribute('aria-label',`Remove keyword ${word}`);remove.onclick=()=>{input.value=tags.filter(tag=>tag!==word).join(', ');onAdd(input.value);refresh();};chip.append(remove);chips.append(chip);
    }
    if(tags.length>6){const more=make('button',expanded?'Show fewer':`+${tags.length-6} more`);more.type='button';more.className='keyword-more';more.onclick=()=>{expanded=!expanded;refresh();};chips.append(more);}
    draw();
  }
  query.addEventListener('input',()=>{
    open=true;active=-1;extras=[];draw();clearTimeout(timer);request?.abort();const key=normalize(query.value);pendingKey=key;
    if(key.length<3)return;
    if(cache.has(key)){extras=cache.get(key);draw();return;}
    timer=setTimeout(async()=>{const controller=new AbortController();request=controller;const timeout=setTimeout(()=>controller.abort(),6000);
      try{const words=await relatedKeywords(key,{signal:controller.signal});cache.set(key,words);if(pendingKey===key){extras=words;draw();}}catch{/* The measured local library and saving keep working. */}finally{clearTimeout(timeout);}
    },500);
  });
  query.addEventListener('focus',()=>{open=true;draw();});
  query.addEventListener('keydown',event=>{
    if(event.key==='Escape'){open=false;draw();}
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();open=true;active=Math.max(0,Math.min(choices.length-1,active+(event.key==='ArrowDown'?1:-1)));draw();}
    if(event.key==='Enter'&&query.value.trim()){event.preventDefault();choose(active>=0&&choices[active]?choices[active].word:query.value.trim());}
  });
  root.addEventListener('focusout',()=>setTimeout(()=>{if(!root.contains(document.activeElement)){open=false;draw();}},0));
  demand.onclick=()=>{rising=false;active=-1;draw();};risingButton.onclick=()=>{rising=true;active=-1;draw();};
  return {refresh};
}
