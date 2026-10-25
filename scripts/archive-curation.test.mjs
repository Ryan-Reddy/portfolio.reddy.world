// npm test  (node --test "scripts/**/*.test.mjs")
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { curatedPost } from '../src/lib/archive-curation.js';

const read = (key) => JSON.parse(readFileSync(new URL(`../src/data/${key}.json`, import.meta.url), 'utf-8'));

test('every text the curation cuts is still in its post, so it really goes', () => {
  const post = read('rrproductions').posts.find((p) => String(p.id) === '218');
  const curated = curatedPost('rrproductions', post);
  assert.ok(!/ryanvanlil/i.test(curated.content));
});

test('a cut that is not found stops the build instead of leaving the words on the page', () => {
  const post = read('rrproductions').posts.find((p) => String(p.id) === '218');
  assert.throws(() => curatedPost('rrproductions', { ...post, content: 'other words' }), /text to cut not found/);
});

test('post 868 is titled Meghan Sile Catherina; its address stays', () => {
  const post = read('rmaekers').posts.find((p) => String(p.id) === '868');
  const curated = curatedPost('rmaekers', post);
  assert.equal(curated.title, 'Meghan Sile Catherina');
  assert.equal(curated.slug, 'meghan-sile-catherina');
});
