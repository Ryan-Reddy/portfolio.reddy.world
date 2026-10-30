import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {textImageLinks,placeTextImages,imageLink} from '../src/lib/text-media.js';
import {labelSourceLinks} from '../src/lib/source-links.js';
import {recoverTextImages,trustedImageHost} from './text-media.mjs';
import {rightsOf} from '../src/lib/image-rights.js';

const image = 'https://i0.wp.com/amsterdamtoday.eu/wp-content/uploads/2018/04/koupe1.jpg?ssl=1';
test('recognises linked and plain images, deduplicates, preserves prose and existing indices', () => {
  const input = `<figure data-media="0"></figure>\n\n<p>Our sign closeup.<br><a href="${image}">${image}</a><br>${image}</p>`;
  assert.deepEqual(textImageLinks(input),[image]);
  const result = placeTextImages(input,[{url:'/portfolio/existing.jpg'},{source_url:image}]);
  assert.equal((result.match(/data-media="1"/g)||[]).length,1);
  assert.match(result, /Our sign closeup/);
  assert.match(result, /data-media="0"/);
  assert.equal(placeTextImages(result,[{},{source_url:image}]),result);
  assert.equal(placeTextImages('  Words\n\n\nuntouched  ',[]),'  Words\n\n\nuntouched  ');
  assert.deepEqual(textImageLinks(`<p>See <a href="${image}">a photograph</a>.</p>`),[]);
});
test('unwraps Google image results without accepting pages or unsafe addresses', () => {
  assert.equal(imageLink('https://www.google.com/imgres?imgurl='+encodeURIComponent(image)),image);
  assert.equal(imageLink('https://lh3.googleusercontent.com/opaque-photo=s1200'),'https://lh3.googleusercontent.com/opaque-photo=s1200');
  for(const value of ['javascript:alert(1)','https://user:pass@i0.wp.com/a.jpg','https://i0.wp.com:8443/a.jpg','https://www.instagram.com/p/abc/'])assert.equal(imageLink(value),null);
  assert.equal(trustedImageHost('https://i0.wp.com/a.jpg'),true);
  assert.equal(trustedImageHost('https://i0.wp.com.evil.test/a.jpg'),false);
  assert.equal(trustedImageHost('https://127.0.0.1/a.jpg'),false);
});
test('Instagram posts and profiles get clear source labels; named links stay intact', () => {
  assert.match(labelSourceLinks('https://www.instagram.com/p/BhbX9RjAW02/'),/>View original Instagram post<\/a>/);
  assert.match(labelSourceLinks('<p>https://www.instagram.com/koupe_protein_ice/</p>'),/Instagram: @koupe_protein_ice/);
  const named = '<a href="https://www.instagram.com/koupe_protein_ice/">Our client</a>';
  assert.equal(labelSourceLinks(named),named);
});
test('recovery saves images once, retains original history, and leaves broken links in place', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'desk-text-media-'));
  try {
    fs.mkdirSync(path.join(root,'src/data'),{recursive:true});
    const broken = 'https://i0.wp.com/example.com/missing.jpg';
    const post = {id:'test',slug:'test',published:'2018-05-30',content:`${image}\n${image}\n${broken}`,media:[]};
    for(const key of ['rmaekers','rrproductions','vaguelyvulgar'])fs.writeFileSync(path.join(root,`src/data/${key}.json`),JSON.stringify({posts:key==='rmaekers'?[post]:[]}));
    const buffer = await sharp({create:{width:10,height:20,channels:3,background:'#ccc'}}).jpeg().toBuffer();
    const fetchImage = async url => {if(url===broken)throw Error('404');return buffer;};
    assert.equal(await recoverTextImages(root,fetchImage),1);
    const file = path.join(root,'src/data/rmaekers.json');
    const saved = JSON.parse(fs.readFileSync(file)).posts[0];
    assert.equal(saved.content,post.content);
    assert.equal(saved.published,'2018-05-30');
    assert.equal(saved.media.length,1);
    assert.equal(saved.media[0].source_url,image);
    assert.equal(rightsOf(saved.media[0].url),'stamp');
    assert.match(saved.edited_content,/data-media="0"/);
    assert.ok(saved.edited_content.includes(broken));
    const first = fs.readFileSync(file,'utf8');
    assert.equal(await recoverTextImages(root,fetchImage),0);
    assert.equal(fs.readFileSync(file,'utf8'),first);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
