// Why was an upload never shown? For every file in each old WordPress.com site's media
// library that no published page shows, the reason, so Ryan can decide per group.
//
//   node scripts/wordpress-unused.mjs --export rmaekers=D:/…media-export-89078577-….tar \
//     --export rrproductions=…tar --export vaguelyvulgar=…tar --export maup=…tar \
//     [--wxr rrproductions=….xml --wxr vaguelyvulgar=….xml --wxr maup=….xml]
//
// Reads src/data/wordpress-inventory.json (what the sites still publish, from
// wordpress-inventory.mjs), Ryan's media exports (the .tar files WordPress.com mails:
// every upload as it was uploaded) and, where there is one, the site's WXR export (which
// post each upload belongs to, and that post's status). Writes
// src/data/wordpress-unused.json and a small thumbnail per picture under
// public/images/unused/<site>/ for the no-index review page /portfolio/image-metadata/unused/.
// Vaguely Vulgar's few uploads are also copied whole into archive/wordpress/ (not served).
// Nothing on WordPress or in the exports is changed.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { IMAGE, SITES, uploadKey } from './wordpress-lib.mjs';
import { KEPT_NOT_SHOWN } from '../src/lib/archive-curation.js';

sharp.cache(false);
const ROOT = path.resolve(import.meta.dirname, '..');
const args = { export: {}, wxr: {} };
for (let i = 2; i < process.argv.length; i += 2) {
  const [k, v] = process.argv[i + 1].split(/=(.*)/s);
  args[process.argv[i].replace(/^--/, '')][k] = v;
}
const inventory = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/wordpress-inventory.json'), 'utf8'));
// copied whole into the repo, not served: cheap enough (Vaguely Vulgar, 44 uploads, 6.7 MB)
const KEEP_ORIGINALS = new Set(['vaguelyvulgar']);
// the former surname: such a file is listed but gets no thumbnail and no copy
const FORMER_NAME = /van[\s_-]*lil/i;

/** Every file in a ustar archive, one at a time, without unpacking it to disk */
function* tarEntries(file) {
  const fd = fs.openSync(file, 'r');
  const header = Buffer.alloc(512);
  let pos = 0;
  let longName = null;
  try {
    while (fs.readSync(fd, header, 0, 512, pos) === 512) {
      if (header.every((b) => b === 0)) break;
      const str = (a, b) => header.toString('utf8', a, b).replace(/\0.*$/s, '');
      const size = parseInt(str(124, 136).trim() || '0', 8);
      const type = str(156, 157);
      let name = longName ?? (str(345, 500) ? `${str(345, 500)}/${str(0, 100)}` : str(0, 100));
      longName = null;
      const body = pos + 512;
      pos = body + Math.ceil(size / 512) * 512;
      if (type === 'L') { const b = Buffer.alloc(size); fs.readSync(fd, b, 0, size, body); longName = b.toString('utf8').replace(/\0.*$/s, ''); continue; }
      if (type !== '0' && type !== '' && type !== '\0') continue;
      const b = Buffer.alloc(size);
      fs.readSync(fd, b, 0, size, body);
      yield { name, size, offset: body, buffer: b };
    }
  } finally { fs.closeSync(fd); }
}

const readAt = ({ tar, offset, size, fetched }) => {
  if (fetched) return fetched;
  const fd = fs.openSync(tar, 'r');
  try { const b = Buffer.alloc(size); fs.readSync(fd, b, 0, size, offset); return b; } finally { fs.closeSync(fd); }
};

/** WXR: each upload's post, and each post's status and title */
function readWxr(file) {
  const tag = (it, t) => {
    const a = it.indexOf(`<${t}>`);
    if (a < 0) return undefined;
    return it.slice(a + t.length + 2, it.indexOf(`</${t}>`, a)).replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');
  };
  const posts = new Map();
  const uploads = new Map();
  for (const it of fs.readFileSync(file, 'utf8').split('<item>').slice(1)) {
    const type = tag(it, 'wp:post_type');
    const id = Number(tag(it, 'wp:post_id'));
    if (type === 'attachment') {
      const url = tag(it, 'wp:attachment_url');
      uploads.set(path.posix.join(...new URL(url).pathname.split('/').slice(-3)).toLowerCase(), { id, parent: Number(tag(it, 'wp:post_parent')) });
    } else posts.set(id, { id, type, status: tag(it, 'wp:status'), title: tag(it, 'title') });
  }
  return { posts, uploads };
}

/** 64-bit difference hash: 0-4 apart is one photo saved twice, 6-10 a burst shot a moment later */
async function dhash(buffer) {
  const px = await sharp(buffer, { failOn: 'none' }).rotate().greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer();
  let h = 0n;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) h = (h << 1n) | (px[y * 9 + x] > px[y * 9 + x + 1] ? 1n : 0n);
  return h;
}
const distance = (a, b) => { let x = a ^ b, n = 0; while (x) { n += Number(x & 1n); x >>= 1n; } return n; };

