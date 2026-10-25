// Everything the old WordPress.com sites still answer for without an account: every
// post and page (what it shows, links to and embeds, in its text and in its full page),
// and every upload with the post it was uploaded to.
//
//   node scripts/wordpress-inventory.mjs          writes src/data/wordpress-inventory.json
//
// The media endpoint is closed without login, but posts/<id> also answers for an
// attachment, so every id from 1 up is asked for. The answer is one of: a post or page;
// an attachment (its file, parent, size and the photographer credit WordPress kept from
// the file); "unauthorized" (a draft, private or trashed post, or an upload attached to
// one); or "unknown" (a revision, a menu item, or nothing). Nothing on WordPress changes.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { SITES, embedsIn, shownAndLinked, uploadKey, uploadsIn } from './wordpress-lib.mjs';

const API = 'https://public-api.wordpress.com/rest/v1.1/sites';
const HEADERS = { 'User-Agent': 'reddy.world archive inventory' };
const FIELDS = 'ID,type,status,parent,URL,slug,title,date,modified,guid,content,featured_image,attachment_count';

async function get(url, { tries = 4, text = false } = {}) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (res.status >= 500 || res.status === 429) throw new Error(`${res.status}`);
      if (text) return { status: res.status, body: await res.text() };
      return await res.json().catch(() => ({}));
    } catch (err) {
      if (i >= tries) throw new Error(`${err.message} ${url}`);
      await new Promise((r) => setTimeout(r, 1000 * i));
    }
  }
}

const decode = (s) => String(s ?? '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

/** One attachment as WordPress describes it in its own attachment page content */
function attachment(p) {
  const html = p.content ?? '';
  const attr = (name) => decode(html.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? '');
  const meta = (() => { try { return JSON.parse(attr('data-image-meta') || '{}'); } catch { return {}; } })();
  const file = attr('data-orig-file') || html.match(/(?:href|src)=['"]([^'"]+)['"]/)?.[1] || p.guid;
  const size = attr('data-orig-size').split(',').map(Number);
  return {
    id: p.ID,
    file: decode(file).split('?')[0],
    parent: p.parent ? p.parent.ID : 0,
    title: decode(p.title),
    date: p.date,
    ...(size.length === 2 && size[0] ? { width: size[0], height: size[1] } : {}),
    ...(meta.credit ? { credit: meta.credit } : {}),
    ...(meta.copyright ? { copyright: meta.copyright } : {}),
    page: p.URL,
  };
}

/** The uploads a full page shows outside the post's own text: the theme's header, logo, background */
function themeUploads(html, own) {
  const keys = new Set(uploadsIn(html).map(uploadKey));
  for (const k of own) keys.delete(k);
  return [...keys];
}

export async function inventory({ site, max }, { log = () => {}, probe = true } = {}) {
  const posts = [];
  // "any" leaves out Jetpack's portfolio items (ryanvanlil has one: /portfolio/school-integral-project-8/)
  for (const type of ['any', 'jetpack-portfolio', 'jetpack-testimonial']) {
    const before = posts.length;
    for (let page = 1; ; page++) {
      const data = await get(`${API}/${site}/posts/?type=${type}&number=100&page=${page}&fields=${FIELDS}`);
      posts.push(...data.posts);
      if (posts.length - before >= data.found || !data.posts.length) break;
    }
  }
  const records = [];
  for (const p of posts) {
    const { shown, linked } = shownAndLinked(p.content);
    const page = await get(p.URL, { text: true });
    const own = new Set([...shown, ...linked, uploadKey(p.featured_image)].filter(Boolean));
    // one full address per upload, the original size where the page names it (for copying)
    const urls = {};
    for (const u of [p.featured_image, ...uploadsIn(p.content), ...uploadsIn(page.body)].filter(Boolean)) {
      const k = uploadKey(u);
      const clean = u.split('?')[0].replace(/-\d+x\d+(?=\.[a-z0-9]+$)/i, '');
      if (!urls[k] || clean.length < urls[k].length) urls[k] = clean;
    }
    records.push({
      id: p.ID, type: p.type, status: p.status, slug: p.slug, title: decode(p.title), url: p.URL,
      date: p.date, modified: p.modified, featured: p.featured_image || null, attachment_count: p.attachment_count,
      shown, linked, embeds: embedsIn(p.content), urls,
      page_status: page.status,
      // what the full page adds to the post's text: the theme's pictures, and embeds the API text left out
      theme: themeUploads(page.body, own),
      page_embeds: embedsIn(page.body).filter((e) => !embedsIn(p.content).some((x) => x.kind === e.kind && x.id === e.id)),
    });
  }
  const top = probe ? Math.max(max, ...posts.map((p) => p.ID)) + 50 : 0;
  const attachments = [];
  const unauthorized = [];
  const other = [];
  let next = 1;
  let done = 0;
  async function worker() {
    while (next <= top) {
      const id = next++;
      const p = await get(`${API}/${site}/posts/${id}?fields=${FIELDS}`);
      if (p.error === 'unauthorized') unauthorized.push(id);
      else if (p.type === 'attachment') attachments.push(attachment(p));
      else if (p.ID && !posts.some((x) => x.ID === p.ID)) other.push({ id: p.ID, type: p.type, status: p.status });
      if (++done % 500 === 0) log(`${site}: ${done}/${top}`);
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  const byId = (a, b) => (a.id ?? a) - (b.id ?? b);
  return {
    site,
    posts: records.sort(byId),
    attachments: attachments.sort(byId),
    unauthorized: unauthorized.sort(byId),
    other: other.sort(byId),
    probed: top,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  const out = { checked: new Date().toISOString().slice(0, 10), sites: {} };
  for (const s of SITES) {
    out.sites[s.key] = await inventory(s, { log: (m) => console.error(m) });
    // the full addresses are only for copying (wordpress-capture.mjs --fix); the record keeps the names
    for (const p of out.sites[s.key].posts) delete p.urls;
    const r = out.sites[s.key];
    console.error(`${s.site}: ${r.posts.length} public posts and pages, ${r.attachments.length} uploads visible, ${r.unauthorized.length} ids closed without login`);
  }
  writeFileSync(new URL('../src/data/wordpress-inventory.json', import.meta.url), `${JSON.stringify(out, null, 1)}\n`);
}
