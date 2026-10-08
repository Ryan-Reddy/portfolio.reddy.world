// Used by astro.config.mjs at build time, so it reads the JSON directly.
import { readFileSync } from 'node:fs';

const KEYS = ['rmaekers', 'rrproductions', 'maup', 'vaguelyvulgar'];
const SITE = 'https://reddy.world/portfolio';

const byPath = new Map();
for (const key of KEYS) {
  const data = JSON.parse(readFileSync(new URL(`../data/${key}.json`, import.meta.url), 'utf-8'));
  for (const post of data.posts) {
    // the pictures the page shows, and its featured image
    const shown = post.media.filter((m) => m.type === 'image' && m.duplicate_of === undefined);
    if (post.featured && !shown.some((m) => m.url === post.featured.url)) shown.unshift(post.featured);
    const img = shown.map((m, i) => ({ url: m.url, caption: m.alt || m.caption || `${post.title.trim()} — photo ${i + 1}` }));
    byPath.set(`${SITE}/${key}/${post.slug}/`, { img, lastmod: post.modified });
  }
}

/** Image entries and last edit of a project page, by its URL */
export function pageInfo(url) {
  return byPath.get(url) ?? { img: [] };
}
