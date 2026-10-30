// A source link is useful even when its service cannot supply an image for the archive.
export function sourceLabel(value) {
  try {
    const url = new URL(value.replace(/&amp;/g, '&'));
    if (url.protocol !== 'https:') return null;
    if (/^(?:www\.)?instagram\.com$/.test(url.hostname)) {
      const parts = url.pathname.split('/').filter(Boolean);
      if (/^(?:p|reel|tv)$/.test(parts[0]) && parts[1]) return 'View original Instagram post';
      if (parts.length === 1 && /^[\w.]+$/.test(parts[0])) return `Instagram: @${parts[0]}`;
    }
    return null;
  } catch { return null; }
}

export function labelSourceLinks(html) {
  const p = /^(<p\b[^>]*>)([\s\S]*)(<\/p>)$/i.exec(html);
  const body = p ? p[2] : html;
  const next = body.split(/(<br\s*\/?>|\n)/i).map(line => {
    const anchor = /^\s*<a\b[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>\s*$/i.exec(line);
    const url = anchor ? (anchor[1] === anchor[2] ? anchor[1] : '') : line.trim();
    const label = sourceLabel(url);
    if (!label) return line;
    const safe = url.replace(/&amp;/g,'&').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
    return `<a href="${safe}" rel="noopener noreferrer">${label}</a>`;
  }).join('');
  return p ? p[1] + next + p[3] : next;
}
