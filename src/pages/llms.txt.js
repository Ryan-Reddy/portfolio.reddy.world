import { getCollection } from 'astro:content';
import { portfolios, portfolioLabel, SITE, CONTACT, formatDate } from '../lib/portfolios.js';
import { allArticles } from '../lib/articles.js';
import { KINDS, articlePath } from '../lib/article-kinds.js';

// https://llmstxt.org — a plain map of the archive for AI search tools
export async function GET() {
  const lines = [
    '# portfolio.reddy.world',
    '',
    '> Selected work by Ryan Reddy (Amsterdam): festival decors, stage builds and props (ReddyMaekers), objects and inventions (RRproductions), and modelling photographs.',
    '',
    `Contact and book a free discovery call: ${CONTACT}`,
    'Main site: https://reddy.world',
    '',
  ];
  for (const p of portfolios) {
    lines.push(`## ${portfolioLabel(p)}`, '');
    for (const post of p.posts) {
      const when = post.undated ? '' : ` (${formatDate(post.date)})`;
      // Ryan's summary from the image desk, else WordPress's excerpt
      const blurb = post.summary || post.excerpt;
      const summary = blurb ? `: ${blurb}` : '';
      lines.push(`- [${post.title.trim()}](${SITE}${post.path})${when}${summary}`);
    }
    lines.push('');
  }
  const software = (await getCollection('software')).sort((a, b) => a.data.order - b.data.order);
  lines.push(`## Software and websites: case studies, made by Reddy.World Enterprises`, '');
  for (const { id, data } of software) {
    lines.push(`- [${data.title}](${SITE}/software/${id}/) (${data.year}): ${data.summary}${data.live ? ` Live: ${data.live}` : ''}`);
  }
  lines.push('');
  // the articles: interviews, stories and the rest (src/content/articles/)
  const articles = await allArticles();
  if (articles.length) {
    lines.push('## Articles', '');
    for (const { id, data } of articles) {
      const who = data.person ? `, ${data.person.name}${data.person.org ? `, ${data.person.org}` : ''}` : '';
      lines.push(`- [${data.title}](${SITE}/${articlePath(data.kind, id)}) (${KINDS[data.kind].label}, ${data.year}, ${data.lang})${who}: ${data.summary ?? data.description}`);
    }
    lines.push('');
  }
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