// WordPress's own copies of one picture: name-300x200.jpg, name-e1446400187992.jpg,
// name-scaled.jpg, name-rotated.jpg and cropped-name.jpg (a header or site icon crop)
const editedBase = (p) => p.replace(/(^|\/)cropped-/, '$1').replace(/-(?:\d+x\d+|e\d{9,}|scaled|rotated)(?=\.[a-z0-9]+$)/g, '');
// a second upload of one file: name1.jpg, name-1.jpg, name-2.jpg
const reuploadBase = (p) => p.replace(/(?:-\d|\d)(?=\.[a-z0-9]+$)/, '');

const REASONS = {
  'edited-copy': 'A copy WordPress made of a picture that is shown, or the original of an edited one that is shown (resized, edited, or cropped for the header or site icon)',
  duplicate: 'The same file or photo, uploaded again; the other upload is shown',
  'linked-as-text': 'Only linked from a page’s text, not shown as a picture',
  'theme-only': 'Shown by the site’s theme (header, logo, background), not in a post',
  'hidden-post': 'Uploaded to a post or page that is a draft, private or trashed',
  burst: 'A near-identical shot of a picture that is shown (taken a moment later)',
  'not-placed': 'Uploaded to a published post or page, never placed in it',
  unattached: 'In the media library, attached to no post',
  closed: 'Closed without login: attached to no post, or to a draft, private or trashed one (the site’s WXR export tells which)',
};

/** Uploads the archive already keeps a copy of (any source site's records point at it) */
const inRepo = new Set();
for (const { key } of SITES) {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data', `${key}.json`), 'utf8'));
  for (const post of data.posts) for (const m of [post.featured, ...(post.media ?? [])].filter(Boolean)) {
    const local = m.url?.startsWith('/portfolio/') && fs.existsSync(path.join(ROOT, 'public', m.url.slice('/portfolio/'.length)));
    if (local && m.wp_url) inRepo.add(`${new URL(m.wp_url).hostname.split('.')[0]}/${path.posix.join(...new URL(m.wp_url).pathname.split('/').slice(-3)).toLowerCase()}`);
  }
}

const out = { checked: inventory.checked, reasons: REASONS, sites: {} };
const shownHashes = []; // every shown picture of every site: { site, file, hash, md5 }
const pending = [];

