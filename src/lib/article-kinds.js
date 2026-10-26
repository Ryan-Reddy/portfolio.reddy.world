// The kinds of article (reddy.world#183, decision 4 B, Ryan 2026-10-26: "B: articles collection first"):
// where each lives under /portfolio/, and its label on the wall and in the feed. One file per article in
// src/content/articles/ (src/content.config.ts); the page is src/components/Article.astro.
// Plain data, no astro:content, so astro.config's sitemap (src/lib/sitemap-images.js) can read it too.
export const KINDS = {
  interview: { path: 'interviews', label: 'Interview' },
  story: { path: 'stories', label: 'Story' },
  'case-study': { path: 'case-studies', label: 'Case study' },
  project: { path: 'projects', label: 'Project' },
  recipe: { path: 'recipes', label: 'Recipe' },
  writing: { path: 'writing', label: 'Writing' },
  poem: { path: 'poetry', label: 'Poem' },
};
export const KIND_IDS = Object.keys(KINDS);

/** An article's address under the site root (/portfolio), e.g. "interviews/fenne-roefs-mijksenaar/" */
export const articlePath = (kind, slug) => `${KINDS[kind].path}/${slug}/`;
/** Where an article's pictures sit: public/images/articles/<slug>/ */
export const articleImages = (slug) => `articles/${slug}`;
