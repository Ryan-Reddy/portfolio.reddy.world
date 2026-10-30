import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startingTags,nextToReview,rememberPlace,resumeCursor,samePlace} from '../src/lib/desk-progress.js';
import {mergeStates} from '../src/lib/desk-store.js';
const projects=['a','b','c','d'].map(id=>({id,images:[{key:id+'1',url:id+'.jpg'}],done:false}));
const flat=projects.map(project=>({project,image:project.images[0]}));
test('original tags/categories start selected, while published edits and empty choices win',()=>{
 assert.deepEqual(startingTags({tags:['Light','stage'],categories:['light','Uncategorized','Festival']}),['light','stage','Festival']);
 assert.deepEqual(startingTags({keywords:['Custom'],tags:['Old']}),['Custom']);assert.deepEqual(startingTags({keywords:[],tags:['Old']}),[]);
});
test('next review skips reviewed projects and prefers untouched work before in-progress work',()=>{
 const state={projects:{b:{reviewed:true},c:{title:'Edited',at:10}},images:{}};
 assert.equal(nextToReview(projects,state,0),3);state.projects.d={reviewed:true};assert.equal(nextToReview(projects,state,0),0);
 state.projects.a={title:'Edited',at:11};assert.equal(nextToReview(projects,state,0),2);
});
test('all-reviewed completes without returning to the first twenty projects',()=>{
 const state={projects:Object.fromEntries(projects.map(p=>[p.id,{reviewed:true}]))};assert.equal(nextToReview(projects,state,2),null);
 assert.equal(nextToReview([{...projects[0],done:true}],{projects:{a:{reviewed:false}}},0),0);
});
test('saved position follows the item across inserted images and falls back within its project',()=>{
 const state={cursor:2,article:null};rememberPlace(state,flat,100);
 assert.equal(resumeCursor([flat[0],flat[0],...flat.slice(1)],state),3);
 assert.equal(resumeCursor([{...flat[2],image:{key:'replacement'}}],state),0);
 assert.equal(resumeCursor(flat,{cursor:1}),1);
});
test('navigation merges independently from edit timestamps and restores the selected article',()=>{
 const local={cursor:3,savedAt:10,place:{projectId:'d',imageKey:'d1',articleId:'draft',at:30},projects:{d:{title:'Local',at:10}}};
 const remote={cursor:0,savedAt:20,place:{projectId:'a',imageKey:'a1',at:15},projects:{a:{title:'Remote',at:20}}};
 const merged=mergeStates(local,remote);assert.equal(merged.cursor,3);assert.equal(merged.article,'draft');assert.equal(merged.projects.a.title,'Remote');
 assert.ok(samePlace(local,merged));assert.ok(samePlace(local,{...local,place:{...local.place,at:500}}));assert.ok(!samePlace(local,remote));
});

test('legacy edits without timestamps are still in-progress, not untouched work',()=>{
 assert.equal(nextToReview(projects,{projects:{b:{tags:'already edited'}}},0),2);
});
