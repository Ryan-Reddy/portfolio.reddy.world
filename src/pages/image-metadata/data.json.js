// The desk's projects as a file, for the edit bar on the project pages (src/lib/edit-bar.js): what each
// project and picture has today, so the bar can show and edit it in place. Served next to the desk, which
// reddy.world moves to /private/portfolio/ (no-index); everything in it is on the public pages already.
import { deskProjects } from '../../lib/desk-keywords.js';

export function GET() {
  const projects = deskProjects().map(({ id, title, keywords, summary, excerpt, content, thumbs, hero, images }) => ({
    id, title, keywords, summary, excerpt, content, thumbs, hero,
    images: images.map(({ key, url, src, index, alt, description, existingDescription, keywords: words, credit }) => ({ key, url, src, index, alt, description, existingDescription, keywords: words, credit })),
  }));
  return new Response(JSON.stringify({ projects }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
