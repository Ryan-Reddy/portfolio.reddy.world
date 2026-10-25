// Before the old WordPress.com sites go offline: what do they still publish, and
// is every public post and picture also in this repository?
//
//   node scripts/wordpress-capture.mjs            (a Markdown report on stdout)
//
// Reads each site's public posts and pages from the public WordPress.com API (no
// account or token; the media library itself is not public), takes every picture
// a post shows, links to, features or has attached, and looks each one up in
// src/data/<key>.json and on disk under public/. Nothing is written.
import { existsSync, readFileSync } from 'node:fs';

const SITES = [
  { key: 'rmaekers', site: 'reddymaekersproductions.wordpress.com' },
  { key: 'rrproductions', site: 'ryanvanlil.wordpress.com' },
  { key: 'maup', site: 'mbdekleermaeker.wordpress.com' },
  { key: 'vaguelyvulgar', site: 'vaguelyvulgar.wordpress.com' },
];
const ROOT = new URL('../', import.meta.url);
const UPLOAD = /https?:\/\/[^"'\s<>()]*(?:\.files\.wordpress\.com|\.wordpress\.com\/wp-content\/uploads|\.wp\.com\/[^"'\s<>]*?\/wp-content\/uploads)\/(\d{4})\/(\d{2})\/([^"'\s<>?#/]+)/gi;
const IMAGE = /\.(jpe?g|png|gif|webp)$/i;

/** One name per upload, whatever size or host WordPress served it at: 2016/07/img_0955.jpg */
function uploadKey(url) {
  UPLOAD.lastIndex = 0;
  const m = UPLOAD.exec(url) ?? /\/(\d{4})\/(\d{2})\/([^/?#]+)$/.exec(url ?? '');
  if (!m) return null;
  const file = decodeURIComponent(m[3]).toLowerCase().replace(/-\d+x\d+(?=\.[a-z]+$)/, '');
  return `${m[1]}/${m[2]}/${file}`;
}

const uploadsIn = (html) => [...String(html ?? '').matchAll(UPLOAD)].map((m) => m[0]);

async function wordpressPosts(site) {
  const fields = 'ID,type,status,URL,slug,title,content,featured_image,attachments';
  const posts = [];
  for (let page = 1; ; page++) {
    const url = `https://public-api.wordpress.com/rest/v1.1/sites/${site}/posts/?type=any&number=100&page=${page}&fields=${fields}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'reddy.world archive capture check' } });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    const data = await res.json();
    posts.push(...data.posts);
    if (posts.length >= data.found || !data.posts.length) return posts;
  }
}

function repoIndex(key) {
  const data = JSON.parse(readFileSync(new URL(`src/data/${key}.json`, ROOT), 'utf-8'));
  const local = new Map(); // upload key -> local file exists
  for (const post of data.posts) {
    for (const m of [post.featured, ...post.media].filter(Boolean)) {
      for (const u of [m.url, m.wp_url].filter(Boolean)) {
        const k = uploadKey(u);
        const onDisk = m.url.startsWith('/portfolio/') && existsSync(new URL(`public${m.url.slice('/portfolio'.length)}`, ROOT));
        if (k) local.set(k, local.get(k) || onDisk);
      }
    }
  }
  // anything in the posts' text that still points at WordPress
  const remoteInText = data.posts.flatMap((post) => uploadsIn(post.content).map((u) => ({ post, url: u })));
  const remoteMedia = data.posts.flatMap((post) => [post.featured, ...post.media].filter(Boolean)
    .filter((m) => /^https?:/.test(m.url)).map((m) => ({ post, url: m.url, type: m.type ?? 'image' })));
  return { data, local, remoteInText, remoteMedia };
}

const lines = [
  '| Source site | Public posts and pages on WordPress | Also in the repo | Pictures the posts show | Copied into the repo | Uploads attached but never shown | Copied into the repo |',
  '|---|---|---|---|---|---|---|',
];
const gaps = [];
const attachedOnly = [];
for (const { key, site } of SITES) {
  const wp = await wordpressPosts(site);
  const repo = repoIndex(key);
  const repoIds = new Set(repo.data.posts.map((p) => String(p.id)));
  const missingPosts = wp.filter((p) => !repoIds.has(String(p.ID)));

  // what a visitor sees (the text and the featured image) apart from what was only uploaded to a post
  const shown = new Map();
  const attached = new Map();
  for (const p of wp) {
    const featured = p.featured_image ? [[p.featured_image, 'featured image']] : [];
    for (const [u, how] of [...uploadsIn(p.content).map((u) => [u, 'text']), ...featured]) {
      const k = uploadKey(u);
      if (k && IMAGE.test(k) && !shown.has(k)) shown.set(k, { url: u.split('?')[0], post: p, how });
    }
  }
  for (const p of wp) {
    for (const a of Object.values(p.attachments ?? {}).filter((x) => /^image\//.test(x.mime_type))) {
      const k = uploadKey(a.URL);
      if (k && IMAGE.test(k) && !shown.has(k) && !attached.has(k)) attached.set(k, { url: a.URL, post: p });
    }
  }
  const missing = (map) => [...map].filter(([k]) => !repo.local.get(k));
  const shownMissing = missing(shown);
  const attachedMissing = missing(attached);
  lines.push(`| ${site} (\`${key}\`) | ${wp.length} | ${wp.length - missingPosts.length} | ${shown.size} | ${shown.size - shownMissing.length} | ${attached.size} | ${attached.size - attachedMissing.length} |`);

  for (const p of missingPosts) gaps.push(`- \`${key}\`: post ${p.ID} [${p.title}](${p.URL}) is not in src/data/${key}.json`);
  for (const [, { url, post, how }] of shownMissing) gaps.push(`- \`${key}\`: post ${post.ID} \`${post.slug}\` shows ${url} (${how === 'text' ? 'in its text' : 'as its featured image'}), which has no copy in the repo`);
  for (const { post, url, type } of repo.remoteMedia) gaps.push(`- \`${key}\`: the ${type} record in post ${post.id} \`${post.slug}\` still points at ${url}`);
  for (const { post, url } of repo.remoteInText) gaps.push(`- \`${key}\`: the text of post ${post.id} \`${post.slug}\` links to ${url}`);
  const perPost = new Map();
  for (const [, { post }] of attachedMissing) perPost.set(post, (perPost.get(post) ?? 0) + 1);
  for (const [post, n] of perPost) attachedOnly.push(`- \`${key}\`: ${n} in post ${post.ID} [\`${post.slug}\`](${post.URL})`);
}

console.log([
  ...lines,
  '',
  gaps.length ? `### Gaps: shown on WordPress or linked, not in the repo (${gaps.length})` : '### Gaps: none',
  '',
  ...gaps,
  '',
  `### Uploaded to a post but never shown, not in the repo (${attachedOnly.length} posts)`,
  '',
  ...attachedOnly,
].join('\n'));
