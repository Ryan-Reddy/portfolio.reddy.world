// npm test  (node --test "scripts/**/*.test.mjs"): the desk's published articles as files (scripts/desk-articles.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import yaml from 'js-yaml';
import { articleFiles, articleFile, descriptionFrom, missing, slugFrom, deskIdOf } from './desk-articles.mjs';

const T = Date.parse('2026-10-26T10:00:00Z');
const story = { title: 'Street interviews for NIA', summary: 'What people on the street told me about getting around the city.', content: '<p>First paragraph.</p><h2>A question</h2><p>An answer <a href="javascript:x()">no</a>.</p>', kind: 'story', lang: 'en', year: 2023, status: 'ready', readyAt: T, at: T, created: T };
const frontOf = (text) => yaml.load(text.split(/^---\s*$/m)[1]);

test('a draft never leaves the desk; a ready one becomes a file with its fields and cleaned text', () => {
  const { write, remove } = articleFiles({ articles: { a1: { ...story, status: 'draft' }, a2: story } });
  assert.deepEqual(write.map((w) => w.slug), ['street-interviews-for-nia']);
  assert.deepEqual(remove, []);
  const front = frontOf(write[0].text);
  assert.equal(front.kind, 'story');
  assert.equal(front.title, 'Street interviews for NIA');
  assert.equal(front.description, 'What people on the street told me about getting around the city.');
  assert.equal(new Date(front.published).toISOString().slice(0, 10), '2026-10-26');
  assert.equal(front.desk, 'a2');
  assert.match(write[0].text, /<h2>A question<\/h2>/);
  assert.doesNotMatch(write[0].text, /javascript/);
});

test('the search description is his own words: a short summary takes the start of the text, cut at a word', () => {
  assert.equal(descriptionFrom('Short.', '<p>Then the text goes on for a while, long enough to fill a search result.</p>'), 'Short. Then the text goes on for a while, long enough to fill a search result.');
  assert.equal(descriptionFrom('', '<p>Too few.</p>'), null);
  assert.ok(descriptionFrom('x'.repeat(10) + ' ' + 'word '.repeat(60), '').length <= 160);
});

test('an interview needs its person; what is missing keeps it on the desk and is said', () => {
  const interview = { ...story, kind: 'interview' };
  assert.match(missing(interview).join(), /the person/);
  const { write, waiting } = articleFiles({ articles: { i1: interview } });
  assert.equal(write.length, 0);
  assert.equal(waiting[0].title, 'Street interviews for NIA');
  const full = { ...interview, byline: 'In conversation with', person: { name: 'A. Person', role: 'Researcher at Example', org: 'Example', orgUrl: 'https://example.com', profile: 'https://example.com/a' } };
  const front = frontOf(articleFile('i1', full));
  assert.deepEqual(front.person.roleLinks, { Example: 'https://example.com/' });
  assert.equal(front.person.profile, 'https://example.com/a');
});

test('back to draft or deleted takes its own file off the site; a file of another draft stays', () => {
  const existing = { 'street-interviews-for-nia': { desk: 'a2', text: 'x' }, 'other': { desk: 'zz', text: 'y' }, 'by-hand': { text: 'z' } };
  assert.deepEqual(articleFiles({ articles: { a2: { ...story, status: 'draft' } } }, existing).remove, ['street-interviews-for-nia']);
  assert.deepEqual(articleFiles({ articles: { a2: { deleted: true } } }, existing).remove, ['street-interviews-for-nia']);
});

test('an address another file has gets a number; the same draft sent twice writes nothing the second time', () => {
  const existing = { 'street-interviews-for-nia': { desk: 'other', text: 'x' } };
  const first = articleFiles({ articles: { a2: story } }, existing);
  assert.equal(first.write[0].slug, 'street-interviews-for-nia-2');
  const again = articleFiles({ articles: { a2: { ...story, slug: 'street-interviews-for-nia' } } }, { 'street-interviews-for-nia': { desk: 'a2', text: articleFile('a2', { ...story, slug: 'street-interviews-for-nia' }) } });
  assert.deepEqual(again.write, []);
  assert.equal(deskIdOf(articleFile('a2', story)), 'a2');
  assert.equal(slugFrom('Café Carter: terras & bar'), 'cafe-carter-terras-bar');
});
