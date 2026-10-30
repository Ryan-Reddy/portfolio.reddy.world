// Recognise standalone media links without changing prose or the original WordPress record.
import {segments} from './content.js';
import {labelSourceLinks} from './source-links.js';

// Both the active rich-text editor and its fallback must receive the same resolved text.
export function projectEditorText(html, media) {
  const placed = placeTextImages(html, media);
  let changed = false;
  const labelled = segments(placed).map(piece => {
    const next = labelSourceLinks(piece);
    changed ||= next !== piece;
    return next;
  }).join('\n\n');
  return changed ? labelled : placed;
}

export function imageLink(value) {
  try {
    let url = new URL(String(value).replace(/&amp;/g, '&'));
    if (/^(?:www\.)?google\.[a-z.]+$/.test(url.hostname) && url.pathname === '/imgres') {
      url = new URL(url.searchParams.get('imgurl'));
    }
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    // Google-hosted photographs often have opaque paths rather than file extensions.
    if (!/\.(?:jpe?g|png|webp|gif)$/i.test(url.pathname) && !/(^|\.)googleusercontent\.com$/.test(url.hostname)) return null;
    url.hash = '';
    return url.href;
  } catch { return null; }
}

function lineUrl(line) {
  const text = line.trim();
  const anchor = /^<a\b[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>$/i.exec(text);
  if (anchor) return anchor[1].replace(/&amp;/g, '&') === anchor[2].replace(/&amp;/g, '&') ? anchor[1] : null;
  return /^https?:\/\/[^\s<>]+$/.test(text) ? text : null;
}

export function textImageLinks(html) {
  return [...new Set(segments(html).flatMap(piece => {
    const p = /^<p\b[^>]*>([\s\S]*)<\/p>$/i.exec(piece);
    if (!p && /^</.test(piece)) return [];
    return (p ? p[1] : piece).split(/<br\s*\/?>|\n/i).map(lineUrl).filter(Boolean).map(imageLink).filter(Boolean);
  }))];
}

// Existing numeric picture positions are never renumbered. Repeated URLs get one block.
export function placeTextImages(html, media) {
  const known = new Map();
  media.forEach((item, i) => {
    for (const url of [item.wp_url, item.source_url, item.url]) {
      const key = imageLink(url);
      if (key) known.set(key, i);
    }
  });
  const seen = new Set([...String(html).matchAll(/data-media="([\d,]+)"/g)].flatMap(m => m[1].split(',').map(Number)));
  let changed = false;
  const result = segments(html).map(piece => {
    const p = /^<p\b[^>]*>([\s\S]*)<\/p>$/i.exec(piece);
    if (!p && /^</.test(piece)) return piece;
    const lines = (p ? p[1] : piece).split(/<br\s*\/?>|\n/i);
    if (!lines.some(line => known.has(imageLink(lineUrl(line))))) return piece;
    changed = true;
    const out = [], words = [];
    const flush = () => { if (words.length) out.push(`<p>${words.splice(0).join('<br>')}</p>`); };
    for (const line of lines) {
      const index = known.get(imageLink(lineUrl(line)));
      if (index === undefined) { words.push(line); continue; }
      flush();
      if (!seen.has(index)) { out.push(`<figure data-media="${index}"></figure>`); seen.add(index); }
    }
    flush();
    return out.join('\n\n');
  }).filter(Boolean).join('\n\n');
  return changed ? result : html;
}
