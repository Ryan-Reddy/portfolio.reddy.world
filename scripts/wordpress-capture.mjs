// Before the old WordPress.com sites go offline: is everything they still publish also
// in this repository? Exits 1 and lists every gap when something is missing.
//
//   npm run media:capture              (a Markdown report on stdout; about a minute)
//   npm run media:capture -- --probe   (also asks WordPress for every upload id again; 4 minutes)
//   npm run media:capture -- --fix     (first copies what is missing into archive/wordpress/)
//
// Reads each site's public posts and pages (and Jetpack portfolio items) and their full
// pages from the public WordPress.com API, no account. Checks, per site:
// - every public post and page has a record in src/data/<key>.json (or is covered by one)
// - every picture a page shows (text, featured image, theme) has a copy in the repo
// - every upload a page links to (a PDF, a full-size picture) has a copy, or a recorded decision
// - every embed (YouTube, Vimeo, VideoPress, Sketchfab, other players) is in the record's
//   text, and every video has a `videos` entry (title, channel, status, thumbnail on disk)
// - every upload in the media library that no page shows is accounted for, with its reason,
//   in src/data/wordpress-unused.json (scripts/wordpress-unused.mjs)
// Nothing is written, except with --fix: then a missing page's WordPress record goes to
// archive/wordpress/<key>/pages/<id>-<slug>.json and a missing file to
// archive/wordpress/<key>/<yyyy>/<mm>/<name>: documents and GIFs as WordPress serves them,
// still pictures like the rest of the archive (at most 2000 px, metadata stripped). archive/ is
// in the repo but not on the site. A file that carries the former surname is never copied.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { inventory } from './wordpress-inventory.mjs';
import { IMAGE, SITES, embedsIn, uploadKey, uploadPath } from './wordpress-lib.mjs';

const ROOT = new URL('../', import.meta.url);
const PROBE = process.argv.includes('--probe');
const FIX = process.argv.includes('--fix');
const FORMER_NAME = /van[\s_-]*lil/i;
const VIDEO_KINDS = new Set(['youtube', 'vimeo', 'videopress']);

// A public WordPress page whose words and pictures another record already holds
const COVERED = {
  rrproductions: {
    // Jetpack portfolio item "School Integral project 8": the same school cabinet, pictures and
    // drawing as post 397, which is in the archive
    123: '397',
  },
};
// Uploads deliberately not copied, with the decision
export const NOT_COPIED = {
  '2015/10/17-6-materialenmix-2.pdf': 'carries the former full name: not copied, link dropped (PR #44 decision 2, Ryan 2026-10-25)',
};

const readJson = (p) => JSON.parse(readFileSync(new URL(p, ROOT), 'utf-8'));
const onDisk = (url) => url?.startsWith('/portfolio/') && existsSync(new URL(`public${url.slice('/portfolio'.length)}`, ROOT));
const inArchive = (rel) => rel && existsSync(new URL(rel, ROOT));
const archived = (key, rel) => inArchive(`archive/wordpress/${key}/${rel}`);

/** --fix: keep a missing upload, as WordPress serves it, in archive/wordpress/<key>/ */
async function keep(key, rel, url) {
  if (!FIX || archived(key, rel)) return archived(key, rel);
  const res = await fetch(url, { headers: { 'User-Agent': 'reddy.world archive capture' } });
  if (!res.ok) return false;
  const buffer = Buffer.from(await res.arrayBuffer());
  if (FORMER_NAME.test(rel) || FORMER_NAME.test(buffer.toString('latin1'))) return false;
  const to = new URL(`archive/wordpress/${key}/${rel}`, ROOT);
  mkdirSync(new URL('./', to), { recursive: true });
  if (/\.(jpe?g|png|webp)$/i.test(rel)) {
    const image = sharp(buffer).rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true });
    const ext = rel.split('.').pop().toLowerCase();
    await (ext === 'png' ? image.png({ compressionLevel: 9 }) : ext === 'webp' ? image.webp({ quality: 82 }) : image.jpeg({ quality: 82, progressive: true, mozjpeg: true })).toFile(fileURLToPath(to));
  } else writeFileSync(to, buffer);
  return true;
}

// Every upload the repo keeps a copy of, from any source site's records (a page on one site
// sometimes shows a picture uploaded to another), and the copies kept but not served
const local = new Set();
const data = Object.fromEntries(SITES.map(({ key }) => [key, readJson(`src/data/${key}.json`)]));
for (const d of Object.values(data)) {
  for (const post of d.posts) {
    for (const m of [post.featured, ...post.media].filter(Boolean)) {
      if (onDisk(m.url) || inArchive(m.copy)) for (const u of [m.url, m.wp_url].filter(Boolean)) local.add(uploadKey(u));
    }
    for (const [, u] of String(post.content ?? '').matchAll(/"(\/portfolio\/(?:images|files)\/[^"]+)"/g)) if (onDisk(u)) local.add(uploadKey(u));
    for (const v of post.videos ?? []) if (onDisk(v.thumbnail)) local.add(`video:${v.kind}:${v.id}`);
  }
}
const unused = existsSync(new URL('src/data/wordpress-unused.json', ROOT)) ? readJson('src/data/wordpress-unused.json') : { sites: {} };
const accounted = new Map();
for (const [key, s] of Object.entries(unused.sites)) for (const u of s.uploads) {
  accounted.set(`${key}:${u.file}`, u);
  if (inArchive(u.copy)) local.add(uploadKey(`/${u.file}`));
}
const saved = readJson('src/data/wordpress-inventory.json');

