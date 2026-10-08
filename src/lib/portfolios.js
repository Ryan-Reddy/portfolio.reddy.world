import rmaekers from '../data/rmaekers.json';
import rrproductions from '../data/rrproductions.json';
import maup from '../data/maup.json';
import vaguelyvulgar from '../data/vaguelyvulgar.json';

export const ORIGIN = 'https://reddy.world';
export const BASE = '/portfolio';
// Full URL of this build; every absolute URL is built from it
export const SITE = `${ORIGIN}${BASE}`;
export const CONTACT = 'https://reddy.world/contact';
export const PERSON_ID = 'https://reddy.world/#ryan';

const EXTRA = {
  rmaekers: { icon: '🎪', badge: 'Festival Decors & Stage Builds' },
  rrproductions: { icon: '🎨', badge: 'Fine Art, Sculptures & Inventions' },
  maup: { icon: '🪑', badge: 'Bespoke Adaptive Furniture' },
  vaguelyvulgar: { icon: '📸', badge: 'Personal Photo & Modelling Portfolio' },
};

export const portfolios = [rmaekers, rrproductions, maup, vaguelyvulgar].map((p) => ({
  ...p,
  ...EXTRA[p.id],
  posts: p.posts.map((post) => ({ ...post, portfolio: p.id, path: `/${p.id}/${post.slug}/` })),
}));

export const portfolioById = Object.fromEntries(portfolios.map((p) => [p.id, p]));

export const allPosts = portfolios
  .flatMap((p) => p.posts)
  .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.replace(' ', 'T'));
  if (isNaN(d.getTime())) return dateStr.split(' ')[0] || '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}

export function photos(post) {
  return post.media.filter((m) => m.type === 'image');
}

/** Alt text: the original WordPress alt when written, else its caption, else the project title. */
export function altFor(post, media, index) {
  if (media.alt) return media.alt;
  if (media.caption) return media.caption;
  return `${post.title.trim()} — photo ${index + 1}`;
}

const WIDTHS = [480, 800, 1200, 1600];

/**
 * src, srcset and size of a picture. Every upload is on WordPress.com, whose
 * ?w= resizer serves the smaller versions; it never upscales, so no width
 * above the upload's own is listed. GIFs stay whole to keep their animation.
 */
export function picture(media) {
  const { url, width, height } = media;
  if (/\.gif$/i.test(url)) return { src: url, width, height };
  const widths = WIDTHS.filter((w) => !width || w < width);
  const srcset = widths.map((w) => `${url}?w=${w} ${w}w`);
  if (width) srcset.push(`${url} ${width}w`);
  return { src: `${url}?w=${Math.min(width || 1200, 1200)}`, srcset: srcset.join(', '), width, height };
}

export function contactUrl({ project, image } = {}) {
  const params = new URLSearchParams({ from: 'portfolio' });
  if (project) params.set('project', project);
  if (image) params.set('image', image);
  return `${CONTACT}?${params}`;
}

export function titleCase(s) {
  const t = s.trim();
  return t === t.toUpperCase() ? t.toLowerCase().replace(/(^|\s|-)\S/g, (c) => c.toUpperCase()) : t;
}
