// Used by astro.config.mjs at build time, so it reads the JSON directly.
import { readFileSync, readdirSync } from 'node:fs';
import yaml from 'js-yaml';
import { absUrl } from './media-url.js';
import { BRAND } from './brands.js';

const KEYS = ['rmaekers', 'rrproductions', 'maup', 'vaguelyvulgar'];
const SITE = 'https://reddy.world/portfolio';

const byPath = new Map();
for (const key of KEYS) {
  const data = JSON.parse(readFileSync(new URL(`../data/${key}.json`, import.meta.url), 'utf-8'));
  for (const post of data.posts) {
    // the pictures the page shows, and its featured image
    const shown = post.media.filter((m) => m.type === 'image' && m.duplicate_of === undefined);
    if (post.featured && !shown.some((m) => m.url === post.featured.url)) shown.unshift(post.featured);
    // the picture's own words, then the project, under which name and when
    const about = `${post.title.trim()}, ${BRAND[key]}${post.date ? `, ${String(post.date).slice(0, 4)}` : ''}`;
    const img = shown.map((m, i) => ({ url: absUrl(m.url), caption: m.alt || m.caption ? `${m.alt || m.caption} — ${about}` : `${about}, photo ${i + 1}` }));
    byPath.set(`${SITE}/${key}/${post.slug}/`, { img, lastmod: post.modified });
  }
}

// The software case studies (src/content/software/<slug>.md): their screenshots, and the
// overview's last edit is the newest case study's
const day = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d));
const SOFTWARE_DIR = new URL('../content/software/', import.meta.url);
let newest = '';
for (const name of readdirSync(SOFTWARE_DIR).filter((f) => f.endsWith('.md'))) {
  const slug = name.replace(/\.md$/, '');
  const data = yaml.load(readFileSync(new URL(name, SOFTWARE_DIR), 'utf-8').split(/^---\s*$/m)[1]);
  const img = (data.screenshots ?? []).map((s) => ({
    url: absUrl(`/portfolio/images/software/${slug}/${s.file}`),
    caption: `${s.caption} — ${data.title}, by Ryan Reddy`,
  }));
  const lastmod = day(data.updated);
  if (lastmod > newest) newest = lastmod;
  byPath.set(`${SITE}/software/${slug}/`, { img, lastmod });
}
byPath.set(`${SITE}/software/`, { img: [], lastmod: newest || undefined });

/** Image entries and last edit of a project page, by its URL */
export function pageInfo(url) {
  return byPath.get(url) ?? { img: [] };
}
