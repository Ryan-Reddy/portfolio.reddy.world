// npm test  (node --test "scripts/**/*.test.mjs")
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyKeywords, applyDesk, isFileNameCaption, creditOf } from './import-image-keywords.mjs';
import { fallbackAlt, isMachineAlt } from '../src/lib/alt-text.js';
import { curatedPost } from '../src/lib/archive-curation.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf-8'));
const sample = () => read('./fixtures/image-desk-export.sample.json');
// the modelling pictures as WordPress left them (no alt text, description or keywords), so
// these tests show what the importer does with a blank picture, whatever the data now carries
const blank = (data) => {
  const post = data.vaguelyvulgar.posts.find((p) => p.slug === 'photo-cv');
  for (const m of [...post.media, post.featured]) {
    Object.assign(m, { alt: '', description: '' });
    delete m.keywords;
  }
  // and the posts' own words, so the tests don't depend on what the desk has sent since
  for (const p of [post, data.rrproductions.posts.find((x) => x.slug === 'making-of-a-kaleidoscope')]) {
    delete p.keywords;
    delete p.summary;
    delete p.edited_content;
  }
  // a project with known words for the desk tests: lightsurface, five keywords on the post and its picture
  const light = data.rmaekers.posts.find((p) => p.slug === 'lightsurface-mk1-set');
  const words = ['vbx', 'Decor & stages', 'Light', 'custom props', 'dmx control'];
  light.keywords = [...words];
  for (const m of [...light.media.filter((x) => x.type === 'image'), light.featured].filter(Boolean)) m.keywords = [...words];
  delete light.summary;
  delete light.edited_content;
  return data;
};
const archive = () => blank(Object.fromEntries(['rmaekers', 'rrproductions', 'vaguelyvulgar'].map((k) => [k, read(`../src/data/${k}.json`)])));
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

