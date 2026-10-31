import test from 'node:test';
import assert from 'node:assert/strict';
import {activeKeyword,addKeyword,interestText,trendsUrl,relatedKeywords,relatedFromDesk,mountKeywordHelp} from '../src/lib/keyword-help.js';
import {JSDOM} from 'jsdom';

test('keyword feedback follows the caret and adding an idea preserves existing tags',()=>{
  assert.equal(activeKeyword('signage, light installations',3),'signage');
  assert.equal(activeKeyword('signage, light installations',15),'light installations');
  assert.equal(activeKeyword('signage, '),'');
  assert.equal(addKeyword('Signage, Amsterdam','signage'),'Signage, Amsterdam');
  assert.equal(addKeyword('signage','digital signage'),'signage, digital signage');
  const url=new URL(trendsUrl('signage & light'));
  assert.equal(url.searchParams.get('geo'),'NL');assert.equal(url.searchParams.get('q'),'signage & light');
});
test('topic interest remains distinct from search volume and unknown keywords are not rated zero',()=>{
  assert.match(interestText(undefined),/no measured data/);
  assert.match(interestText({views:12340,trend:.42,bing:null}),/12k Wikipedia readers.*topic trend ↑ 42%/);
  assert.match(interestText({views:120,approx:true}),/related topic/);
  assert.match(interestText({views:120,approx:true,topic:'Digital signage'}),/Digital signage/);
  assert.ok(!interestText({views:120,trend:.42,bing:40}).includes('42%'));
});
test('related lookup uses the subject, omits credentials and filters unrelated meanings and duplicates',async()=>{
  let request;
  const fetchImpl=async(url,options)=>{request={url:new URL(url),options};return {ok:true,json:async()=>[{word:'barbarism',score:90000},{word:'signpost',score:3},{word:'signpost'},{word:'signage'},{word:'<img src=x>'},{word:'digital signage'}]};};
  assert.deepEqual(await relatedKeywords('custom signage',{fetchImpl}),['signpost','signage','digital signage']);
  assert.equal(request.url.searchParams.get('ml'),'signage');
  assert.equal(request.options.credentials,'omit');
  assert.deepEqual(await relatedKeywords('owner@example.com',{fetchImpl:()=>{throw Error('should not fetch');}}),[]);
  assert.deepEqual(relatedFromDesk('custom signage',{'digital signage':{},'ice cream':{},'custom signage':{}}),['digital signage']);
  assert.deepEqual(relatedFromDesk('custom signage',{'signage design':{},'internet sign':{},'sign hand':{},'needs wrk ~ koupe calorie neutrale ijsbar':{}}),['signage design']);
  await assert.rejects(()=>relatedKeywords('signage',{fetchImpl:async()=>({ok:false})}),/unavailable/);
});
test('inline feedback adds a related tag through the shared save action and tolerates API failure',async()=>{
  const dom=new JSDOM('<div class="piece-inputs"><label>Tags<input value="custom signage"></label></div>');
  const before={document:globalThis.document,fetch:globalThis.fetch};
  globalThis.document=dom.window.document;globalThis.fetch=async()=>{throw Error('offline');};
  try{
    const input=document.querySelector('input');let saved;
    const help=mountKeywordHelp({input,ratings:{'custom signage':{views:1200,bing:null},'digital signage':{}},onAdd:value=>saved=value});
    help.refresh();
    assert.match(document.querySelector('.keyword-help').textContent,/Search volume: not measured/);
    document.querySelector('.keyword-related button').click();
    assert.equal(saved,'custom signage, digital signage');
    // Unavailable external suggestions must not clear or block the owner's tags.
    await new Promise(resolve=>setTimeout(resolve,720));
    assert.match(document.querySelector('[role="status"]').textContent,/unavailable/);
    assert.equal(input.value,'custom signage, digital signage');
  }finally{globalThis.document=before.document;globalThis.fetch=before.fetch;dom.window.close();}
});
