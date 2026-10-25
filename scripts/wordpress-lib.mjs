// What the old WordPress.com sites' pages show, link to and embed: shared by
// wordpress-inventory.mjs, wordpress-capture.mjs and wordpress-unused.mjs.

export const SITES = [
  // max: the highest id in Ryan's media export of that site (its file name says "from-0-to-<max>")
  { key: 'rmaekers', site: 'reddymaekersproductions.wordpress.com', max: 2477 },
  { key: 'rrproductions', site: 'ryanvanlil.wordpress.com', max: 1731 },
  { key: 'maup', site: 'mbdekleermaeker.wordpress.com', max: 52 },
  { key: 'vaguelyvulgar', site: 'vaguelyvulgar.wordpress.com', max: 57 },
];

export const UPLOAD = /https?:\/\/[^"'\s<>()]*(?:\.files\.wordpress\.com|\.wordpress\.com\/wp-content\/uploads|\.wp\.com\/[^"'\s<>]*?\/wp-content\/uploads)\/(\d{4})\/(\d{2})\/([^"'\s<>?#/]+)/gi;
// the same pattern without /g, so looking up one url never moves UPLOAD's position
const ONE_UPLOAD = new RegExp(UPLOAD.source, 'i');
export const IMAGE = /\.(jpe?g|png|gif|webp)$/i;
export const VIDEO_FILE = /\.(mp4|m4v|mov|webm|ogv|avi|wmv)$/i;

/** One name per upload, whatever size or host WordPress served it at: 2016/07/img_0955.jpg */
export function uploadKey(url) {
  const m = ONE_UPLOAD.exec(url ?? '') ?? /\/(\d{4})\/(\d{2})\/([^/?#]+)$/.exec(url ?? '');
  if (!m) return null;
  // WordPress names a resized copy name-300x200.jpg and an edited one name-e1446400187992.jpg
  const file = decodeURIComponent(m[3]).toLowerCase().replace(/-\d+x\d+(?=\.[a-z0-9]+$)/, '').replace(/-e\d{9,}(?=\.[a-z0-9]+$)/, '');
  return `${m[1]}/${m[2]}/${file}`;
}

/** The upload's own file name, without size or host: 2016/07/img_0955-e1446400187992.jpg */
export function uploadPath(url) {
  const m = ONE_UPLOAD.exec(url ?? '') ?? /\/(\d{4})\/(\d{2})\/([^/?#]+)$/.exec(url ?? '');
  return m ? `${m[1]}/${m[2]}/${decodeURIComponent(m[3]).toLowerCase().replace(/-\d+x\d+(?=\.[a-z0-9]+$)/, '')}` : null;
}

/**
 * A page's HTML with the escapes that hide an address undone: Jetpack slideshows keep their
 * pictures in data-gallery="[{&quot;src&quot;:&quot;https:\/\/…&quot;}]" (HTML entities around
 * JSON-escaped slashes), and srcset and src carry &#038; and &amp;.
 */
export const unescapeHtml = (html) => String(html ?? '')
  .replace(/&(?:quot|#0*34|#x0*22);/gi, '"')
  .replace(/&(?:#0*39|#x0*27|apos);/gi, "'")
  .replace(/&(?:#0*47|#x0*2f);/gi, '/')
  .replace(/&(?:#0*38|#x0*26|amp);/gi, '&')
  .replace(/\\u002f/gi, '/')
  .replace(/\\\//g, '/');

export const uploadsIn = (html) => [...unescapeHtml(html).matchAll(UPLOAD)].map((m) => m[0]);

/**
 * The attachment ids a page names for its galleries and slideshows, where the address may
 * not be in the HTML at all: [gallery ids="1,2"], [slideshow ids=…], [tiled-gallery ids=…]
 * (a shortcode the API left unrendered), a block's "ids":[1,2], and the "id" of every
 * picture in a Jetpack slideshow's data-gallery.
 */
export function galleryIds(html) {
  const text = unescapeHtml(html);
  const ids = new Set();
  for (const m of text.matchAll(/\[(?:gallery|slideshow|tiled-gallery|jetpack_slideshow)\b[^\]]*?\bids\s*=\s*["']?([\d,\s]+)/gi)) for (const id of m[1].split(/[,\s]+/)) if (id) ids.add(Number(id));
  for (const m of text.matchAll(/"ids"\s*:\s*\[([\d,\s"]*)\]/g)) for (const id of m[1].replace(/"/g, '').split(/[,\s]+/)) if (id) ids.add(Number(id));
  for (const g of text.matchAll(/data-gallery\s*=\s*'(\[[\s\S]*?\])'|data-gallery\s*=\s*"(\[[\s\S]*?\])"(?=[\s>])/g)) {
    for (const m of (g[1] ?? g[2]).matchAll(/"id"\s*:\s*"?(\d+)/g)) ids.add(Number(m[1]));
  }
  return [...ids];
}

/**
 * Uploads a page shows (a picture, a player) apart from those it only links to as text
 * (an <a href> with no picture of the same upload, such as a PDF). Every address counts:
 * src, srcset, data-orig-file and the other data-*-file attributes, and the pictures in a
 * Jetpack slideshow's data-gallery. `shown` and `linked` are upload keys (one per upload,
 * whatever its size or edit); `files` are the exact files shown, so an edited copy
 * (name-e1503570724129.jpg) is told apart from its original; `ids` are the attachment ids
 * a gallery or slideshow names (resolve them with resolveIds).
 */
export function shownAndLinked(html) {
  const text = unescapeHtml(html);
  const HREF = /href\s*=\s*["']([^"']+)["']/gi;
  const hrefs = [...text.matchAll(HREF)].map((m) => m[1]);
  const shownUrls = uploadsIn(text.replace(HREF, ''));
  const shown = new Set(shownUrls.map(uploadKey));
  const files = new Set(shownUrls.map(uploadPath));
  const linked = new Set(hrefs.flatMap(uploadsIn).map(uploadKey).filter((k) => !shown.has(k)));
  return { shown: [...shown], linked: [...linked], files: [...files], ids: galleryIds(text) };
}

/**
 * Add what a page's gallery and slideshow ids name to its shown uploads, from the list of
 * attachments (wordpress-inventory.json's `attachments`). Changes the records in place.
 */
export function resolveIds(posts, attachments) {
  const byId = new Map((attachments ?? []).map((a) => [a.id, a]));
  for (const p of posts) {
    for (const id of p.ids ?? []) {
      const a = byId.get(id);
      if (!a) continue;
      const k = uploadKey(a.file);
      const f = uploadPath(a.file);
      if (k && !p.shown.includes(k)) p.shown.push(k);
      if (f && p.files && !p.files.includes(f)) p.files.push(f);
    }
  }
  return posts;
}

const ytStart = (q) => {
  const t = /[?&#](?:amp;)?(?:start|t)=([0-9hms]+)/.exec(q ?? '')?.[1];
  if (!t) return 0;
  if (/^\d+$/.test(t)) return Number(t);
  const [, h = 0, m = 0, s = 0] = /(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/.exec(t);
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
};

/** Every video, 3D model, document or other embed a page carries, in order, one per id */
export function embedsIn(html) {
  const text = String(html ?? '').replace(/&#0?38;|&amp;/g, '&');
  const found = new Map();
  const add = (e) => { const k = `${e.kind}:${e.id}`; if (!found.has(k)) found.set(k, e); };
  const ATTR = /\b(src|href|data-src)\s*=\s*["']([^"']+)["']/gi;
  const attrs = [...text.matchAll(ATTR)].map((m) => ({ how: m[1].toLowerCase() === 'href' ? 'link' : 'embed', url: m[2] }));
  // urls in the text itself (WordPress turns one on a line of its own into a player)
  for (const m of text.replace(ATTR, '').matchAll(/https?:\/\/[^\s<>"']+/g)) attrs.push({ how: 'text', url: m[0] });
  for (const { how, url } of attrs) {
    let m;
    if ((m = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^"'\s]*&)?v=|embed\/|v\/|shorts\/))([\w-]{11})([^"'\s]*)/.exec(url))) add({ kind: 'youtube', id: m[1], start: ytStart(m[2]), how, url });
    else if ((m = /(?:player\.)?vimeo\.com\/(?:video\/)?(\d{5,})/.exec(url))) add({ kind: 'vimeo', id: m[1], how, url });
    else if ((m = /videopress\.com\/(?:embed|v)\/(\w+)/.exec(url))) add({ kind: 'videopress', id: m[1], how, url });
    else if ((m = /sketchfab\.com\/(?:models|3d-models)\/(?:[\w-]*-)?([0-9a-f]{32})/.exec(url))) add({ kind: 'sketchfab', id: m[1], how, url });
    else if ((m = /(soundcloud\.com|spotify\.com|mixcloud\.com|issuu\.com|docs\.google\.com|drive\.google\.com|facebook\.com\/[^"'\s]*\/videos)\/[^"'\s]+/.exec(url)) && how === 'embed') add({ kind: m[1].split('.')[0], id: url, how, url });
    else if (uploadKey(url) && VIDEO_FILE.test(uploadKey(url))) add({ kind: 'wordpress-video', id: uploadKey(url), how, url: url.split('?')[0] });
    else if (uploadKey(url) && /\.(pdf|docx?|pptx?|xlsx?|zip)$/i.test(uploadKey(url))) add({ kind: 'document', id: uploadKey(url), how, url: url.split('?')[0] });
  }
  return [...found.values()];
}
