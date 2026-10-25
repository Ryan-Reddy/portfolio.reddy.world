// npm test  (node --test "scripts/**/*.test.mjs")
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyKeywords, isFileNameCaption, creditOf } from './import-image-keywords.mjs';

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

test('a caption that is only the file name, or a WordPress placeholder, never becomes alt text', () => {
  assert.equal(isFileNameCaption('37737598_881490635394957_8985423250859229184_o', '/x/2018/09/37737598_881490635394957_8985423250859229184_o.jpg'), true);
  assert.equal(isFileNameCaption('Vianen - By The Creek - Area 1 - Podium met toren v3[5146] fiinalsss-001', '/x/vianen-by-the-creek-area-1-podium-met-toren-v35146-fiinalsss-001.jpg'), true);
  assert.equal(isFileNameCaption('Enter a caption', '/x/img_5427.jpg'), true);
  assert.equal(isFileNameCaption('The Tropical stage by night', '/x/37361205_1804058373047016_o.jpg'), false);
  const data = archive();
  const before = JSON.stringify(media(data, 'vaguelyvulgar', 'photo-cv', SECOND));
  const exported = { version: 4, projects: { 'vaguelyvulgar/photo-cv': { tags: '' } }, images: {
    [`vaguelyvulgar/photo-cv::${SECOND}`]: { description: SECOND.split('/').pop().replace(/\.jpg$/, ''), keywords: [] },
  } };
  applyKeywords(exported, data);
  assert.equal(JSON.stringify(media(data, 'vaguelyvulgar', 'photo-cv', SECOND)), before);
});

test('pictures of a project Ryan never opened on the desk are left alone', () => {
  const data = archive();
  const before = JSON.stringify(media(data, 'vaguelyvulgar', 'photo-cv', FIRST));
  const report = applyKeywords({ version: 4, projects: {}, images: {
    [`vaguelyvulgar/photo-cv::${FIRST}`]: { description: 'A WordPress caption the desk only carried along', keywords: ['word'] },
  } }, data);
  assert.equal(JSON.stringify(media(data, 'vaguelyvulgar', 'photo-cv', FIRST)), before);
  assert.equal(report.skipped, 1);
  assert.equal(report.pictures, 0);
});

const credited = (projectCredit, images) => ({ version: 4, projects: { 'vaguelyvulgar/photo-cv': { tags: '', credit: projectCredit } }, images: Object.fromEntries(
  Object.entries(images).map(([url, credit]) => [`vaguelyvulgar/photo-cv::${url}`, { projectId: 'vaguelyvulgar/photo-cv', url, description: '', keywords: [], credit }]),
) });

test('the photographer of a picture wins over the one of its project; both become media.credit', () => {
  const data = archive();
  const report = applyKeywords(credited({ name: 'Project Photographer', url: 'https://project.example/' }, {
    [FIRST]: { name: '  Own   Photographer ', url: 'https://own.example/work' },
    [SECOND]: { name: '', url: '' },
  }), data);
  assert.deepEqual(media(data, 'vaguelyvulgar', 'photo-cv', FIRST).credit, { name: 'Own Photographer', url: 'https://own.example/work' });
  assert.deepEqual(media(data, 'vaguelyvulgar', 'photo-cv', SECOND).credit, { name: 'Project Photographer', url: 'https://project.example/' });
  assert.equal(report.credits, 2);
  // a credit alone is counted as credited, not as an updated picture
  assert.equal(report.pictures, 0);
  // the featured record of the same picture carries the same credit
  const post = data.vaguelyvulgar.posts.find((p) => p.slug === 'photo-cv');
  if (post.featured?.url === FIRST) assert.deepEqual(post.featured.credit, { name: 'Own Photographer', url: 'https://own.example/work' });
});

test('a site goes in only when it is an http(s) address', () => {
  assert.deepEqual(creditOf({ name: 'A', url: 'javascript:alert(1)' }), { name: 'A' });
  assert.deepEqual(creditOf({ name: 'A', url: 'www.example.com' }), { name: 'A' });
  assert.deepEqual(creditOf({ name: 'A', url: 'mailto:a@example.com' }), { name: 'A' });
  assert.deepEqual(creditOf({ name: 'A', url: 'http://example.com' }), { name: 'A', url: 'http://example.com/' });
  assert.equal(creditOf({ name: ' ', url: 'https://example.com/' }), undefined);
  assert.equal(creditOf(undefined), undefined);
});

test('no credit in the export never clears one the data has; twice changes nothing', () => {
  const data = archive();
  const exported = credited(undefined, { [FIRST]: { name: 'Own Photographer' } });
  applyKeywords(exported, data);
  assert.deepEqual(media(data, 'vaguelyvulgar', 'photo-cv', FIRST).credit, { name: 'Own Photographer' });
  const once = JSON.stringify(data);
  const report = applyKeywords(credited({ name: '' }, { [FIRST]: { name: '', url: '' } }), data);
  assert.equal(JSON.stringify(data), once);
  assert.equal(report.credits, 0);
  assert.equal(applyKeywords(exported, data).credits, 0);
  assert.equal(media(data, 'vaguelyvulgar', 'photo-cv', SECOND).credit, undefined);
});

test('a credit of a project Ryan never opened on the desk is left alone', () => {
  const data = archive();
  const report = applyKeywords({ version: 4, projects: {}, images: {
    [`vaguelyvulgar/photo-cv::${FIRST}`]: { credit: { name: 'Someone' } },
  } }, data);
  assert.equal(media(data, 'vaguelyvulgar', 'photo-cv', FIRST).credit, undefined);
  assert.equal(report.credits, 0);
});
