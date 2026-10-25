// Checks the built archive pages (dist/) for what PR #44 promised. Run after
// `npm run build`; fails with a list of problems.
//
//   node scripts/check-archive.mjs
//
// - No picture is loaded from WordPress: the old sites are going offline.
// - Every page that may be indexed has a title of its own.
// - Retired addresses (hidden posts, Maup) are no-index; no no-index page (those,
//   the wall hand-offs, the image desk) is in the sitemap.
// - Maup, kept in the repo but not Ryan's work, is in no page, feed or list.
// - No file anywhere in dist/ carries "ryanvanlil" (his former name, in the old WordPress addresses).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { isRetired } from '../src/lib/sitemap-images.js';

const DIST = new URL('../dist/', import.meta.url);
const SITE = 'https://reddy.world/portfolio';
const problems = [];
const read = (p) => readFileSync(new URL(p, DIST), 'utf-8');

const pages = [];
(function walk(dir) {
  for (const name of readdirSync(new URL(dir, DIST))) {
    const rel = `${dir}${name}`;
    if (statSync(new URL(rel, DIST)).isDirectory()) walk(`${rel}/`);
    else if (name === 'index.html') pages.push(dir);
  }
})('');

const sitemap = readdirSync(DIST).filter((f) => /^sitemap-\d+\.xml$/.test(f)).map(read).join('');
const titles = new Map();
const WORDPRESS = /(?:wordpress\.com|wp\.com)\//i;
let retired = 0;

for (const dir of pages) {
  const html = read(`${dir}index.html`);
  const say = (msg) => problems.push(`/portfolio/${dir}: ${msg}`);
  const noindex = /<meta name="robots" content="noindex/.test(html);
  const url = `${SITE}/${dir}`;

  for (const tag of html.match(/<(?:img|source)\b[^>]*>/g) ?? []) {
    if (WORDPRESS.test(tag)) say(`picture loaded from WordPress: ${tag.slice(0, 160)}`);
  }
  if (/maup|kleermaeker/i.test(html) && !noindex) say('mentions Maup');

  if (isRetired(url)) {
    retired++;
    if (!noindex) say('a retired address without noindex');
  }
  if (noindex) {
    if (sitemap.includes(`<loc>${url}</loc>`)) say('a no-index page in the sitemap');
    continue;
  }
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
  if (!title) say('no <title>');
  else if (titles.has(title)) say(`same title as /portfolio/${titles.get(title)}`);
  else titles.set(title, dir);
}

if (!existsSync(new URL('image-metadata/index.html', DIST))) problems.push('the image desk /portfolio/image-metadata/ was not built');
if (!existsSync(new URL('image-metadata/unused/index.html', DIST))) problems.push('the review page /portfolio/image-metadata/unused/ was not built');
else if (!/<meta name="robots" content="noindex/.test(read('image-metadata/unused/index.html'))) problems.push('/portfolio/image-metadata/unused/ is not no-index');
for (const file of ['rss.xml', 'llms.txt', 'software.json', ...readdirSync(DIST).filter((f) => /^sitemap-.*\.xml$/.test(f))]) {
  if (/maup|kleermaeker/i.test(read(file))) problems.push(`${file} mentions Maup`);
}

let files = 0;
(function walkAll(dir) {
  for (const name of readdirSync(new URL(dir, DIST))) {
    const rel = `${dir}${name}`;
    if (statSync(new URL(rel, DIST)).isDirectory()) { walkAll(`${rel}/`); continue; }
    files++;
    // read as bytes, so pictures and PDFs are searched too
    if (/ryanvanlil/i.test(readFileSync(new URL(rel, DIST)).toString('latin1'))) problems.push(`${rel} contains "ryanvanlil"`);
  }
})('');

if (problems.length) {
  console.error(`check-archive: ${problems.length} problems\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(`check-archive: ${pages.length} pages, ${titles.size} indexable titles all different, ${retired} retired addresses no-index and out of the sitemap, no WordPress pictures, no Maup, no "ryanvanlil" in ${files} files`);
