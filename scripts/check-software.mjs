// Checks the built software case studies and interviews the way a crawler sees them: the raw
// HTML, no JavaScript (reddy.world#135). Run after `npm run build`; fails with a list of problems.
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

for (const page of slugs.map((s) => `${s}/`)) {
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
  const want = /<img/.test(main) ? 150 : 100;
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

// The interviews (reddy.world#176): in their own language, and linked from the case study they were for
const interviews = existsSync(new URL('interviews/', DIST))
  ? readdirSync(new URL('interviews/', DIST), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  : [];
for (const slug of interviews) {
  const where = `interviews/${slug}/`;
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
  const lang = html.match(/<html lang="([^"]+)"/)?.[1];
  if (!lang) say('no <html lang>');
  else if (lang !== 'en' && !/<header class="site-header"[^>]*\slang="en"/.test(html)) say(`the page is lang="${lang}" but its English header is not marked lang="en"`);
  const questions = (html.match(/<h2[\s>]/g) ?? []).length;
  if (questions < 1) say('no questions (## headings)');

  let ld = [];
  try { ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => [JSON.parse(m[1])].flat()); } catch (e) { say(`JSON-LD does not parse: ${e.message}`); }
  const work = ld.find((x) => x['@type'] === 'CreativeWork');
  if (!work) say('no CreativeWork in the JSON-LD');
  else {
    if (work.author?.['@id'] !== PERSON_ID) say(`JSON-LD author is not ${PERSON_ID}`);
    if (work.inLanguage !== lang) say(`JSON-LD inLanguage "${work.inLanguage}" is not the page's "${lang}"`);
    if (!work.contributor?.name) say('JSON-LD names no interviewee (contributor)');
    const caseUrl = work.isPartOf?.url;
    if (!caseUrl) say('JSON-LD names no case study (isPartOf)');
    else if (!read(`${caseUrl.slice(SITE.length + 1)}index.html`).includes(`href="/portfolio/${where}"`)) say(`${caseUrl} does not link here`);
  }
  if (!ld.some((x) => x['@type'] === 'BreadcrumbList')) say('no BreadcrumbList');

  if (!sitemap.includes(`<loc>${SITE}/${where}</loc>`)) say('not in the sitemap');
  if (!llms.includes(`(${SITE}/${where})`)) say('not in llms.txt');
}

const overview = read('software/index.html');
if (!overview.includes('name="robots" content="noindex, follow"')) problems.push('software overview: not marked noindex');
if (!overview.includes('https://reddy.world/?at=work')) problems.push('software overview: does not hand off to the wall');
if (sitemap.includes(`<loc>${SITE}/software/</loc>`)) problems.push('software overview: redirect stub is still in the sitemap');

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
console.log(`check-software: wall handoff, ${slugs.length} case studies and ${interviews.length} interviews pass`);
