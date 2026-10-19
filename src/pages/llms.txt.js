import { getCollection } from 'astro:content';
import { portfolios, SITE, CONTACT, formatDate } from '../lib/portfolios.js';

// https://llmstxt.org — a plain map of the archive for AI search tools
export async function GET() {
  const lines = [
    '# portfolio.reddy.world',
    '',
    '> Visual archive of Ryan Reddy (Amsterdam): festival decors, stage builds and props (ReddyMaekers), fine art, sculptures and inventions (RRproductions), adaptive furniture (Maup de Kleermaeker) and personal photography (Vaguely Vulgar).',
    '',
    `Contact and free 30-minute intro talks: ${CONTACT}`,
    'Main site: https://reddy.world',
    '',
  ];
  for (const p of portfolios) {
    lines.push(`## ${p.name}: ${p.subtitle}`, '');
    for (const post of p.posts) {
      const when = formatDate(post.date);
      const summary = post.excerpt ? `: ${post.excerpt}` : '';
      lines.push(`- [${post.title.trim()}](${SITE}${post.path}) (${when})${summary}`);
    }
    lines.push('');
  }
  const software = (await getCollection('software')).sort((a, b) => a.data.order - b.data.order);
  lines.push(`## Software and websites: case studies, made by Reddy.World Enterprises`, '');
  for (const { id, data } of software) {
    lines.push(`- [${data.title}](${SITE}/software/${id}/) (${data.year}): ${data.summary}${data.live ? ` Live: ${data.live}` : ''}`);
  }
  lines.push('');
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
