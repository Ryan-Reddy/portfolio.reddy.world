import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {segments} from '../src/lib/content.js';
import {isPublicArchivePost,curatedPost} from '../src/lib/archive-curation.js';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{pretendToBeVisual:true,url:'http://localhost/'});
for(const name of ['Event','CustomEvent','window','document','navigator','HTMLElement','Element','Node','MutationObserver','DOMParser','getComputedStyle','requestAnimationFrame','cancelAnimationFrame']) Object.defineProperty(globalThis,name,{configurable:true,value:typeof dom.window[name]==='function' && ['getComputedStyle','requestAnimationFrame','cancelAnimationFrame'].includes(name)?dom.window[name].bind(dom.window):dom.window[name]});
globalThis.innerHeight=900; globalThis.innerWidth=1280;
dom.window.Range.prototype.getClientRects=()=>[];
dom.window.Range.prototype.getBoundingClientRect=()=>({top:0,left:0,right:0,bottom:0,width:0,height:0});
dom.window.HTMLElement.prototype.scrollIntoView=()=>{};
const {mountEditor,fromEditor,safeHref}=await import('../src/lib/desk-text.js');
await import('../src/lib/desk-editor.js');
const api=window.deskEditor;
const posts=['rmaekers','rrproductions','vaguelyvulgar'].flatMap(key=>JSON.parse(fs.readFileSync(new URL(`../src/data/${key}.json`,import.meta.url))).posts.filter(p=>isPublicArchivePost(key,p)).map(p=>({id:`${key}/${p.slug}`,content:curatedPost(key,p).content??''})));
test('edit-bar DOM mounting retains every public post unchanged and preserves untouched siblings after an edit',()=>{
  for(const post of posts){
    const root=document.createElement('div'); document.body.append(root);
    mountEditor(root,post.content,{});
    assert.equal(fromEditor(root),post.content,post.id);
    const extra=document.createElement('p'); extra.textContent='A new paragraph.'; root.append(extra);
    const changed=fromEditor(root);
    for(const piece of segments(post.content)) assert.ok(changed.includes(piece),`${post.id}: lost source piece`);
    root.remove();
  }
});
test('the real project editor retains all original pieces when adding media, and undo restores exact text',()=>{
  for(const post of posts){
    const root=document.createElement('div'); document.body.append(root);
    api.mount(root,{content:post.content,preserveSource:true,safeHref,change:()=>{},selection:()=>{},refused:()=>{},block:(kind,value)=>{const el=document.createElement('figure');el.dataset[kind]=value;return el;}});
    assert.equal(api.html(),post.content,`${post.id}: opening changed text`);
    api.insert('video','youtube:dQw4w9WgXcQ');
    const changed=api.html();
    for(const piece of segments(post.content)) assert.ok(changed.includes(piece),`${post.id}: adding media lost source piece`);
    assert.match(changed,/data-video="youtube:dQw4w9WgXcQ"/);
    api.run('undo');
    assert.equal(api.html(),post.content,`${post.id}: undo changed original`);
    api.destroy(); root.remove();
  }
});
test('an edited paragraph preserves an untouched class/link target on its sibling',()=>{
  const root=document.createElement('div');document.body.append(root);
  const raw='<p class="first">First.</p>\n\n<p class="keep"><a href="/page/" target="_blank" rel="noopener">Keep this link.</a></p>';
  mountEditor(root,raw,{});root.firstChild.textContent='Changed.';
  assert.ok(fromEditor(root).includes('<p class="keep"><a href="/page/" target="_blank" rel="noopener">Keep this link.</a></p>'));
  root.remove();
});

