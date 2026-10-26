import { absUrl } from '../lib/media-url.js';
import { allPosts, portfolioById, SITE } from '../lib/portfolios.js';
import { allArticles } from '../lib/articles.js';
import { KINDS, articlePath, articleImages } from '../lib/article-kinds.js';
import { pictureAt } from '../lib/software.js';

// RSS 2.0 feed of every project post (not the about or contact pages) and every article, newest first,
// with its picture. reddy.world's wall reads it: the first category names the portfolio, or for an
// article its kind, with "Article" after it.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rfc822 = (iso) => new Date(iso).toUTCString();
const posts = allPosts.filter((post) => post.type === 'post');

export async function GET() {
  const items = posts.map((post) => {
    const url = `${SITE}${post.path}`;
    const image = post.featured
      ? `<media:content url="${esc(absUrl(post.featured.url))}" medium="image"${post.featured.width ? ` width="${post.featured.width}" height="${post.featured.height}"` : ''}/>`
      : '';
    return { when: new Date(post.published).getTime(), xml: [
      '<item>',
      `<title>${esc(post.title.trim())}</title>`,
      `<link>${url}</link>`,
      `<guid isPermaLink="true">${url}</guid>`,
      `<pubDate>${rfc822(post.published)}</pubDate>`,
      // the wall shows this under the title: Ryan's summary from the image desk, else WordPress's excerpt
      `<description>${esc(post.summary || post.excerpt)}</description>`,
      `<category>${esc(portfolioById[post.portfolio].name)}</category>`,
      ...post.categories.map((c) => `<category>${esc(c)}</category>`),
      image,
      '</item>',
    ].join('') };
  });
  const articles = await allArticles();
  for (const { id, data } of articles) {
    const url = `${SITE}/${articlePath(data.kind, id)}`;
    const hero = data.hero && (await pictureAt(articleImages(id), data.hero.file));
    items.push({ when: (data.published ?? data.updated).getTime(), xml: [
      '<item>',
      `<title>${esc(data.title)}</title>`,
      `<link>${url}</link>`,
      `<guid isPermaLink="true">${url}</guid>`,
      `<pubDate>${rfc822(data.published ?? data.updated)}</pubDate>`,
      `<description>${esc(data.summary ?? data.description)}</description>`,
      `<category>${esc(KINDS[data.kind].label)}</category>`,
      '<category>Article</category>',
      hero ? `<media:content url="${esc(absUrl(hero.url))}" medium="image" width="${hero.width}" height="${hero.height}"/>` : '',
      '</item>',
    ].join('') });
  }
  items.sort((a, b) => b.when - a.when);
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">',
    '<channel>',
    '<title>Ryan Reddy: projects</title>',
    `<link>${SITE}/</link>`,
    `<atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml"/>`,
    '<description>Festival decors, stage builds, art, inventions and furniture by Ryan Reddy, Amsterdam.</description>',
    '<language>en</language>',
    `<lastBuildDate>${rfc822(posts.reduce((a, p) => (p.modified > a ? p.modified : a), ''))}</lastBuildDate>`,
    ...items.map((item) => item.xml),
    '</channel>',
    '</rss>',
  ].join('\n');
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
