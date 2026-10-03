// Used by astro.config.mjs at build time, so it reads the JSON directly.
import { readFileSync } from 'node:fs';

const KEYS = ['rmaekers', 'rrproductions', 'maup', 'vaguelyvulgar'];
const SITE = 'https://portfolio.reddy.world';

const byPath = new Map();
for (const key of KEYS) {
  const data = JSON.parse(readFileSync(new URL(`../data/${key}.json`, import.meta.url), 'utf-8'));
  for (const post of data.posts) {
    const img = post.media
      .filter((m) => m.type === 'image')
      .map((m, i) => ({ url: m.url, caption: m.alt || `${post.title.trim()} — photo ${i + 1}` }));
    byPath.set(`${SITE}/${key}/${post.slug}/`, img);
  }
}

export function imagesForPage(url) {
  return byPath.get(url) ?? [];
}
