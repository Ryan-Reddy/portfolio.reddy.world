import { allPosts, portfolioById, SITE } from '../lib/portfolios.js';

// RSS 2.0 feed of every project post (not the about or contact pages), newest first, with its featured image
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rfc822 = (iso) => new Date(iso).toUTCString();
const posts = allPosts.filter((post) => post.type === 'post');

export function GET() {
  const items = posts.map((post) => {
    const url = `${SITE}${post.path}`;
    const image = post.featured
      ? `<media:content url="${esc(post.featured.url)}" medium="image"${post.featured.width ? ` width="${post.featured.width}" height="${post.featured.height}"` : ''}/>`
      : '';
    return [
      '<item>',
      `<title>${esc(post.title.trim())}</title>`,
      `<link>${url}</link>`,
      `<guid isPermaLink="true">${url}</guid>`,
      `<pubDate>${rfc822(post.published)}</pubDate>`,
      `<description>${esc(post.excerpt)}</description>`,
      `<category>${esc(portfolioById[post.portfolio].name)}</category>`,
      ...post.categories.map((c) => `<category>${esc(c)}</category>`),
      image,
      '</item>',
    ].join('');
  });
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
    ...items,
    '</channel>',
    '</rss>',
  ].join('\n');
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
