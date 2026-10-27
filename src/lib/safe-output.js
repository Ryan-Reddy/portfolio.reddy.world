// Words Ryan types on the image desk (credits, descriptions, keywords, a post's text) end up inside
// the pages' HTML. These keep them from being read as markup or as a script link.

// JSON for a <script type="application/ld+json"> block: the same JSON, but with < > & and the
// two line separators written as \u escapes, so a name holding "</script>" cannot end the block
const ESCAPES = { '<': '\\u003c', '>': '\\u003e', '&': '\\u0026', '\u2028': '\\u2028', '\u2029': '\\u2029' };
export const jsonLdText = (value) => JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (c) => ESCAPES[c]);

// an address to link to: only http(s), as a full URL; anything else (javascript:, data:, "www.x") gives undefined
export const httpUrl = (value) => {
  try {
    const url = new URL(String(value ?? '').trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
};

// A post's text as edited on the desk (the desk's own tidy() keeps the same): paragraphs, headings (an h1
// becomes an h2 and an h5 or h6 an h4, as the page shows them), bold, italic, links, lists, quotes, rules and
// line breaks, without attributes (a link keeps a web address or a site-relative href), and the archive's
// picture blocks <figure data-media="3,4"></figure>. Scripts and styles go with their content; any other tag
// goes and its words stay; a block of text (a div, a table cell) ends in a line break. Whatever is left that
// could still open a tag or a comment (an unclosed "<img ..." or "<!--") is written out as text.
const STORY_TAGS = new Set(['p', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'a', 'ul', 'ol', 'li', 'br', 'blockquote', 'hr']);
const RENAME = { h1: 'h2', h5: 'h4', h6: 'h4' };
const BREAKS = new Set(['div', 'section', 'article', 'header', 'footer', 'address', 'pre', 'tr', 'td', 'th', 'dt', 'dd', 'figcaption']);
const attr = (value) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
// a site-relative link stays only when a browser reads it as this site: no "//", no backslash, no control characters
const siteHref = (href) => (/^\/(?![/\\])/.test(href) && !/[\u0000-\u001f\u007f\\]/.test(href) ? href : undefined);
export function storyHtml(html) {
  const kept = [];
  const keep = (tag) => `\u0000${kept.push(tag) - 1}\u0000`;
  return String(html ?? '').replace(/\u0000/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|template|iframe|object|embed|svg|math|textarea|noscript)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<figure\s+data-media="([\d,]+)"\s*>\s*<\/figure>/gi, (_, media) => keep(`<figure data-media="${media}"></figure>`))
    // an article's own picture (scripts/desk-articles.mjs makes it the picture itself)
    .replace(/<figure\s+data-picture="([a-z0-9]+)"\s*>\s*<\/figure>/gi, (_, id) => keep(`<figure data-picture="${id}"></figure>`))
    // and its videos (src/lib/article-video.js)
    .replace(/<figure\s+data-video="((?:youtube:[\w-]{11}|vimeo:\d{1,12}))"\s*>\s*<\/figure>/gi, (_, key) => keep(`<figure data-video="${key}"></figure>`))
    .replace(/<\/?([a-zA-Z][\w-]*)([^>]*)>/g, (tag, name, attrs) => {
      const tagName = RENAME[name.toLowerCase()] ?? name.toLowerCase();
      const closing = tag.startsWith('</');
      if (BREAKS.has(tagName)) return closing ? keep('<br>') : '';
      if (!STORY_TAGS.has(tagName)) return '';
      if (closing) return tagName === 'br' || tagName === 'hr' ? '' : keep(`</${tagName}>`);
      if (tagName !== 'a') return keep(`<${tagName}>`);
      const href = (attrs.match(/\bhref\s*=\s*"([^"]*)"/i)?.[1] ?? '').replace(/&amp;/g, '&').trim();
      const safe = httpUrl(href) ?? siteHref(href);
      return keep(safe ? `<a href="${attr(safe)}">` : '<a>');
    })
    // nothing that is left can open a tag or a comment
    .replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\u0000(\d+)\u0000/g, (_, index) => kept[Number(index)]);
}
