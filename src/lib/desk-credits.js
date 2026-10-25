// Photographer credits the archive already has (written by scripts/import-image-keywords.mjs),
// by image desk key ("<portfolio>/<slug>::<url>"), as JSON for the desk's page.
import { portfolios, photos } from './portfolios.js';

export function archiveCredits() {
  const credits = Object.fromEntries(portfolios.flatMap((portfolio) => portfolio.posts.flatMap((post) => photos(post)
    .filter((image) => image.credit?.name)
    .map((image) => [`${portfolio.id}/${post.slug}::${image.url}`, image.credit]))));
  return JSON.stringify(credits).replace(/</g, '\\u003c');
}
