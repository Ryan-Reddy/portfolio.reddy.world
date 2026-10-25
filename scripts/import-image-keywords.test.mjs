// npm test  (node --test "scripts/**/*.test.mjs")
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyKeywords } from './import-image-keywords.mjs';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf-8'));
const sample = () => read('./fixtures/image-desk-export.sample.json');
const archive = () => Object.fromEntries(['rmaekers', 'rrproductions', 'vaguelyvulgar'].map((k) => [k, read(`../src/data/${k}.json`)]));
const media = (data, key, slug, url) => data[key].posts.find((p) => p.slug === slug).media.find((m) => m.url === url);
const FIRST = '/portfolio/images/vaguelyvulgar/2016/08/854b8538485967-57631dbc24357.jpg';
const SECOND = '/portfolio/images/vaguelyvulgar/2016/08/10150002_776022152408873_59738154_n.jpg';
const WATER = '/portfolio/images/rrproductions/2019/04/img_8865-1.jpg';

test('a written description becomes the alt text and the description; keywords are kept per picture', () => {
  const data = archive();
  applyKeywords(sample(), data);
  const m = media(data, 'vaguelyvulgar', 'photo-cv', FIRST);
  assert.equal(m.alt, 'A sample description typed on the desk');
  assert.equal(m.description, 'A sample description typed on the desk');
  assert.deepEqual(m.keywords, ['sample project word', 'second sample', 'sample picture word']);
  // the featured record of the same picture gets the same words
  const featured = data.vaguelyvulgar.posts.find((p) => p.slug === 'photo-cv').featured;
  assert.equal(featured.alt, 'A sample description typed on the desk');
});

test('keywords without a description fill an empty alt with the title and the keywords', () => {
  const data = archive();
  applyKeywords(sample(), data);
  const m = media(data, 'vaguelyvulgar', 'photo-cv', SECOND);
  assert.equal(m.alt, 'Modelling portfolio — sample project word, second sample');
  assert.equal(m.description, '');
});

test('project keywords go on the post, without duplicates in another case', () => {
  const data = archive();
  const report = applyKeywords(sample(), data);
  assert.deepEqual(data.vaguelyvulgar.posts.find((p) => p.slug === 'photo-cv').keywords, ['sample project word', 'second sample']);
  assert.equal(report.projects, 1);
});

test('an empty entry changes nothing, and an unknown picture is reported, not written', () => {
  const data = archive();
  const before = JSON.stringify(media(data, 'rrproductions', 'water-filtering', WATER));
  const report = applyKeywords(sample(), data);
  assert.equal(JSON.stringify(media(data, 'rrproductions', 'water-filtering', WATER)), before);
  assert.deepEqual(report.unmatched, ['rrproductions/no-such-project::/portfolio/images/rrproductions/2019/04/gone.jpg']);
  assert.equal(report.pictures, 2);
});

test('running the same export twice changes nothing the second time', () => {
  const data = archive();
  applyKeywords(sample(), data);
  const once = JSON.stringify(data);
  const report = applyKeywords(sample(), data);
  assert.equal(JSON.stringify(data), once);
  assert.equal(report.pictures, 0);
  assert.equal(report.projects, 0);
});

test('something that is not a version 4 export is refused', () => {
  assert.throws(() => applyKeywords({ version: 3, images: {} }, archive()), /version 3/);
  assert.throws(() => applyKeywords({}, archive()), /not an image desk export/);
});

test('the lead picture Ryan chose becomes the featured picture of the post; twice changes nothing', () => {
  const data = archive();
  const post = data.rmaekers.posts.find((p) => p.media.filter((m) => m.type === 'image').length > 1);
  const other = post.media.find((m) => m.type === 'image' && m.url !== post.featured?.url);
  const exported = { version: 4, projects: { [`rmaekers/${post.slug}`]: { hero: other.url } }, images: {} };
  const report = applyKeywords(exported, data);
  assert.equal(post.featured.url, other.url);
  assert.equal(post.featured.width, other.width);
  assert.equal(report.heroes, 1);
  assert.equal(applyKeywords(exported, data).heroes, 0);
});

test('a lead picture that is not in the post is reported, not written', () => {
  const data = archive();
  const post = data.rmaekers.posts[0];
  const before = JSON.stringify(post.featured);
  const report = applyKeywords({ version: 4, projects: { [`rmaekers/${post.slug}`]: { hero: '/portfolio/images/gone.jpg' } }, images: {} }, data);
  assert.equal(JSON.stringify(post.featured), before);
  assert.equal(report.unmatched.length, 1);
});