test('keywords without a description fill an empty alt with the title, the place and the keywords', () => {
  const data = archive();
  applyKeywords(sample(), data);
  const m = media(data, 'vaguelyvulgar', 'photo-cv', SECOND);
  assert.equal(m.alt, 'Modelling portfolio, photo 2 — sample project word, second sample');
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
  const exported = { version: 4, projects: { [`rmaekers/${post.slug}`]: { hero: other.url, reviewed: true } }, images: {} };
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
  const report = applyKeywords({ version: 4, projects: { [`rmaekers/${post.slug}`]: { hero: '/portfolio/images/gone.jpg', reviewed: true } }, images: {} }, data);
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
  const exported = { version: 4, projects: { 'vaguelyvulgar/photo-cv': { tags: '', reviewed: true } }, images: {
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

const credited = (projectCredit, images) => ({ version: 4, projects: { 'vaguelyvulgar/photo-cv': { tags: '', reviewed: true, credit: projectCredit } }, images: Object.fromEntries(
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

test('file names in the shapes cameras, WordPress and Facebook give them are file names', () => {
  assert.equal(isFileNameCaption('IMG_6773', '/x/2018/10/img_6773-1.jpg'), true);
  assert.equal(isFileNameCaption('36772197_1004240556420936_8305567324182675456_n.jpg', '/x/2018/07/36772197_1004240556420936_8305567324182675456_n.jpg'), true);
  assert.equal(isFileNameCaption('DSC_0012', '/x/2019/01/dsc_0012-scaled.jpg'), true);
  assert.equal(isFileNameCaption('photo-1024x768.jpg', '/x/photo.jpg'), true);
  assert.equal(isFileNameCaption('beach-e1534567890', '/x/beach.jpg'), true);
  // shapes that are file names whatever the picture is called
  assert.equal(isFileNameCaption('IMG_4923.jpg', '/x/img_49232.jpg'), true);
  assert.equal(isFileNameCaption('fullsizeoutput_34a4', '/x/other.jpeg'), true);
  assert.equal(isFileNameCaption('20af1101-8636-4b14-a969-a98932f410f8', ''), true);
  assert.equal(isFileNameCaption('36772197_1004240556420936_8305567324182675456_n', ''), true);
  // words stay words
  assert.equal(isFileNameCaption('Street signs with led lighting', '/x/img_6773-1.jpg'), false);
  assert.equal(isFileNameCaption('Locker room - desperados', '/x/desperados-1_empty.jpg'), false);
});

test('an alt that is a file name, or one the importer wrote, is replaced; written words are kept', () => {
  const data = archive();
  const post = data.rmaekers.posts.find((p) => p.slug === 'beau-battant');
  const pic = post.media.find((m) => m.url.endsWith('/img_2615.jpg'));
  const kept = post.media.find((m) => m.url.endsWith('/img_2682.jpg'));
  pic.alt = 'IMG_2615';
  kept.alt = 'Behind the scenes camera angle positioning';
  const exported = { version: 4, projects: { 'rmaekers/beau-battant': { tags: 'beau battant, Beau Battant, https://example.com/a, music', reviewed: true } }, images: {
    [`rmaekers/beau-battant::${pic.url}`]: { description: '', keywords: ['Beau Battant', 'music', 'https://example.com/a', 'videoclip', 'art project'] },
    [`rmaekers/beau-battant::${kept.url}`]: { description: '', keywords: ['music'] },
  } };
  const report = applyKeywords(exported, data);
  const place = post.media.filter((m) => m.type === 'image' && m.duplicate_of === undefined).indexOf(pic) + 1;
  assert.equal(pic.alt, `Beau Battant, photo ${place} — music, videoclip, art project`);
  assert.equal(kept.alt, 'Behind the scenes camera angle positioning');
  assert.ok(report.dropped.includes('https://example.com/a'));
  assert.ok(!post.keywords.includes('https://example.com/a'));
  assert.equal(report.alts.length, 1);
  // the old fallback shape is the importer's too
  pic.alt = 'BEAU BATTANT — music, videoclip, art project';
  applyKeywords(exported, data);
  assert.equal(pic.alt, `Beau Battant, photo ${place} — music, videoclip, art project`);
});

test('a project not marked done on the desk is left alone: no keywords, no lead picture, no alt', () => {
  const data = archive();
  const post = data.rmaekers.posts.find((p) => p.slug === 'by-the-creek-festival');
  const before = JSON.stringify(post);
  const other = post.media.find((m) => m.type === 'image' && m.url !== post.featured?.url);
  const report = applyKeywords({ version: 4, projects: { 'rmaekers/by-the-creek-festival': { tags: 'Creek, Podium', hero: other.url } }, images: {
    [`rmaekers/by-the-creek-festival::${other.url}`]: { description: 'Words', keywords: ['Creek'] },
  } }, data);
  assert.equal(JSON.stringify(post), before);
  assert.equal(report.skipped, 1);
});

test('the fallback alt: title case for an all-capitals title, no keyword that is the title', () => {
  assert.equal(fallbackAlt('MERCHANDISE', 3, ['merchandise', 'brand activation', 'fun', 'shop', 'example']), 'Merchandise, photo 3 — brand activation, fun, shop');
  assert.equal(fallbackAlt('Tropical stage Vunzige Deuntjes Festival', 4, []), 'Tropical stage Vunzige Deuntjes Festival, photo 4');
  assert.equal(isMachineAlt('Merchandise, photo 3 — brand activation, fun, shop', '/x/95-3.jpeg', 'MERCHANDISE'), true);
  assert.equal(isMachineAlt('MERCHANDISE — brand activation, fun, shop', '/x/95-3.jpeg', 'MERCHANDISE'), true);
  assert.equal(isMachineAlt('Giant swings with cosmic swingers by ReddyMaekers.', '/x/a.jpg', 'Giant swings'), false);
});

// ---------- the desk itself (Send to site): only what Ryan changed, his value replaces the archive's ----------
const LIGHT = '/portfolio/images/rmaekers/2019/02/fullsizeoutput_34a4.jpeg';
const desk = (projects = {}, images = {}) => ({ projects, images, cursor: 0, session: 0 });
const post = (data, key, slug) => data[key].posts.find((p) => p.slug === slug);

test('the desk: a keyword Ryan removed goes from the post and its pictures; his picture words stay his', () => {
  const data = archive();
  const report = applyDesk(desk({ 'rmaekers/lightsurface-mk1-set': { tags: 'vbx, Light, light installation' } }), data);
  assert.deepEqual(post(data, 'rmaekers', 'lightsurface-mk1-set').keywords, ['vbx', 'Light', 'light installation']);
  assert.deepEqual(media(data, 'rmaekers', 'lightsurface-mk1-set', LIGHT).keywords, ['vbx', 'Light', 'light installation']);
  assert.equal(report.projects, 1);
  applyDesk(desk({}, { [`rmaekers/lightsurface-mk1-set::${LIGHT}`]: { tags: 'blue light' } }), data);
  assert.deepEqual(media(data, 'rmaekers', 'lightsurface-mk1-set', LIGHT).keywords, ['vbx', 'Light', 'light installation', 'blue light']);
});

test('the desk: blank fields (written by merely showing a project) change nothing', () => {
  const data = archive();
  const before = JSON.stringify(data);
  const report = applyDesk(desk({ 'rmaekers/lightsurface-mk1-set': { tags: '', reviewed: false, summary: ' ' } }, { [`rmaekers/lightsurface-mk1-set::${LIGHT}`]: { description: '', tags: '' } }), data);
  assert.equal(JSON.stringify(data), before);
  assert.equal(report.projects + report.pictures, 0);
});

test('the desk: projects not marked done are read too, and a summary is written as typed', () => {
  const data = archive();
  applyDesk(desk({ 'rmaekers/by-the-creek-festival': { summary: '  A stage   by the creek.  ' } }), data);
  assert.equal(post(data, 'rmaekers', 'by-the-creek-festival').summary, 'A stage by the creek.');
});

test('the desk: the post text is cleaned to the allowed tags and shown as it stands, without the curation again', () => {
  const data = archive();
  const p = post(data, 'rrproductions', 'making-of-a-kaleidoscope');
  const shown = curatedPost('rrproductions', p).content;
  applyDesk(desk({ 'rrproductions/making-of-a-kaleidoscope': { content: `<p class="x">New first line <a href="javascript:x()">no</a></p><script>bad()</script>\n\n${shown}` } }), data);
  assert.match(p.edited_content, /^<p>New first line <a>no<\/a><\/p>/);
  assert.doesNotMatch(p.edited_content, /script|ryanvanlil/);
  // the page shows the edited text; the cut (the materialenmix link) is not needed again and does not throw
  assert.equal(curatedPost('rrproductions', p).content, p.edited_content);
});

test('the desk: text that only differs in spacing from the page is not written; twice changes nothing', () => {
  const data = archive();
  const p = post(data, 'rmaekers', 'lightsurface-mk1-set');
  applyDesk(desk({ 'rmaekers/lightsurface-mk1-set': { content: `  ${curatedPost('rmaekers', p).content}\n\n` } }), data);
  assert.equal(p.edited_content, undefined);
  const state = desk({ 'rmaekers/lightsurface-mk1-set': { tags: 'vbx, Light', summary: 'Light set', hero: LIGHT, credit: { name: 'A. Photographer' } } }, { [`rmaekers/lightsurface-mk1-set::${LIGHT}`]: { description: 'Blue light over a crowd', tags: 'crowd' } });
  applyDesk(state, data);
  const once = JSON.stringify(data);
  const again = applyDesk(state, data);
  assert.equal(JSON.stringify(data), once);
  assert.equal(again.projects + again.pictures + again.heroes + again.credits + again.summaries + again.texts, 0);
});

test('the desk: a description becomes the alt text; a project credit reaches every picture', () => {
  const data = archive();
  applyDesk(desk({ 'vaguelyvulgar/photo-cv': { credit: { name: 'Studio Name', url: 'https://example.com' } } }, { [`vaguelyvulgar/photo-cv::${FIRST}`]: { description: 'Ryan in a white shirt' } }), data);
  const m = media(data, 'vaguelyvulgar', 'photo-cv', FIRST);
  assert.equal(m.alt, 'Ryan in a white shirt');
  assert.deepEqual(media(data, 'vaguelyvulgar', 'photo-cv', SECOND).credit, { name: 'Studio Name', url: 'https://example.com/' });
});

test('the desk: something that is not a desk is refused', () => {
  assert.throws(() => applyDesk({ version: 4, images: {} }, archive()), /not an image desk/);
});

test('the desk: a field cleared on purpose clears it on the site; a blank one does not', () => {
  const data = archive();
  applyDesk(desk({ 'rmaekers/lightsurface-mk1-set': { tags: '', cleared: ['tags'] } }), data);
  assert.deepEqual(post(data, 'rmaekers', 'lightsurface-mk1-set').keywords, []);
  assert.equal(media(data, 'rmaekers', 'lightsurface-mk1-set', LIGHT).keywords, undefined);
  applyDesk(desk({ 'rmaekers/lightsurface-mk1-set': { summary: 'Light set' } }), data);
  applyDesk(desk({ 'rmaekers/lightsurface-mk1-set': { summary: '', cleared: ['summary'] } }), data);
  assert.equal(post(data, 'rmaekers', 'lightsurface-mk1-set').summary, undefined);
});

test('the desk: a description that is only the post\'s own caption is not taken as Ryan\'s words', () => {
  const data = archive();
  const m = media(data, 'rmaekers', 'lightsurface-mk1-set', LIGHT);
  const before = JSON.stringify(m);
  const report = applyDesk(desk({}, { [`rmaekers/lightsurface-mk1-set::${LIGHT}`]: { description: m.alt } }), data);
  assert.equal(JSON.stringify(m), before);
  assert.equal(report.pictures, 0);
});

test('the desk: an early url-only record goes to the public projects with that picture, never to a hidden one', () => {
  const data = archive();
  const shared = data.rrproductions.posts.find((p) => String(p.id) === '229').media.find((m) => m.type === 'image' && data.rrproductions.posts.find((x) => String(x.id) === '227').media.some((y) => y.url === m.url));
  assert.ok(shared, 'a picture both posts hold');
  applyDesk(desk({}, { [shared.url]: { description: 'A chair connector, drawn in IronCAD' } }), data);
  const hidden = data.rrproductions.posts.find((p) => String(p.id) === '227').media.find((m) => m.url === shared.url);
  assert.equal(shared.description, 'A chair connector, drawn in IronCAD');
  assert.notEqual(hidden.description, 'A chair connector, drawn in IronCAD');
});

test('the desk: the lead picture keeps its own words in its featured copy', () => {
  const data = archive();
  const p = post(data, 'rrproductions', 'making-of-a-kaleidoscope');
  const pictures = p.media.filter((m) => m.type === 'image');
  const lead = pictures.find((m) => m.url !== p.featured?.url) ?? pictures[0];
  applyDesk(desk({ 'rrproductions/making-of-a-kaleidoscope': { tags: 'kaleidoscope', hero: lead.url } }, { [`rrproductions/making-of-a-kaleidoscope::${lead.url}`]: { tags: 'mirror' } }), data);
  assert.equal(p.featured.url, lead.url);
  assert.deepEqual(p.featured.keywords, ['kaleidoscope', 'mirror']);
  assert.deepEqual(lead.keywords, ['kaleidoscope', 'mirror']);
});
