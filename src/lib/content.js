/**
 * The archive keeps each post's raw WordPress `content`. WordPress itself turned
 * blank lines into paragraphs (wpautop) and bare video links into players (oEmbed)
 * when it showed a post; this does the same at build time.
 */

const BLOCK_TAGS = new Set([
  'address', 'article', 'aside', 'blockquote', 'dd', 'details', 'div', 'dl', 'dt', 'fieldset',
  'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr',
  'iframe', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'tbody', 'td', 'tfoot',
  'th', 'thead', 'tr', 'ul',
]);
const VOID_BLOCKS = new Set(['hr']);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const YOUTUBE = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:[^\s"'<]*&(?:amp;)?)?v=|embed\/|shorts\/))([\w-]{11})([^\s"'<]*)/;
const VIMEO = /vimeo\.com\/(?:video\/)?(\d+)/;
const URL_RE = /(?<![">'=/])\bhttps?:\/\/[^\s<"')]+/g;

function startSeconds(rest) {
  const m = /[?&#](?:amp;)?(?:t|start)=(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?/.exec(rest || '');
  if (!m) return 0;
  return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
}

/** {key, src, href} for a YouTube or Vimeo url, else null */
function videoFor(url) {
  const y = YOUTUBE.exec(url);
  if (y) {
    const start = startSeconds(y[2]);
    return {
      key: `yt:${y[1]}`,
      src: `https://www.youtube-nocookie.com/embed/${y[1]}${start ? `?start=${start}` : ''}`,
      href: `https://youtu.be/${y[1]}${start ? `?t=${start}` : ''}`,
      label: 'Watch on YouTube',
    };
  }
  const v = VIMEO.exec(url);
  if (v) {
    return {
      key: `vimeo:${v[1]}`,
      src: `https://player.vimeo.com/video/${v[1]}?dnt=1`,
      href: `https://vimeo.com/${v[1]}`,
      label: 'Watch on Vimeo',
    };
  }
  return null;
}

function embed(video, title) {
  return (
    `<figure class="video-embed"><div class="video-frame"><iframe src="${video.src}" ` +
    `title="${esc(`Video: ${title}`)}" loading="lazy" allowfullscreen ` +
    `allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" ` +
    `referrerpolicy="strict-origin-when-cross-origin"></iframe></div>` +
    `<figcaption><a href="${video.href}" rel="noopener">${video.label}</a></figcaption></figure>`
  );
}

function linkify(html) {
  return html.replace(URL_RE, (url) => {
    const trail = /[.,;:!?]+$/.exec(url);
    const clean = trail ? url.slice(0, -trail[0].length) : url;
    return `<a href="${clean}" rel="noopener">${clean}</a>${trail ? trail[0] : ''}`;
  });
}

/** Bare (not already linked) video urls in a piece of html, in order */
function bareVideoUrls(html) {
  const unlinked = html.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, ' ');
  return (unlinked.match(URL_RE) || []).map((u) => u.replace(/[.,;:!?]+$/, ''));
}

/** Text of a paragraph chunk without tags, to see whether it is only a url */
const textOnly = (html) => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();

function paragraph(html, ctx, breaks = true) {
  const urls = bareVideoUrls(html);
  const videos = [];
  for (const u of urls) {
    const v = videoFor(u);
    if (v && !ctx.seen.has(v.key)) {
      ctx.seen.add(v.key);
      videos.push(v);
    }
  }
  const onlyUrl = urls.length === 1 && textOnly(html) === urls[0];
  const para = onlyUrl && videos.length ? '' : `<p>${breaks ? linkify(html).replace(/\n/g, '<br>') : linkify(html)}</p>`;
  return para + videos.map((v) => embed(v, ctx.title)).join('');
}

/** Split into top-level blocks and loose inline text */
function tokenise(html) {
  const out = [];
  const tagRe = /<(\/?)([a-z][a-z0-9]*)\b[^>]*?(\/?)>|<!--[\s\S]*?-->/gi;
  let depth = 0;
  let blockStart = 0;
  let inlineStart = 0;
  let m;
  while ((m = tagRe.exec(html))) {
    if (!m[2]) continue; // comment
    const name = m[2].toLowerCase();
    if (!BLOCK_TAGS.has(name)) continue;
    const closing = m[1] === '/';
    const selfClosed = m[3] === '/' || VOID_BLOCKS.has(name);
    if (!closing && depth === 0) {
      out.push({ inline: html.slice(inlineStart, m.index) });
      blockStart = m.index;
      if (selfClosed) {
        out.push({ block: html.slice(m.index, tagRe.lastIndex) });
        inlineStart = tagRe.lastIndex;
      } else {
        depth = 1;
      }
    } else if (!closing && !selfClosed) {
      depth += 1;
    } else if (closing && depth > 0) {
      depth -= 1;
      if (depth === 0) {
        out.push({ block: html.slice(blockStart, tagRe.lastIndex) });
        inlineStart = tagRe.lastIndex;
      }
    }
  }
  out.push({ inline: html.slice(inlineStart) });
  return out;
}

export function renderContent(raw, { title = '' } = {}) {
  if (!raw) return '';
  const html = raw
    .replace(/\r\n?/g, '\n')
    .replace(/&nbsp;| /g, ' ')
    .replace(/\sstyle=("[^"]*"|'[^']*')/gi, '')
    .replace(/<(\/?)h1\b/gi, '<$1h2'); // the page title is the one h1
  const ctx = { title, seen: new Set() };
  const parts = [];
  for (const t of tokenise(html)) {
    if (t.inline !== undefined) {
      for (const chunk of t.inline.split(/\n[ \t]*\n/)) {
        if (chunk.trim()) parts.push(paragraph(chunk.trim(), ctx));
      }
    } else {
      // a <p> that holds only a video link becomes the player
      const p = /^<p\b[^>]*>([\s\S]*)<\/p>$/i.exec(t.block);
      parts.push(p ? paragraph(p[1].trim(), ctx, false) : t.block);
    }
  }
  return parts.join('\n');
}