const table = [
  '| Site | Public pages | In the repo | Pictures shown | Copied | Files linked | Copied or decided | Embeds | In the repo | Uploads no page shows | Accounted for |',
  '|---|---|---|---|---|---|---|---|---|---|---|',
];
const gaps = [];
for (const s of SITES) {
  const { key, site } = s;
  const live = await inventory(s, { probe: PROBE });
  const attachments = PROBE ? live.attachments : saved.sites[key]?.attachments ?? [];
  const records = new Map(data[key].posts.map((p) => [String(p.id), p]));
  const gap = (msg) => gaps.push(`- \`${key}\`: ${msg}`);
  const pub = live.posts.filter((p) => p.status === 'publish');

  let inRepo = 0;
  for (const p of pub) {
    const page = `pages/${p.id}-${p.slug}.json`;
    if (FIX && !records.has(String(p.id)) && !COVERED[key]?.[p.id] && !archived(key, page)) {
      const record = await (await fetch(`https://public-api.wordpress.com/rest/v1.1/sites/${site}/posts/${p.id}?fields=ID,type,status,slug,title,URL,date,modified,content,excerpt,featured_image`)).json();
      if (!FORMER_NAME.test(JSON.stringify(record))) {
        mkdirSync(new URL(`archive/wordpress/${key}/pages/`, ROOT), { recursive: true });
        writeFileSync(new URL(`archive/wordpress/${key}/${page}`, ROOT), `${JSON.stringify(record, null, 1)}
`);
      }
    }
    if (records.has(String(p.id)) || COVERED[key]?.[p.id] || archived(key, page)) inRepo++;
    else gap(`${p.type} ${p.id} [${p.title}](${p.url}) is not in src/data/${key}.json`);
    if (p.page_status !== 200) gap(`${p.url} answers ${p.page_status}`);
  }

  const shown = new Map();
  for (const p of pub) {
    for (const [k, how] of [...p.shown.map((k) => [k, 'in its text']), [uploadKey(p.featured), 'as its featured image'], ...p.theme.map((k) => [k, 'in the theme'])]) {
      if (k && IMAGE.test(k) && !shown.has(k)) shown.set(k, { p, how });
    }
  }
  let shownCopied = 0;
  for (const [k, { p, how }] of shown) {
    if (local.has(k) || await keep(key, uploadPath(p.urls[k]) ?? k, p.urls[k])) shownCopied++;
    else gap(`${p.slug} shows ${k} (${how}), which has no copy in the repo`);
  }

  // records (hidden posts too) whose picture or file still lives only on WordPress
  for (const post of data[key].posts) {
    for (const m of [post.featured, ...post.media].filter(Boolean)) {
      if (!/^https?:/.test(m.url) || local.has(uploadKey(m.url))) continue;
      if (!(await keep(key, uploadPath(m.url), m.url.split('?')[0]))) gap(`the ${m.type ?? 'image'} record in ${post.slug} still points at ${uploadPath(m.url)} on WordPress`);
    }
  }

  const linked = new Map();
  for (const p of pub) for (const k of p.linked) if (!shown.has(k) && !linked.has(k)) linked.set(k, p);
  let linkedOk = 0;
  for (const [k, p] of linked) {
    if (local.has(k) || NOT_COPIED[k] || await keep(key, uploadPath(p.urls[k]) ?? k, p.urls[k])) linkedOk++;
    else gap(`${p.slug} links to ${k}, which has no copy in the repo`);
  }

  let embeds = 0;
  let embedsOk = 0;
  for (const p of pub) {
    const record = records.get(String(COVERED[key]?.[p.id] ?? p.id));
    const have = new Set(embedsIn(record?.content).map((e) => `${e.kind}:${e.id}`));
    for (const e of [...p.embeds, ...p.page_embeds]) {
      if (e.kind === 'document') continue; // counted with the linked files
      embeds++;
      const id = `${e.kind}:${e.id}`;
      const video = record?.videos?.find((v) => v.kind === e.kind && v.id === e.id);
      if (!have.has(id) && !(e.kind === 'wordpress-video' && local.has(e.id))) gap(`${p.slug} embeds ${id} (${e.url}), which its record does not`);
      else if (VIDEO_KINDS.has(e.kind) && !video) gap(`${p.slug}: video ${id} has no \`videos\` entry (npm run media:videos)`);
      else if (VIDEO_KINDS.has(e.kind) && video.status === 'public' && !local.has(`video:${e.kind}:${e.id}`)) gap(`${p.slug}: video ${id} has no thumbnail on disk`);
      else embedsOk++;
    }
  }

  const notShown = attachments.filter((a) => !shown.has(uploadKey(a.file)) && !linked.has(uploadKey(a.file)));
  let ok = 0;
  for (const a of notShown) {
    const rel = decodeURIComponent(new URL(a.file).pathname).split('/').slice(-3).join('/').toLowerCase();
    if (accounted.has(`${key}:${rel}`) || local.has(uploadKey(a.file))) ok++;
    else gap(`upload ${a.id} ${rel} is shown nowhere and not in src/data/wordpress-unused.json (npm run media:unused)`);
  }
  table.push(`| ${site} | ${pub.length} | ${inRepo} | ${shown.size} | ${shownCopied} | ${linked.size} | ${linkedOk} | ${embeds} | ${embedsOk} | ${notShown.length}${PROBE ? '' : ` (as of ${saved.checked})`} | ${ok} |`);
}

console.log([
  ...table,
  '',
  gaps.length ? `### Gaps: on WordPress, not in the repo (${gaps.length})` : '### Gaps: none',
  '',
  ...gaps,
].join('\n'));
if (gaps.length) process.exit(1);
