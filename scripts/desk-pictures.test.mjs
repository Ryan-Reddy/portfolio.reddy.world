// npm test  (node --test "scripts/**/*.test.mjs"): web copies of the pictures in published articles (scripts/desk-pictures.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import yaml from 'js-yaml';
import { makePictures } from './desk-pictures.mjs';
import { articleFiles } from './desk-articles.mjs';

const T = Date.parse('2026-10-26T10:00:00Z');
const article = (over = {}) => ({
  title: 'Street interviews', summary: 'What people on the street told me about getting around the city.', status: 'ready', slug: 'street-interviews', readyAt: T, at: T, created: T,
  content: '<p>One.</p><figure data-picture="pb"></figure><p>Two.</p>',
  pictures: { pa: { path: 'desk-uploads/aaaaaaaaaaaaaaaa-front.jpg', name: 'front.jpg', alt: 'A street corner in Utrecht' }, pb: { path: 'desk-uploads/bbbbbbbbbbbbbbbb-face.png', name: 'face.png', alt: 'Someone answering, laughing' } },
  hero: 'pa',
  ...over,
});

async function setup() {
  const root = mkdtempSync(path.join(tmpdir(), 'desk-pictures-'));
  const originals = path.join(root, 'originals');
  const publicDir = path.join(root, 'public');
  const { mkdirSync } = await import('node:fs');
  mkdirSync(originals, { recursive: true });
  await sharp({ create: { width: 2400, height: 1600, channels: 3, background: '#c7a86d' } }).jpeg().toFile(path.join(originals, 'aaaaaaaaaaaaaaaa-front.jpg'));
  await sharp({ create: { width: 900, height: 600, channels: 3, background: '#335' } }).png().toFile(path.join(originals, 'bbbbbbbbbbbbbbbb-face.png'));
  return { root, originals, publicDir, dir: path.join(publicDir, 'images', 'articles', 'street-interviews') };
}

test('a published article\'s pictures become WebP at most 2000 px, with smaller copies and a link card for the lead', async () => {
  const { root, originals, publicDir, dir } = await setup();
  try {
    const state = { articles: { a1: article(), a2: { ...article(), status: 'draft', slug: 'draft-one' } } };
    const made = await makePictures(state, {}, originals, publicDir);
    assert.deepEqual(Object.keys(made), ['a1']);
    assert.deepEqual(readdirSync(dir).sort(), ['pa-1200w.webp', 'pa-480w.webp', 'pa-800w.webp', 'pa-share.jpg', 'pa.webp', 'pb-480w.webp', 'pb-800w.webp', 'pb.webp']);
    assert.equal(made.a1.pa.width, 2000);
    assert.equal((await sharp(path.join(dir, 'pa-share.jpg')).metadata()).width, 1200);
    assert.equal(made.a1.pb.src, '/portfolio/images/articles/street-interviews/pb.webp');
    // the article file: the lead across the top, the one in the text as the picture itself
    const { write } = articleFiles(state, {}, { photos: made });
    const text = write[0].text;
    const front = yaml.load(text.split(/^---\s*$/m)[1]);
    assert.deepEqual(front.hero, { file: 'pa.webp', alt: 'A street corner in Utrecht', share: 'pa-share.jpg' });
    assert.match(text, /<figure class="article-figure"><img src="\/portfolio\/images\/articles\/street-interviews\/pb\.webp" srcset="[^"]+" sizes="[^"]+" width="900" height="600" alt="Someone answering, laughing"/);
    // sending again changes nothing; a picture taken out of the article leaves the folder
    const before = readdirSync(dir).length;
    await makePictures(state, {}, originals, publicDir);
    assert.equal(readdirSync(dir).length, before);
    const fewer = { articles: { a1: article({ content: '<p>One.</p>', pictures: { pa: article().pictures.pa } }) } };
    await makePictures(fewer, {}, originals, publicDir);
    assert.ok(!existsSync(path.join(dir, 'pb.webp')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('an article whose picture has no description, or no copy yet, waits on the desk', () => {
  const noAlt = { articles: { a1: article({ pictures: { ...article().pictures, pa: { ...article().pictures.pa, alt: '' } } }) } };
  assert.match(articleFiles(noAlt, {}, { photos: {} }).waiting[0].missing.join(), /what every picture shows/);
  const notCopied = { articles: { a1: article() } };
  assert.match(articleFiles(notCopied, {}, { photos: { a1: {} } }).waiting[0].missing.join(), /copied from your account/);
});

test("a seeded draft's picture already in the repo needs no original from the account", async () => {
  const { root, originals, publicDir, dir } = await setup();
  try {
    const { mkdirSync } = await import('node:fs');
    mkdirSync(dir, { recursive: true });
    await sharp({ create: { width: 1600, height: 900, channels: 3, background: '#fc0' } }).webp().toFile(path.join(dir, 'pseed.webp'));
    const seeded = article({ content: '<p>One.</p>', pictures: { pseed: { src: '/portfolio/images/articles/street-interviews/pseed.webp', alt: 'Yellow signs' } }, hero: 'pseed' });
    const made = await makePictures({ articles: { a1: seeded } }, {}, originals, publicDir);
    assert.equal(made.a1.pseed.width, 1600);
    assert.ok(existsSync(path.join(dir, 'pseed-1200w.webp')));
    assert.ok(existsSync(path.join(dir, 'pseed-share.jpg')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
