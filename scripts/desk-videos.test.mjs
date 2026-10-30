import {articleFile} from './desk-articles.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import path from 'node:path';import {tmpdir} from 'node:os';
import {makeVideos} from './desk-videos.mjs';
import {uploadedVideoUrl} from '../src/lib/uploaded-video.js';
import {videoKey,videoFigure} from '../src/lib/article-video.js';
import {storyHtml} from '../src/lib/safe-output.js';
test('native video markers keep only trusted hosted paths through sanitizing and rendering',()=>{
 const url=uploadedVideoUrl('desk-uploads/abcdef0123456789abcdef01-clip.mp4','video/mp4'),key='file:'+url;
 assert.equal(videoKey(url),key);assert.match(storyHtml('<figure data-video="'+key+'"></figure>'),/data-video/);assert.match(videoFigure(key),/<video controls/);
 assert.equal(videoFigure('file:/portfolio/videos/../private.mp4'),'');assert.throws(()=>uploadedVideoUrl('../private','video/mp4'));
});
test('only referenced public-project videos get copied, drafts stay private, and repeated sends do nothing',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'desk-video-'));try{
 const originals=path.join(root,'originals'),pub=path.join(root,'public');mkdirSync(originals);
 const file='abcdef0123456789abcdef01-clip.mp4',video={path:'desk-uploads/'+file,name:'clip.mp4',type:'video/mp4'};
 const bytes=Buffer.from([0,0,0,16,102,116,121,112,105,115,111,109,0,0,0,0]);writeFileSync(path.join(originals,file),bytes);
 const url=uploadedVideoUrl(video.path,video.type),piece={content:'<figure data-video="file:'+url+'"></figure>',videos:{v1:video}};
 const state={projects:{'rmaekers/one':piece,'rmaekers/private':piece},articles:{draft:{...piece,status:'draft'}}};
 assert.equal(makeVideos(state,{},originals,pub,new Set()),0);assert.ok(!existsSync(pub));
 assert.equal(makeVideos(state,{},originals,pub,new Set(['rmaekers/one'])),1);assert.deepEqual(readFileSync(path.join(pub,'videos',url.split('/').pop())),bytes);
 assert.equal(makeVideos(state,{},originals,pub,new Set(['rmaekers/one'])),0);
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('article publishing retains native video bodies and native banner keys',()=>{
 const key='file:/portfolio/videos/abcdef0123456789abcdef01.mp4';
 const text=articleFile('a1',{title:'A video project',summary:'An account of the process and the finished installation.',kind:'story',status:'ready',created:1,at:1,bannerVideo:key,content:'<p>Before.</p><figure data-video="'+key+'"></figure><p>After.</p>'});
 assert.match(text,/bannerVideo: "file:\/portfolio\/videos\//);assert.match(text,/<video controls/);assert.match(text,/Before\./);assert.match(text,/After\./);
});
