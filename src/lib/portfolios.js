import rmaekers from '../data/rmaekers.json';
import rrproductions from '../data/rrproductions.json';
import maup from '../data/maup.json';
import vaguelyvulgar from '../data/vaguelyvulgar.json';
import { hasResizer } from './media-url.js';

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

// Series and themes that cut across portfolios. Each one is a post tag: a filter chip
// wherever posts carry it (?tag=<tag> links straight to it), and its own page at
// /portfolio/theme/<tag>/ that lists every project across the portfolios.
export const THEME_TAGS = [
  { tag: 'signage', label: 'Signage & lettering',
    description: 'Signs, lightboxes, giant letters, banners and logos: lettering work by Ryan Reddy and ReddyMaekers, from club signage to a typewriter puzzle.' },
  { tag: 'cantina', label: 'Cantina',
    description: 'Cantina, the weekly Friday night at the Marktkantine in Amsterdam: giant hanging disco letters, light mapping on origami faces and a new decor every week.' },
  { tag: 'marktkantine', label: 'Marktkantine',
    description: "Decors, light installations and signage for the Marktkantine, Amsterdam's largest underground club, grown from the Markanti club of the 80s." },
  { tag: 'georgies', label: 'Georgies Wundergarten',
    description: 'Georgies Wundergarten, year after year: the stage builds, the giant letters and the ball pit by Ryan Reddy and ReddyMaekers.' },
  { tag: 'festivals', label: 'Festivals',
    description: 'Festival decors and stage builds by ReddyMaekers: Dekmantel, Wicked Jazz Sounds, Oranjebloesem, By the Creek and more.' },
  { tag: 'light', label: 'Light & lightboxes',
    description: 'Light installations, lamps and lightboxes by Ryan Reddy, ReddyMaekers and Maup de Kleermaeker.' },
  { tag: 'furniture', label: 'Furniture',
    description: 'Furniture by Ryan Reddy: chairs, benches, swings and adaptive furniture across ReddyMaekers, RRproductions and Maup de Kleermaeker.' },
];
export const themeByTag = Object.fromEntries(THEME_TAGS.map((t) => [t.tag, t]));

export function tagChips(posts) {
  return THEME_TAGS
    .filter(({ tag }) => posts.some((post) => post.tags.includes(tag)))
    .map(({ tag, label }) => ({ label, value: `tag:${tag}` }));
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.replace(' ', 'T'));
  if (isNaN(d.getTime())) return dateStr.split(' ')[0] || '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}

/** The pictures a page shows: repeats of one photo (marked by the importer) once */
export function photos(post) {
  return post.media.filter((m) => m.type === 'image' && m.duplicate_of === undefined);
}

/** Alt text: the original WordPress alt when written, else its caption, else the project title. */
export function altFor(post, media, index) {
  if (media.alt) return media.alt;
  if (media.caption) return media.caption;
  return `${post.title.trim()} — photo ${index + 1}`;
}

const WIDTHS = [480, 800, 1200, 1600];

/**
 * src, srcset and size of a picture. WordPress.com uploads have a ?w= resizer
 * for the smaller versions; it never upscales, so no width above the upload's
 * own is listed. Self-hosted pictures (public/images) have no resizer: they are
 * served whole. GIFs stay whole to keep their animation.
 */
export function picture(media) {
  const { url, width, height } = media;
  if (/\.gif$/i.test(url) || !hasResizer(url)) return { src: url, width, height };
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
