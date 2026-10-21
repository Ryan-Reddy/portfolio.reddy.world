// Checks the built software case studies the way a crawler sees them: the raw HTML, no
// JavaScript (reddy.world#135). Run after `npm run build`; fails with a list of problems.
//
//   node scripts/check-software.mjs
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const DIST = new URL('../dist/', import.meta.url);
const SITE = 'https://reddy.world/portfolio';
const PERSON_ID = 'https://reddy.world/#ryan';
const problems = [];
const read = (p) => readFileSync(new URL(p, DIST), 'utf-8');
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

const slugs = readdirSync(new URL('software/', DIST), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
if (!slugs.length) problems.push('no case studies in dist/software/');
const sitemap = readdirSync(DIST).filter((f) => /^sitemap-\d+\.xml$/.test(f)).map(read).join('');
const llms = read('llms.txt');
const titles = new Map();

for (const page of ['', ...slugs.map((s) => `${s}/`)]) {
  const where = `software/${page}`;
  const html = read(`${where}index.html`);
  const say = (msg) => problems.push(`${where}: ${msg}`);

  const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
  if (!title) say('no <title>');
  else if (titles.has(title)) say(`same title as ${titles.get(title)}`);
  else titles.set(title, where);
  const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
  if (description.length < 50) say(`description missing or short (${description.length} characters)`);
  if (!html.includes(`<link rel="canonical" href="${SITE}/${where}">`)) say('no self canonical');
  const h1 = (html.match(/<h1[\s>]/g) ?? []).length;
  if (h1 !== 1) say(`${h1} <h1> elements, want 1`);
  const main = html.match(/<main[\s\S]*<\/main>/)?.[0] ?? '';
  const words = main.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  // a case study with no pictures on purpose (NIA: text only, reddy.world#126) is short too
  const want = !page ? 30 : /<img/.test(main) ? 150 : 100;
  if (words < want) say(`only ${words} words of main text in the raw HTML`);

  for (const img of html.match(/<img\b[^>]*>/g) ?? []) {
    const missing = ['alt', 'width', 'height', 'srcset'].filter((a) => !attr(img, a));
    if (missing.length) say(`<img src="${attr(img, 'src')}"> has no ${missing.join(', ')}`);
    for (const src of [attr(img, 'src'), ...(attr(img, 'srcset') ?? '').split(',').map((s) => s.trim().split(' ')[0])].filter(Boolean)) {
      if (!src.startsWith('/portfolio/')) continue;
      if (!existsSync(new URL(src.slice('/portfolio/'.length), DIST))) say(`picture not in the build: ${src}`);
    }
  }

  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  let ld = [];
  try { ld = blocks.flatMap((b) => [JSON.parse(b)].flat()); } catch (e) { say(`JSON-LD does not parse: ${e.message}`); }
  const main_ = ld.find((x) => ['SoftwareApplication', 'CreativeWork', 'CollectionPage'].includes(x['@type']));
  if (!main_) say('no SoftwareApplication, CreativeWork or CollectionPage in the JSON-LD');
  else if (main_.author?.['@id'] !== PERSON_ID) say(`JSON-LD author is not ${PERSON_ID}`);
  if (!ld.some((x) => x['@type'] === 'BreadcrumbList')) say('no BreadcrumbList');

  if (!sitemap.includes(`<loc>${SITE}/${where}</loc>`)) say('not in the sitemap');
  if (page && !llms.includes(`(${SITE}/${where})`)) say('not in llms.txt');
}

// software.json, which reddy.world's wall reads: every case study, each with its hero picture
try {
  const { apps } = JSON.parse(read('software.json'));
  for (const slug of slugs) {
    const app = apps.find((a) => a.slug === slug);
    if (!app) problems.push(`software.json: no entry for ${slug}`);
    else if (app.pictures.length && (!app.hero?.alt || !app.hero?.width)) problems.push(`software.json: ${slug} has no hero picture with alt and width`);
  }
} catch (e) {
  problems.push(`software.json: ${e.message}`);
}

if (problems.length) {
  console.error(`check-software: ${problems.length} problems\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`check-software: the overview and ${slugs.length} case studies pass`);
