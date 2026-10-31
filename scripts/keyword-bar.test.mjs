import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {demandScore,keywordChoices} from '../src/lib/keyword-scores.js';
import {mountKeywordBar} from '../src/lib/keyword-bar.js';
import {weeklyStats,fetchKeyword} from './keyword-search.mjs';
import {eligible} from '../.github/scripts/auto-publish-desk.mjs';
const now=Date.parse('2026-10-31T12:00:00Z'),day=86400000;
const entry=(recent,previous=30)=>({recent,previous,end:'2026-10-24'});
test('dated weekly counts require eight consecutive recent weeks and preserve observed zero',async()=>{
 const rows=Array.from({length:8},(_,i)=>({Date:`/Date(${now-(8-i)*7*day})/`,Impressions:i}));
 assert.deepEqual(weeklyStats(rows.toReversed(),now),{recent:22,previous:6,end:'2026-10-24',weeks:[0,1,2,3,4,5,6,7]});
 assert.equal(weeklyStats(rows.slice(1),now),null);
 assert.equal(weeklyStats(rows,now+15*day),null);
 assert.equal(weeklyStats(rows.map((r,i)=>({...r,Date:new Date(now-i*day).toISOString()})),now),null);
 assert.equal(weeklyStats([...rows.slice(0,7),rows[6]],now),null);
 assert.equal(weeklyStats(rows.map(r=>({...r,Impressions:0})),now).recent,0);
 const missing=await fetchKeyword('signage','test-key',{now,fetchImpl:async()=>({ok:true,json:async()=>({d:[]})})});
 assert.equal(missing.error,'no-recent-series');
});
test('demand is fixed-scale, fresh and measured; sparse baselines do not invent growth',()=>{
 assert.equal(demandScore(undefined,now),null);
 assert.equal(demandScore({...entry(100),end:'2026-09-01'},now),null);
 assert.equal(demandScore(entry(0),now).score,0);
 assert.equal(demandScore(entry(10000),now).score,100);
 assert.ok(demandScore(entry(100),now).score>demandScore(entry(10),now).score);
 assert.equal(demandScore(entry(50,10),now).change,null);
 assert.equal(demandScore(entry(50,25),now).change,1);
 assert.equal(demandScore(entry(50,0),now).newlyActive,true);
});
test('related choices favor measured demand; rising uses only reported growth and excludes saved tags',()=>{
 const data={keywords:{'signage':entry(20),'digital signage':entry(100,50),'shop signage':entry(60,100),'signage design':entry(50,0)}};
 const choices=keywordChoices('sign',data,['signage'],{now,extra:['sign making']});
 assert.equal(choices[0].word,'digital signage');
 assert.equal(choices.at(-1).metric,null);
 assert.deepEqual(keywordChoices('sign',data,['signage'],{now,rising:true}).map(c=>c.word),['signage design','digital signage']);
});
test('compact keyword bar adds and removes through saving, resets between pieces, and works offline',async()=>{
 const dom=new JSDOM('<label>Keywords<input value="Amsterdam"></label>');
 const before={document:globalThis.document,fetch:globalThis.fetch};
 globalThis.document=dom.window.document;globalThis.fetch=async()=>{throw Error('offline');};
 try{
  const input=document.querySelector('input');let saved,context='project:a';
  const end=new Date(Date.now()-7*day).toISOString().slice(0,10);
  const bar=mountKeywordBar({input,data:{keywords:{signage:{...entry(50,25),end}}},onAdd:value=>saved=value,getContext:()=>context});bar.refresh();
  const query=document.querySelector('[role=combobox]');
  assert.equal(document.querySelectorAll('a').length,0);
  assert.equal(document.querySelector('.keyword-explanation').hidden,true);
  assert.equal(document.querySelector('.keyword-popup').hidden,true);
  query.value='signage';query.dispatchEvent(new dom.window.Event('input'));
  assert.match(document.querySelector('.keyword-score').textContent,/\d+\/100.*↑100%/);
  await new Promise(resolve=>setTimeout(resolve,550));
  query.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  assert.equal(saved,'Amsterdam, signage');
  document.querySelector('[aria-label="Remove keyword signage"]').click();assert.equal(saved,'Amsterdam');
  query.value='unknown phrase';query.dispatchEvent(new dom.window.Event('input'));
  assert.equal(document.querySelector('.keyword-score').textContent,'—');
  document.querySelector('[aria-label="Add typed keyword"]').click();assert.equal(saved,'Amsterdam, unknown phrase');
  query.value='unsaved phrase';context='article:b';input.value='photography';bar.refresh();
  assert.equal(query.value,'');assert.equal(document.querySelector('.keyword-popup').hidden,true);
  assert.match(document.querySelector('.keyword-chips').textContent,/photography/);
 }finally{globalThis.document=before.document;globalThis.fetch=before.fetch;dom.window.close();}
});
test('automatic keyword publishing permits exactly its own dataset and owner branch',()=>{
 const repo='Ryan-Reddy/portfolio.reddy.world',pr={state:'open',draft:false,title:'Refresh keyword demand',user:{login:'Ryan-Reddy'},base:{ref:'main'},head:{ref:'desk/keyword-demand-123',repo:{full_name:repo}},changed_files:1};
 assert.equal(eligible(pr,repo,['src/data/keyword-search.json']),true);
 assert.equal(eligible(pr,repo,['src/data/other.json']),false);
 assert.equal(eligible({...pr,changed_files:2},repo,['src/data/keyword-search.json','src/lib/editor.js']),false);
 assert.equal(eligible({...pr,user:{login:'someone-else'}},repo,['src/data/keyword-search.json']),false);
 assert.equal(eligible({...pr,head:{...pr.head,ref:'desk/manual'}},repo,['src/data/keyword-search.json']),false);
});
