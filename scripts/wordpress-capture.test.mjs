// npm test  (node --test "scripts/**/*.test.mjs")
// The WordPress inventory reads every way a page shows a picture, and media:capture reports a
// gap for a picture that only a Jetpack slideshow shows. No network: planted pages only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { galleryIds, resolveIds, shownAndLinked } from './wordpress-lib.mjs';
import { postRecord } from './wordpress-inventory.mjs';
import { checkSite } from './wordpress-capture.mjs';

const SITE = 'reddymaekersproductions.wordpress.com';
const UP = `https://${SITE}/wp-content/uploads`;
const BS = String.fromCharCode(92);
// how Jetpack writes an address inside data-gallery: JSON-escaped slashes, HTML-escaped quotes
const jsonUrl = (u) => u.split('/').join(`${BS}/`);
const q = '&quot;';
const slideshow = (pictures) => `<p class="jetpack-slideshow-noscript robots-nocontent">This slideshow requires JavaScript.</p>`
  + `<div id="gallery-9001-1-slideshow" class="jetpack-slideshow-window jetpack-slideshow" data-trans="fade" data-autostart="1" data-gallery="[`
  + pictures.map(([file, id]) => `{${q}src${q}:${q}${jsonUrl(`${UP}/${file}`)}${q},${q}id${q}:${q}${id}${q},${q}title${q}:${q}x${q},${q}itemprop${q}:${q}image${q}}`).join(',')
  + `]" itemscope itemtype="https://schema.org/ImageGallery"></div>`;
const PLANTED = slideshow([['2017/03/disco-teek-4.jpg', 990], ['2017/10/22555788_1_o.jpg', 1500]]);

test('a Jetpack slideshow shows the pictures in its data-gallery', () => {
  const r = shownAndLinked(`<p>A taste:</p>${PLANTED}`);
  assert.deepEqual(r.shown, ['2017/03/disco-teek-4.jpg', '2017/10/22555788_1_o.jpg']);
  assert.deepEqual(r.files, ['2017/03/disco-teek-4.jpg', '2017/10/22555788_1_o.jpg']);
  assert.deepEqual(r.ids, [990, 1500]);
  assert.deepEqual(r.linked, []);
});

test('an edited copy is the file shown, not its original (data-orig-file, src and srcset)', () => {
  const e = `${UP}/2017/08/img_9543-e1503570724129.jpg`;
  const html = `<a href="https://${SITE}/2017/08/24/photoshoot-flats/img_9543/"><img data-attachment-id="1240" data-orig-file="${e}" data-medium-file="${e}?w=233" `
    + `src="${e}?w=578&#038;h=745" alt="img_9543.jpg" srcset="${e}?w=578&amp;h=746 578w, ${e}?w=116&amp;h=150 116w, ${e} 1072w"></a>`;
  const r = shownAndLinked(html);
  assert.deepEqual(r.files, ['2017/08/img_9543-e1503570724129.jpg']);
  assert.deepEqual(r.shown, ['2017/08/img_9543.jpg']);
});

test('gallery and slideshow shortcodes and blocks name their pictures by id', () => {
  assert.deepEqual(galleryIds('[gallery columns="3" ids="11,12, 13"] [slideshow ids="14"] <!-- wp:jetpack/slideshow {"ids":[15,16]} -->'), [11, 12, 13, 14, 15, 16]);
  const posts = [{ shown: [], files: [], ids: [11, 99] }];
  resolveIds(posts, [{ id: 11, file: `${UP}/2014/05/stage-e1400000000001.jpg` }]);
  assert.deepEqual(posts[0].shown, ['2014/05/stage.jpg']);
  assert.deepEqual(posts[0].files, ['2014/05/stage-e1400000000001.jpg']);
});

const planted = (html) => postRecord(
  { ID: 9001, type: 'post', status: 'publish', slug: 'planted-slideshow', title: 'Planted', URL: `https://${SITE}/planted/`, content: html, featured_image: '' },
  { status: 200, body: `<html><body>${html}</body></html>` },
);
const ctx = (local) => ({
  data: { rmaekers: { posts: [{ id: '9001', slug: 'planted-slideshow', content: '', media: [] }] } },
  local: new Set(local),
  accounted: new Map(),
  checked: 'test',
});

test('media:capture reports a gap for a slideshow picture with no copy in the repo', async () => {
  const { gaps } = await checkSite({ key: 'rmaekers', site: SITE }, { posts: [planted(PLANTED)] }, [], ctx([]));
  assert.ok(gaps.some((g) => g.includes('planted-slideshow shows 2017/03/disco-teek-4.jpg')), gaps.join('\n'));
  assert.ok(gaps.some((g) => g.includes('planted-slideshow shows 2017/10/22555788_1_o.jpg')), gaps.join('\n'));
});

test('media:capture has no gap once the slideshow pictures are in the repo, and none for its uploads', async () => {
  const attachments = [990, 1500].map((id, i) => ({ id, file: `${UP}/${['2017/03/disco-teek-4.jpg', '2017/10/22555788_1_o.jpg'][i]}`, parent: 9001 }));
  const { gaps, row } = await checkSite({ key: 'rmaekers', site: SITE }, { posts: [planted(PLANTED)] }, attachments, ctx(['2017/03/disco-teek-4.jpg', '2017/10/22555788_1_o.jpg']));
  assert.deepEqual(gaps, []);
  assert.match(row, /\| 1 \| 1 \| 2 \| 2 \|/);
});