for (const { key, site } of SITES) {
  const inv = inventory.sites[key];
  const wxr = args.wxr[key] ? readWxr(args.wxr[key]) : null;
  const publicPosts = inv.posts.filter((p) => p.status === 'publish');
  const shown = new Map(); // upload key -> the post showing it
  const theme = new Set();
  const linked = new Map();
  for (const p of publicPosts) {
    for (const k of [...p.shown, uploadKey(p.featured)].filter(Boolean)) if (!shown.has(k)) shown.set(k, p);
    for (const k of p.theme) theme.add(k);
  }
  for (const p of publicPosts) for (const k of p.linked) if (!shown.has(k) && !linked.has(k)) linked.set(k, p);
  const visible = new Map(inv.attachments.map((a) => [path.posix.join(...new URL(a.file).pathname.split('/').slice(-3)).toLowerCase(), a]));
  const postById = new Map(inv.posts.map((p) => [p.id, p]));

  const files = [];
  if (!args.export[key]) throw new Error(`--export ${key}=<media export .tar> is needed`);
  for (const entry of tarEntries(args.export[key])) {
    const rel = entry.name.replace(/^\.?\//, '').toLowerCase();
    if (!/^\d{4}\/\d{2}\/[^/]+$/.test(rel)) continue;
    const { buffer } = entry;
    const isImage = IMAGE.test(rel);
    let hash = null;
    if (isImage) { try { hash = await dhash(buffer); } catch { hash = null; } }
    files.push({ rel, name: entry.name, size: entry.size, tar: args.export[key], offset: entry.offset, md5: createHash('md5').update(buffer).digest('hex'), hash, isImage });
  }
  // uploaded after the export was made: read from WordPress itself
  const inExport = new Set(files.map((f) => f.rel));
  for (const [rel, a] of visible) {
    if (inExport.has(rel)) continue;
    const res = await fetch(a.file, { headers: { 'User-Agent': 'reddy.world archive inventory' } });
    if (!res.ok) continue;
    const buffer = Buffer.from(await res.arrayBuffer());
    const isImage = IMAGE.test(rel);
    let hash = null;
    if (isImage) { try { hash = await dhash(buffer); } catch { hash = null; } }
    files.push({ rel, name: rel, size: buffer.length, fetched: buffer, md5: createHash('md5').update(buffer).digest('hex'), hash, isImage, notInExport: true });
  }
  const isShown = (f) => shown.has(f.rel) || shown.has(uploadKey(`/${f.rel}`)) && editedBase(f.rel) === f.rel;
  for (const f of files) if (f.isImage && isShown(f) && f.hash !== null) shownHashes.push({ site: key, file: f.rel, hash: f.hash, md5: f.md5 });
  pending.push({ key, site, inv, wxr, files, shown, theme, linked, visible, postById, isShown });
}

for (const { key, site, inv, wxr, files, shown, theme, linked, visible, postById, isShown } of pending) {
  const host = `https://${site}/wp-content/uploads/`;
  const result = [];
  let shownCount = 0;
  for (const f of files) {
    if (isShown(f)) { shownCount++; continue; }
    const att = visible.get(f.rel);
    const fromWxr = wxr?.uploads.get(f.rel);
    const parentId = att?.parent ?? fromWxr?.parent ?? null;
    const parent = parentId ? (postById.get(parentId) ?? (wxr?.posts.get(parentId) ? { ...wxr.posts.get(parentId), url: null } : null)) : null;
    const parentPublic = parent?.status === 'publish';
    const item = {
      file: f.rel,
      url: `${host}${f.rel}`,
      bytes: f.size,
      ...(f.notInExport ? { not_in_export: true } : {}),
      id: att?.id ?? fromWxr?.id ?? null,
      parent: parentId === null ? null : parentId,
      ...(parent ? { parent_title: String(parent.title ?? '').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&'), parent_status: parent.status, ...(parent.url ? { parent_url: parent.url } : {}) } : {}),
      ...(att?.width ? { width: att.width, height: att.height } : {}),
      ...(att?.credit ? { credit: att.credit } : {}),
      ...(inRepo.has(`${site.split('.')[0]}/${f.rel}`) ? { in_repo: true } : {}),
    };
    const k = uploadKey(`/${f.rel}`);
    const same = (other) => other.md5 === f.md5 || (f.hash !== null && distance(other.hash, f.hash) <= 4);
    const closest = f.hash === null ? null : shownHashes.reduce((best, s) => {
      const d = distance(s.hash, f.hash);
      return !best || d < best.d ? { ...s, d } : best;
    }, null);
    if (shown.has(k) || shown.has(editedBase(f.rel))) { item.reason = 'edited-copy'; item.of = shown.has(editedBase(f.rel)) ? editedBase(f.rel) : k; }
    else if (shown.has(reuploadBase(f.rel)) && (!f.isImage || closest?.d <= 10)) { item.reason = 'duplicate'; item.of = reuploadBase(f.rel); }
    else if (shownHashes.some((s) => s.md5 === f.md5) || (closest && closest.d <= 4)) {
      const s = shownHashes.find((x) => x.md5 === f.md5) ?? closest;
      item.reason = 'duplicate';
      item.of = s.site === key ? s.file : `${s.site}: ${s.file}`;
    }
    else if (linked.has(k)) { item.reason = 'linked-as-text'; item.on = linked.get(k).slug; }
    else if (theme.has(k)) item.reason = 'theme-only';
    else if (parentId && !parentPublic) item.reason = 'hidden-post';
    else if (!att && !fromWxr && inv.unauthorized.length) item.reason = 'closed';
    else if (closest && closest.d <= 10) { item.reason = 'burst'; item.of = closest.site === key ? closest.file : `${closest.site}: ${closest.file}`; }
    else if (!parentId) item.reason = 'unattached';
    else item.reason = 'not-placed';

    if (FORMER_NAME.test(f.rel) || FORMER_NAME.test(att?.title ?? '')) item.former_name = true;
    else if (f.isImage && !KEPT_NOT_SHOWN.includes(key)) {
      f.buffer = readAt(f);
      const thumb = `/portfolio/images/unused/${key}/${f.rel.replace(/\.[a-z0-9]+$/, '')}.webp`;
      const to = path.join(ROOT, 'public', thumb.slice('/portfolio/'.length));
      if (!fs.existsSync(to)) {
        fs.mkdirSync(path.dirname(to), { recursive: true });
        try { await sharp(f.buffer, { failOn: 'none' }).rotate().resize(240, 240, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 55 }).toFile(to); } catch { /* unreadable picture: listed without a thumbnail */ }
      }
      if (fs.existsSync(to)) item.thumb = thumb;
    }
    if (KEEP_ORIGINALS.has(key) && !item.former_name) {
      const to = path.join(ROOT, 'archive', 'wordpress', key, f.rel);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      if (!fs.existsSync(to)) fs.writeFileSync(to, f.buffer ?? readAt(f));
      item.copy = `archive/wordpress/${key}/${f.rel}`;
    }
    f.buffer = null;
    result.push(item);
  }
  const counts = {};
  for (const r of result) counts[r.reason] = (counts[r.reason] ?? 0) + 1;
  out.sites[key] = {
    site,
    export: path.basename(args.export[key]),
    files: files.length,
    shown: shownCount,
    not_shown: result.length,
    bytes_not_shown: result.reduce((n, r) => n + r.bytes, 0),
    counts,
    uploads: result.sort((a, b) => a.file.localeCompare(b.file)),
  };
  console.log(`${site}: ${files.length} files in the export, ${shownCount} shown, ${result.length} not: ${JSON.stringify(counts)}`);
}
fs.writeFileSync(path.join(ROOT, 'src/data/wordpress-unused.json'), `${JSON.stringify(out, null, 1)}\n`);
