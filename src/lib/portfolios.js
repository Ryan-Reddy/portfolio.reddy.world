import rmaekers from '../data/rmaekers.json';
import rrproductions from '../data/rrproductions.json';
import vaguelyvulgar from '../data/vaguelyvulgar.json';
import { hasResizer } from './media-url.js';
import { BRAND } from './brands.js';
import { publicArchivePosts, curatedPost } from './archive-curation.js';

export const ORIGIN = 'https://reddy.world';
export const BASE = '/portfolio';
// Full URL of this build; every absolute URL is built from it
export const SITE = `${ORIGIN}${BASE}`;
export const CONTACT = 'https://reddy.world/contact';
export const PERSON_ID = 'https://reddy.world/#ryan';

// cta: the line and button under each project page. Modelling asks for a booking, not an event.
// Ryan, 2026-10-25: "perhaps that should be a contact me about this project, any questions or advice !"
const CTA = { line: 'Contact me about this project: any questions or advice!', button: 'Get in touch' };
// Modelling has no subtitle: "Modelling" says it (Ryan, 2026-10-25: no words about the work)
const EXTRA = {
  rmaekers: { cta: CTA },
  rrproductions: { cta: CTA },
  // subject: Ryan is in these pictures, other people took them (src/lib/model-page.js)
  vaguelyvulgar: { subtitle: null, subject: true, cta: { line: 'Want to book Ryan Reddy for a shoot?', button: 'Get in touch' } },
};

/** "Name: subtitle", or the name alone when the portfolio has none */
export const portfolioLabel = (p) => (p.subtitle ? `${p.name}: ${p.subtitle}` : p.name);

// Two plain questions for every project. What kind of work (one project can be several),
// and where it was (club or festival). Built from the archive's own categories and tags,
// the same sorting the contact page uses (reddy.world src/data/projectTypes.ts).
const lower = (xs) => xs.map((x) => x.trim().toLowerCase());
const hasCat = (post, ...names) => lower(post.categories).some((c) => names.includes(c));
const hasTag = (post, ...names) => post.tags.some((t) => names.includes(t));
export const WHAT = [
  { id: 'signage', label: 'Signage & lettering', test: (p) => hasTag(p, 'signage') || hasCat(p, 'signing') },
  { id: 'light', label: 'Light', test: (p) => hasTag(p, 'light') },
  { id: 'furniture', label: 'Furniture', test: (p) => hasTag(p, 'furniture') || hasCat(p, 'furniture') },
  { id: 'decor', label: 'Decor & stages', test: (p) => p.portfolio === 'rmaekers' && (hasCat(p, 'clubs', 'festivals', 'projects', 'film/foto set') || hasTag(p, 'festivals')) },
  { id: 'rentals', label: 'Rentals', test: (p) => hasCat(p, 'rentals') },
  { id: 'artists', label: 'With other artists', test: (p) => hasCat(p, 'collaborating artists') },
  { id: 'design', label: '3D design & fashion', test: (p) => hasCat(p, '3d design', 'architecture', 'fashion', 'jewelry') },
];
export const WHERE = [
  { id: 'clubs', label: 'Clubs', test: (p) => hasCat(p, 'clubs') },
  { id: 'festivals', label: 'Festivals', test: (p) => hasTag(p, 'festivals') || hasCat(p, 'festivals') },
];
export const KIND_LABEL = Object.fromEntries([...WHAT, ...WHERE].map((k) => [k.id, k.label]));
const kindsOf = (post) => [...WHAT, ...WHERE].filter((k) => k.test(post)).map((k) => k.id);

export const portfolios = [rmaekers, rrproductions, vaguelyvulgar].map((p) => ({
  ...p,
  ...EXTRA[p.id],
  brand: BRAND[p.id],
  posts: publicArchivePosts(p.id, p.posts).map((post) => {
    const full = { ...curatedPost(p.id, post), ...(post.edited_title ? {title: post.edited_title} : {}), portfolio: p.id, path: `/${p.id}/${post.slug}/` };
    // videos another (hidden) post of the same site recorded, shown on this one: public YouTube videos only
    const films = full.films ? (p.posts.find((x) => String(x.id) === String(full.films))?.videos ?? []).filter((v) => v.kind === 'youtube' && v.status === 'public') : [];
    return { ...full, films, kinds: kindsOf(full) };
  }),
}));

