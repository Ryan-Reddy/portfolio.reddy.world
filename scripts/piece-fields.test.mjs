import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CRAFTS, craftOf, articleCraft, pieceTags, publicationDay} from '../src/lib/piece-fields.js';
import {articleFile} from './desk-articles.mjs';
import {applyDesk} from './import-image-keywords.mjs';
import {renderContent} from '../src/lib/content.js';
test('crafts are a closed vocabulary, with related-case and kind defaults', () => {
  assert.equal(Object.keys(CRAFTS).length, 7);
  assert.equal(craftOf('random-new-craft'), undefined);
  assert.equal(articleCraft({kind:'interview'}), 'work');
  assert.equal(articleCraft({kind:'interview', related:'case'}, [{id:'case',branch:'art'}]), 'art');
  assert.equal(articleCraft({kind:'interview', craft:'signs',related:'case'}, [{id:'case',branch:'art'}]), 'signs');
});
test('publication dates reject impossible dates and tags are deduplicated without URLs', () => {
  assert.equal(publicationDay('2024-02-29'), '2024-02-29');
  for (const date of ['2023-02-29','2026-13-01','2026-04-31','not a date','2026-1-2']) assert.equal(publicationDay(date), undefined);
  assert.deepEqual(pieceTags('Light, light, Stages, https://example.com'), ['Light','Stages']);
});
test('Send to site keeps article tags, craft and the chosen publication date', () => {
  const file = articleFile('stable', {kind:'story', title:'A story', content:'<p>Words.</p>', summary:'A summary long enough for the article publication requirements.', tags:'Light, Stages', craft:'signs', published:'2020-05-12', created:Date.UTC(2026,9,29)});
  assert.match(file,/craft: signs/);
  assert.match(file,/tags: \["Light","Stages"\]/);
  assert.match(file,/published: 2020-05-12/);
});
test('project metadata changes preserve its source text and invalid fields never overwrite the site', () => {
  const post = {slug:'piece',title:'Original',published:'2020-01-01T00:00:00Z',date:'2020-01-01 00:00:00',content:'<p class="original">Untouched</p>',media:[],categories:[],tags:[]};
  const data = {rmaekers:{posts:[post]},rrproductions:{posts:[]},vaguelyvulgar:{posts:[]}};
  applyDesk({projects:{'rmaekers/piece':{title:'New title',tags:'Light',craft:'signs',published:'2021-06-02'}},images:{}}, data);
  assert.equal(post.edited_title,'New title'); assert.equal(post.craft,'signs'); assert.equal(post.published,'2021-06-02T00:00:00Z');
  assert.equal(post.content,'<p class="original">Untouched</p>'); assert.equal(post.edited_content,undefined);
  applyDesk({projects:{'rmaekers/piece':{craft:'random',published:'2026-02-30'}},images:{}},data);
  assert.equal(post.craft,'signs'); assert.equal(post.published,'2021-06-02T00:00:00Z');
});
test('a project video marker becomes a click-to-load player and a video link stays a link', () => {
  assert.match(renderContent('<figure data-video="youtube:dQw4w9WgXcQ"></figure>'),/data-player=/);
  assert.doesNotMatch(renderContent('<figure data-video="youtube:dQw4w9WgXcQ"></figure>'),/<iframe/);
  assert.doesNotMatch(renderContent('<p><a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">Video</a></p>'),/data-player=|<iframe/);
});
