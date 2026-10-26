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

// A post's text as edited on the desk: paragraphs, headings, bold, italic, links, lists, quotes and line
// breaks stay, without attributes (a link keeps an http(s) or site-relative href), and so do the archive's
// picture blocks <figure data-media="3,4"></figure>. Any other tag goes; the words inside it stay.
const STORY_TAGS = new Set(['p', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'a', 'ul', 'ol', 'li', 'br', 'blockquote']);
const attr = (value) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
export function storyHtml(html) {
  const pictures = [];
  return String(html ?? '').replace(/\u0000/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|template|iframe|object|svg|math)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<figure\s+data-media="([\d,]+)"\s*>\s*<\/figure>/gi, (_, media) => `\u0000${pictures.push(media) - 1}\u0000`)
    .replace(/<\/?([a-zA-Z][\w-]*)([^>]*)>/g, (tag, name, attrs) => {
      const tagName = name.toLowerCase();
      if (!STORY_TAGS.has(tagName)) return '';
      if (tag.startsWith('</')) return tagName === 'br' ? '' : `</${tagName}>`;
      if (tagName !== 'a') return `<${tagName}>`;
      const href = (attrs.match(/\bhref\s*=\s*"([^"]*)"/i)?.[1] ?? '').replace(/&amp;/g, '&').trim();
      const safe = httpUrl(href) ?? (/^\/(?!\/)/.test(href) ? href : undefined);
      return safe ? `<a href="${attr(safe)}">` : '<a>';
    })
    .replace(/\u0000(\d+)\u0000/g, (_, index) => `<figure data-media="${pictures[Number(index)]}"></figure>`);
}
