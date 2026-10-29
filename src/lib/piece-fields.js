// A closed craft vocabulary shared by desk fields, saved content and the wall feed.
export const CRAFTS = Object.freeze({software: 'Software & web', decor: 'Stages & decor', signs: 'Signs & light', furniture: 'Furniture', art: 'Inventions & art', performance: 'Performance', work: 'Study & other work'});
export const craftOf = value => Object.hasOwn(CRAFTS, value) ? value : undefined;
export function publicationDay(value) {
  const text = String(value ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text && date.getUTCFullYear() >= 1900 && date.getUTCFullYear() <= 2200 ? text : undefined;
}
export function pieceTags(value) {
  const out = new Map();
  for (const tag of (Array.isArray(value) ? value : String(value ?? '').split(','))) {
    const text = String(tag).replace(/\s+/g, ' ').trim();
    if (text && !text.includes('://') && !out.has(text.toLowerCase())) out.set(text.toLowerCase(), text);
  }
  return [...out.values()];
}
export function articleCraft(article, software = []) {
  return craftOf(article.craft) ?? (article.related ? craftOf(software.find(s => s.id === article.related)?.branch) ?? 'software' : ['interview', 'case-study'].includes(article.kind) ? 'work' : 'art');
}
