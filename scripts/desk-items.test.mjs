import test from 'node:test';
import assert from 'node:assert/strict';
import {allDeskItems,findDeskItems} from '../src/lib/desk-items.js';
const data={projects:[{id:'rmaekers/sign',title:'Old title',content:'<figure data-media="0"></figure>',keywords:['signage'],portfolio:'RMaekers'}],
  wallArticles:[{id:'live',desk:'a1',title:'Published title',kind:'Story',href:'/portfolio/stories/live/'},{id:'manual',title:'Magazine clipping',text:'Amsterdam interview',tags:['press'],href:'/portfolio/writing/manual/'}],kinds:{story:{label:'Story'}}};
test('one overview includes every draft and published article without duplicating its saved copy',()=>{
  const state={projects:{'rmaekers/sign':{title:'New shop sign'}},articles:{a1:{title:'Revised story',status:'ready'},a2:{title:'Natto',summary:'Fermentation',content:'<p>Soybeans</p>',status:'draft'},a3:{title:'',content:''},a4:{title:'Deleted draft',deleted:true}}};
  const items=allDeskItems(data,state);
  assert.equal(items.length,5);
  assert.equal(items.filter(i=>i.id==='a1').length,1);
  assert.ok(items.some(i=>i.title==='New shop sign'));
  assert.ok(items.some(i=>i.title==='Untitled article'));
  assert.ok(!items.some(i=>i.title==='Deleted draft'));
  assert.deepEqual(findDeskItems(items,{type:'article',status:'draft',query:'soybeans'}).map(i=>i.id),['a2']);
  assert.deepEqual(findDeskItems(items,{query:'AMSTERDAM press'}).map(i=>i.id),['manual']);
  assert.deepEqual(findDeskItems(items,{type:'project',status:'no-text'}).map(i=>i.id),['rmaekers/sign']);
});
test('published pieces remain findable when no private saved copy exists',()=>{
  const items=allDeskItems(data,{articles:{a1:{deleted:true}}});
  const published=findDeskItems(items,{type:'article',status:'published'});
  assert.equal(published.length,2);
  assert.equal(published.find(i=>i.id==='a1').href,'/portfolio/stories/live/');
  assert.equal(published.find(i=>i.id==='a1').editable,false);
  assert.equal(findDeskItems(items,{query:'nothing matches'}).length,0);
});
