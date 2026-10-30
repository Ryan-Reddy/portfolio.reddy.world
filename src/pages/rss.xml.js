import {pageLayout,bannerVideo,bannerFocus} from '../lib/page-layout.js';
import { absUrl } from '../lib/media-url.js';
import { allPosts, portfolioById, SITE } from '../lib/portfolios.js';
import { allArticles } from '../lib/articles.js';
import { KINDS, articlePath, articleImages } from '../lib/article-kinds.js';
import { pictureAt } from '../lib/software.js';
import {getCollection} from 'astro:content';
import {articleCraft, craftOf} from '../lib/piece-fields.js';

// RSS 2.0 feed of every project post (not the about or contact pages) and every article, newest first,
// with its picture. reddy.world's wall reads it: the first category names the portfolio, or for an
// article its kind, with "Article" after it.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const presentation=(value)=>`<reddy:layout>${pageLayout(value.pageLayout)}</reddy:layout><reddy:focus>${bannerFocus(value.bannerFocus)}</reddy:focus>${bannerVideo(value.bannerVideo)?'<reddy:video>'+bannerVideo(value.bannerVideo)+'</reddy:video>':''}`;
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
      ...(post.keywords ?? []).map(tag => `<category>${esc(tag)}</category>`),
      craftOf(post.craft) ? `<reddy:craft>${post.craft}</reddy:craft>` : '',
      presentation(post),
      image,
      '</item>',
    ].join('') };
  });
  const articles = await allArticles();
  const software = (await getCollection('software')).map(({id, data}) => ({id, branch: data.branch}));
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
      ...(data.tags ?? []).map(tag => `<category>${esc(tag)}</category>`),
      `<reddy:craft>${articleCraft({...data, related: data.related?.id}, software)}</reddy:craft>`,
      presentation(data),
      data.desk ? `<reddy:desk>${esc(data.desk)}</reddy:desk>` : '',
      hero ? `<media:content url="${esc(absUrl(hero.url))}" medium="image" width="${hero.width}" height="${hero.height}"/>` : '',
      '</item>',
    ].join('') });
  }
  items.sort((a, b) => b.when - a.when);
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/" xmlns:reddy="https://reddy.world/ns/desk">',
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
