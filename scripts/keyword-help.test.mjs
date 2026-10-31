import test from 'node:test';
import assert from 'node:assert/strict';
import {addKeyword,relatedKeywords,relatedFromDesk} from '../src/lib/keyword-help.js';

test('adding a keyword preserves existing tags and avoids duplicates',()=>{
 assert.equal(addKeyword('Signage, Amsterdam','signage'),'Signage, Amsterdam');
 assert.equal(addKeyword('signage','digital signage'),'signage, digital signage');
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
