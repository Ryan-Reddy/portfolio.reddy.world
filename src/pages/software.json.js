import { getCollection } from 'astro:content';
import { shot } from '../lib/software.js';
import { appFacts } from '../lib/app-json.js';
import { ORIGIN, SITE } from '../lib/portfolios.js';

// /portfolio/software.json: the software case studies as data, for reddy.world's wall
// (Ryan, 2026-10-19: "Archive is the source"). The wall reads it at runtime, like rss.xml.
// URLs of pictures are root-absolute; pages and live links are absolute.
// version, updated and description come from the app's own /app.json at build time; when it
// isn't there they are null, never a hand-typed value (Ryan, 2026-10-19).
// updated: the app's last release. pageUpdated: the case study's last change.
export async function GET() {
  const entries = (await getCollection('software')).sort((a, b) => a.data.order - b.data.order);
  const apps = await Promise.all(entries.map(async ({ id, data }) => {
    const pictures = await Promise.all(data.screenshots.map(async (s) => {
      const p = await shot(id, s);
      return { kind: s.kind, src: p.src, srcset: p.srcset, width: p.width, height: p.height, alt: p.alt, caption: p.caption };
    }));
    const { stores, button, release, description } = await appFacts(data);
    return {
      slug: id,
      name: data.title,
      summary: data.summary,
      line: data.dek,
      kind: data.kind,
      status: data.status,
      version: release?.version ?? null,
      updated: release?.updated ?? null,
      year: data.year,
      description,
      live: data.live ?? null,
      code: data.repo ?? null,
      stores,
      button,
      page: `${SITE}/software/${id}/`,
      pageUpdated: data.updated.toISOString().slice(0, 10),
      hero: pictures[0] ?? null,
      pictures,
    };
  }));
  const body = { source: `${SITE}/software/`, origin: ORIGIN, apps };
  return new Response(JSON.stringify(body, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
