// A post's text in an editor and back, in the browser: for the edit bar on the project pages
// (src/lib/edit-bar.js). The same rules as the desk's own inline tidy() (src/pages/image-metadata.astro)
// and as storyHtml on the server (src/lib/safe-output.js), which cleans the text again before it is stored:
// paragraphs, headings (an h1 becomes an h2 and an h5 or h6 an h4, as the page shows them), bold, italic,
// links to the web, to this site or to an e-mail address, lists, quotes, rules and line breaks; a block of text (a div, a table
// cell) becomes a paragraph; pictures, scripts and pasted styles go; any other tag goes, its words stay.
// <figure data-media="3,4"></figure> marks pictures in the text; in the editor they are fixed blocks.

const ALLOWED = new Set(['P', 'H2', 'H3', 'H4', 'STRONG', 'B', 'EM', 'I', 'A', 'UL', 'OL', 'LI', 'BR', 'BLOCKQUOTE', 'HR']);
const RENAME = { H1: 'H2', H5: 'H4', H6: 'H4' };
const BLOCKS = new Set(['DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'ADDRESS', 'PRE', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'FIGCAPTION', 'DL', 'DT', 'DD']);
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'SVG', 'MATH', 'IMG', 'PICTURE', 'VIDEO', 'AUDIO', 'CANVAS', 'NOSCRIPT', 'FORM', 'INPUT', 'BUTTON', 'SELECT', 'TEXTAREA']);

/** A link goes to a web address, to a page of this site or to an e-mail address; nothing a browser could read as another host. */
export const safeHref = (href) => {
  const value = String(href ?? '').trim();
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return false;
  return /^https?:\/\/[^/]/i.test(value) || /^\/(?!\/)/.test(value) || /^mailto:[^\s"<>]+$/i.test(value);
};
// what a link keeps: its address, and whether it opens in a new tab (target="_blank", rel="noopener"), as the archive's do
const linkAttr = (attr) => (attr.name === 'href' && safeHref(attr.value)) || (attr.name === 'target' && attr.value === '_blank')
  || (attr.name === 'rel' && /^(?:noopener|noreferrer|nofollow)(?:\s+(?:noopener|noreferrer|nofollow))*$/i.test(attr.value.trim()));
const holdsBlocks = (node) => [...node.children].some((c) => /^(P|H[1-6]|UL|OL|BLOCKQUOTE|HR|FIGURE|TABLE|DIV)$/.test(c.tagName) || c.classList.contains('desk-pics'));

/** Cleans a tree in place. `pictures(media)` makes the editor's picture block; without it a figure stays, empty. */
export function tidy(root, pictures = null) {
  for (const child of [...root.childNodes]) {
    if (child.nodeType === 8) { child.remove(); continue; }
    if (child.nodeType !== 1) continue;
    const tag = child.tagName.toUpperCase();
    const media = child.dataset?.media;
    if ((tag === 'FIGURE' || child.classList.contains('desk-pics')) && media !== undefined && /^[\d,\s]+$/.test(media)) {
      if (pictures) child.replaceWith(pictures(media));
      else if (tag === 'FIGURE') { child.replaceChildren(); for (const attr of [...child.attributes]) if (attr.name !== 'data-media') child.removeAttribute(attr.name); }
      continue;
    }
    if (DROP.has(tag)) { child.remove(); continue; }
    tidy(child, pictures);
    if (RENAME[tag]) {
      const next = document.createElement(RENAME[tag]);
      next.append(...child.childNodes);
      child.replaceWith(next);
    } else if (BLOCKS.has(tag)) {
      if (holdsBlocks(child) || child.parentNode?.closest?.('p, li, h2, h3, h4, blockquote')) child.replaceWith(...child.childNodes, ...(holdsBlocks(child) ? [] : [document.createElement('br')]));
      else { const p = document.createElement('p'); p.append(...child.childNodes); child.replaceWith(p); }
    } else if (!ALLOWED.has(tag)) child.replaceWith(...child.childNodes);
    else for (const attr of [...child.attributes]) if (!(tag === 'A' && linkAttr(attr))) child.removeAttribute(attr.name);
  }
}

/** The stored text (WordPress HTML, paragraphs split by blank lines) as editor HTML, pictures as fixed blocks. */
export function toEditor(html, thumbs = {}) {
  const blocks = String(html ?? '').replace(/\r\n/g, '\n').split(/\n{2,}/).map((chunk) => chunk.trim()).filter((chunk) => chunk && chunk !== '&nbsp;');
  const template = document.createElement('template');
  template.innerHTML = blocks.map((chunk) => (/^<(p|h[1-6]|ul|ol|blockquote|figure|div|hr|table)\b/i.test(chunk) ? chunk : `<p>${chunk.replace(/\n/g, '<br>')}</p>`)).join('');
  tidy(template.content, (media) => {
    const block = document.createElement('span');
    block.className = 'desk-pics';
    block.contentEditable = 'false';
    block.dataset.media = media;
    for (const index of media.split(',')) {
      const src = thumbs[index.trim()];
      const item = src ? Object.assign(document.createElement('img'), { src, alt: '', loading: 'lazy' }) : Object.assign(document.createElement('span'), { textContent: `picture ${Number(index) + 1}` });
      block.append(item);
    }
    return block;
  });
  return template.innerHTML;
}

/** The editor's content back as the archive stores it: paragraphs, picture blocks as <figure data-media>. */
export function fromEditor(root) {
  const copy = root.cloneNode(true);
  for (const block of copy.querySelectorAll('.desk-pics')) {
    const figure = document.createElement('figure');
    figure.dataset.media = block.dataset.media;
    block.replaceWith(figure);
  }
  tidy(copy);
  return copy.innerHTML
    .replace(/<figure data-media="([^"]*)"><\/figure>/g, '\n\n<figure data-media="$1"></figure>\n\n')
    .replace(/<\/p>/g, '</p>\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
