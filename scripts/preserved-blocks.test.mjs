import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {segments} from '../src/lib/content.js';
import {preserveBlocks} from '../src/lib/preserved-blocks.js';
test('every archived post can pass through unchanged byte for byte', () => {
  for (const portfolio of ['rmaekers','rrproductions','vaguelyvulgar']) {
    const data = JSON.parse(fs.readFileSync(new URL(`../src/data/${portfolio}.json`,import.meta.url)));
    for (const post of data.posts) {
      const raw = post.content ?? '';
      const baseline = segments(raw).map((source,id)=>({id,source,signature:`normalized-${id}`}));
      const blocks = baseline.map(({id,signature})=>({id,signature,html:'normalized markup'}));
      assert.equal(preserveBlocks(raw,baseline,blocks),raw,`${portfolio}/${post.slug}`);
    }
  }
});
test('editing and moving blocks keeps untouched markup and never trusts a changed signature', () => {
  const baseline = [{id:'a',source:'<p class="keep">First</p>',signature:'First'}, {id:'b',source:'<p class="other">Second</p>',signature:'Second'}];
  assert.equal(preserveBlocks('original',baseline,[{id:'b',signature:'Second',html:'<p>Second</p>'},{id:'a',signature:'Changed',html:'<p>Changed</p>'}]),'<p class="other">Second</p>\n\n<p>Changed</p>');
  assert.equal(preserveBlocks('original',baseline,[{id:'a',signature:'forged',html:'<p>Safe replacement</p>'}]),'<p>Safe replacement</p>');
});
