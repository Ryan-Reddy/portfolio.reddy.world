import {test} from 'node:test';
import assert from 'node:assert/strict';
import {packState,unpackState,restoredState,publicationSnapshot} from '../src/lib/desk-history.js';
import {appendProjectPictures,resolveProjectPictures,projectPictureFolder} from '../src/lib/project-pictures.js';
import {pageLayout,bannerVideo} from '../src/lib/page-layout.js';
test('compressed versions round-trip Unicode and content without duplicating image bytes',async()=>{const state={projects:{one:{content:'<p>Résumé — '+('unchanged text '.repeat(3000))+'</p>'}},images:{p:{path:'desk-uploads/abc-image.jpg'}}};const packed=await packState(state);assert.ok(packed.length<JSON.stringify(state).length/4);assert.deepEqual(await unpackState(packed),state);});
test('restoring a version stamps clears and hides pictures added since that version',()=>{const current={projects:{one:{pictures:{pnew:{path:'desk-uploads/a.jpg'}}}},articles:{new:{title:'New draft'}}};const restored=restoredState(current,{projects:{one:{summary:'',content:''}},images:{},articles:{},wall:{}},123);assert.equal(restored.projects.one.at,123);assert.ok(restored.projects.one.cleared.includes('content'));assert.equal(restored.projects.one.pictures.pnew.removed,true);assert.equal(restored.articles.new.deleted,true);});
test('a project upload is appended once, keeps old media indices, resolves its stable marker, and can be restored',()=>{const data={rmaekers:{posts:[{slug:'one',title:'One',media:[{type:'video',url:'old'}]}]}};const state={projects:{'rmaekers/one':{pictures:{pabc:{name:'new.jpg'}}}},images:{}};const photos={'rmaekers/one':{pabc:{width:1000,height:800,srcset:'image.webp 1000w'}}};assert.equal(appendProjectPictures(state,data,photos),1);assert.equal(appendProjectPictures(state,data,photos),0);const media=data.rmaekers.posts[0].media;assert.equal(media[0].url,'old');assert.equal(resolveProjectPictures('<p>Keep.</p><figure data-picture="pabc"></figure>',media),'<p>Keep.</p><figure data-media="1"></figure>');state.projects['rmaekers/one'].pictures.pabc.removed=true;appendProjectPictures(state,data,photos);assert.equal(media[1].duplicate_of,-1);state.projects['rmaekers/one'].pictures.pabc.removed=false;appendProjectPictures(state,data,photos);assert.equal(media[1].duplicate_of,undefined);assert.throws(()=>projectPictureFolder('../outside'));});
test('layout settings reject arbitrary styles and unsafe video values',()=>{assert.equal(pageLayout('cover'),'cover');assert.equal(pageLayout(undefined),'cover');assert.equal(pageLayout('story'),'story');assert.equal(pageLayout('arbitrary'),'cover');assert.equal(bannerVideo('https://youtu.be/dQw4w9WgXcQ'),'youtube:dQw4w9WgXcQ');assert.equal(bannerVideo('javascript:alert(1)'),'');});
test('snapshots retain the effective source values so later public edits can be restored',()=>{const desk={state:{projects:{},images:{},articles:{}},DATA:{projects:[{id:'one',title:'Before',summary:'Original',keywords:['one'],content:'<p>Keep.</p>',images:[]}]}};const snapshot=publicationSnapshot(desk);assert.equal(snapshot.projects.one.title,'Before');assert.equal(snapshot.projects.one.summary,'Original');assert.equal(snapshot.projects.one.content,'<p>Keep.</p>');});

import {eligible} from '../.github/scripts/auto-publish-desk.mjs';
import {applyDesk} from './import-image-keywords.mjs';
import {articleFiles} from './desk-articles.mjs';
test('automatic publishing refuses code, forks, drafts and incomplete file inventories',()=>{
 const repo='Ryan-Reddy/portfolio.reddy.world';const pr={state:'open',draft:false,title:'Your desk changes',user:{login:'Ryan-Reddy'},base:{ref:'main'},head:{repo:{full_name:repo},ref:'desk/to-site-check'},changed_files:1};
 assert.equal(eligible(pr,repo,['src/data/wall.json']),true);assert.equal(eligible(pr,repo,['public/videos/abcdef0123456789abcdef01.mp4']),true);assert.equal(eligible(pr,repo,['public/videos/player.js']),false);
 assert.equal(eligible(pr,repo,['src/lib/desk-sync.js']),false);
 assert.equal(eligible({...pr,draft:true},repo,['src/data/wall.json']),false);
 assert.equal(eligible({...pr,changed_files:2},repo,['src/data/wall.json']),false);
 assert.equal(eligible({...pr,head:{repo:{full_name:'other/fork'},ref:'desk/to-site-check'}},repo,['src/data/wall.json']),false);
 assert.equal(eligible({...pr,user:{login:'other'}},repo,['src/data/wall.json']),false);
});
test('project and article layout choices survive the publishing importer',()=>{
 const data={rmaekers:{posts:[{slug:'one',title:'One',content:'<p>Original.</p>',media:[],keywords:[]}]}};
 applyDesk({projects:{'rmaekers/one':{pageLayout:'cover',bannerVideo:'youtube:dQw4w9WgXcQ',bannerFocus:'top'}},images:{}},data);
 assert.equal(data.rmaekers.posts[0].pageLayout,'cover');assert.equal(data.rmaekers.posts[0].bannerFocus,'top');
 const article={status:'ready',title:'Layout demonstration',summary:'An introduction with enough context to make a useful search description for this layout demonstration.',content:'<p>A short story about the project, with the page layout selected independently of its text and its image library.</p>',kind:'story',lang:'en',year:2026,created:Date.parse('2026-10-30'),pageLayout:'split',bannerVideo:'youtube:dQw4w9WgXcQ'};
 const result=articleFiles({articles:{a1:article}});
 assert.equal(result.waiting.length,0);assert.match(result.write[0].text,/pageLayout: split/);assert.match(result.write[0].text,/bannerVideo: "youtube:dQw4w9WgXcQ"/);
});
