// The articles collection at build time (src/content/articles/, src/lib/article-kinds.js).
import { getCollection } from 'astro:content';

/** getStaticPaths for one kind's folder: one page per article of that kind */
export async function articlePaths(kind) {
  const entries = await getCollection('articles', (entry) => entry.data.kind === kind);
  return entries.map((entry) => ({ params: { slug: entry.id }, props: { entry } }));
}

/** Every article, newest first (by when it went online, else its last update) */
export async function allArticles() {
  const entries = await getCollection('articles');
  const when = (entry) => (entry.data.published ?? entry.data.updated).getTime();
  return entries.sort((a, b) => when(b) - when(a));
}
