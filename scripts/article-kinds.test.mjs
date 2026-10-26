// npm test  (node --test "scripts/**/*.test.mjs"): where each kind of article lives
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KINDS, KIND_IDS, articlePath, articleImages } from '../src/lib/article-kinds.js';

test('every kind has its own folder under /portfolio/ and a label for the wall', () => {
  assert.deepEqual(KIND_IDS, ['interview', 'story', 'case-study', 'project', 'recipe', 'writing', 'poem']);
  const paths = Object.values(KINDS).map((k) => k.path);
  assert.equal(new Set(paths).size, paths.length);
  // never a folder the archive or the app already uses
  for (const taken of ['rmaekers', 'rrproductions', 'vaguelyvulgar', 'software', 'theme', 'image-metadata', 'vault']) assert.ok(!paths.includes(taken), taken);
  for (const kind of Object.values(KINDS)) assert.ok(kind.label);
});

test('an interview keeps the address it was first shared at', () => {
  assert.equal(articlePath('interview', 'fenne-roefs-mijksenaar'), 'interviews/fenne-roefs-mijksenaar/');
  assert.equal(articleImages('fenne-roefs-mijksenaar'), 'articles/fenne-roefs-mijksenaar');
});