// The filter rows for a set of posts: only the chips that have projects behind them.
export function filterRows(posts, { portfolioRow = false } = {}) {
  const present = (list) => list.filter((k) => posts.some((post) => post.kinds.includes(k.id)))
    .map((k) => ({ label: k.label, value: k.id }));
  const rows = [
    { name: 'what', key: 'kinds', label: 'What', chips: present(WHAT) },
    { name: 'where', key: 'kinds', label: 'Where', chips: present(WHERE) },
  ];
  if (portfolioRow) {
    const ids = [...new Set(posts.map((post) => post.portfolio))];
    rows.push({ name: 'portfolio', key: 'portfolio', label: 'Portfolio',
      chips: ids.map((id) => ({ label: portfolios.find((p) => p.id === id).name, value: id })) });
  }
  return rows;
}

export const portfolioById = Object.fromEntries(portfolios.map((p) => [p.id, p]));

export const allPosts = portfolios
  .flatMap((p) => p.posts)
  .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

// Series and themes that cut across portfolios. Each one is a post tag with its own page
// at /portfolio/theme/<tag>/ that lists every project across the portfolios.
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
    description: 'Light installations, lamps and lightboxes by Ryan Reddy and ReddyMaekers.' },
  { tag: 'furniture', label: 'Furniture',
    description: 'Furniture by Ryan Reddy across ReddyMaekers and RRproductions.' },
];
export const themeByTag = Object.fromEntries(THEME_TAGS.map((t) => [t.tag, t]));

// Clients and series (not kinds of work): links under "Clients & series" on a portfolio page.
const SERIES_TAGS = ['marktkantine', 'cantina', 'georgies'];
export function seriesLinks(posts) {
  return THEME_TAGS.filter((t) => SERIES_TAGS.includes(t.tag) && posts.some((post) => post.tags.includes(t.tag)))
    .map((t) => ({ label: t.label, href: `${BASE}/theme/${t.tag}/` }));
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
  return `${post.title.trim()}, photo ${index + 1}`;
}

/**
 * A few words of context for search engines: what kind of work, under which name, and when
 * ("Decor & stages by ReddyMaekers, 2017"). Every word comes from the archive's own data
 * (Ryan, 2026-10-16: "add more keywords to these sentences").
 */
export function contextOf(post) {
  const kind = post.kinds.map((k) => KIND_LABEL[k])[0];
  // an undated page (the modelling measurements) gets no year: they are current, not 2016's
  const year = post.undated ? '' : String(post.date || '').slice(0, 4);
  return `${kind ? `${kind} by ` : ''}${BRAND[post.portfolio]}${year ? `, ${year}` : ''}`;
}

const WIDTHS = [480, 800, 1200, 1600];
// Self-hosted copies of the old WordPress uploads live at images/<portfolio>/<YYYY>/<MM>/ and
// come with -480w, -800w and -1200w copies below their own width (scripts/image-variants.mjs).
const OWN_VARIANTS = [480, 800, 1200];
const OWN_WITH_VARIANTS = /^\/portfolio\/images\/[a-z]+\/\d{4}\/\d{2}\/.+\.(jpe?g|png)$/i;

/**
 * src, srcset and size of a picture. WordPress.com uploads have a ?w= resizer
 * for the smaller versions; it never upscales, so no width above the upload's
 * own is listed. Self-hosted pictures under images/<portfolio>/<YYYY>/<MM>/ use
 * their -480w/-800w/-1200w copies; other self-hosted pictures (public/images)
 * are served whole. GIFs and animated WebP stay whole to keep their animation.
 */
export function picture(media) {
  const { url, width, height } = media;
  if (OWN_WITH_VARIANTS.test(url) && width) {
    const widths = OWN_VARIANTS.filter((w) => w < width);
    const at = (w) => url.replace(/\.(jpe?g|png)$/i, `-${w}w.$1`);
    const srcset = [...widths.map((w) => `${at(w)} ${w}w`), `${url} ${width}w`];
    return { src: widths.includes(1200) ? at(1200) : url, srcset: srcset.join(', '), width, height };
  }
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
