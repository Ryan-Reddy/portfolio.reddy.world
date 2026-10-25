// Brings the keywords and descriptions Ryan wrote on the image desk
// (/portfolio/image-metadata/, kept only in his browser until he presses Export)
// into the archive data, so the pages, the sitemap and JSON-LD carry them.
//
//   node scripts/import-image-keywords.mjs reddy-world-image-metadata.json [--dry-run]
//   npm run keywords:import -- reddy-world-image-metadata.json
//
// Per picture (matched on its project and its url):
// - description: Ryan's description, when he wrote one, becomes the picture's
//   `description` and its `alt` text.
// - keywords: the project's shared keywords plus the picture's own become `keywords`
//   (the page's ImageObject in JSON-LD). With no description and no alt text yet, the
//   alt text becomes the project title followed by those keywords.
// Per project: its shared keywords become the post's `keywords` (the page's JSON-LD),
// and the lead picture Ryan chose (`hero`, a picture url) becomes the post's `featured`
// picture: it heads the page and the card, and the reddy.world wall takes it from rss.xml.
//
// Only words from the export are written; nothing is made up. An empty field in the
// export never clears what the data already has. Running it twice changes nothing.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const KEYS = ['rmaekers', 'rrproductions', 'vaguelyvulgar'];
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
// one of each word, ignoring case; the first spelling wins
const list = (xs) => {
  const seen = new Map();
  for (const x of (xs ?? []).map(clean).filter(Boolean)) if (!seen.has(x.toLowerCase())) seen.set(x.toLowerCase(), x);
  return [...seen.values()];
};
const tagsOf = (value) => list(Array.isArray(value) ? value : String(value ?? '').split(','));

/**
 * Applies a desk export to the archive data, in place.
 * @param {object} exported the parsed export (version 4: { projects, images })
 * @param {Record<string, object>} data the parsed src/data/<key>.json files, by key
 * @returns {{ pictures: number, projects: number, unmatched: string[] }}
 */
export function applyKeywords(exported, data) {
  if (!exported || typeof exported.images !== 'object') throw new Error('not an image desk export: no "images"');
  if (exported.version !== 4) throw new Error(`export version ${exported.version}; this importer reads version 4`);
  const report = { pictures: 0, projects: 0, heroes: 0, unmatched: [] };
  const postFor = (projectId) => {
    const [key, slug] = String(projectId).split('/');
    return data[key]?.posts.find((post) => post.slug === slug);
  };

  for (const [projectId, project] of Object.entries(exported.projects ?? {})) {
    const post = postFor(projectId);
    if (post && project?.hero && post.featured?.url !== project.hero) {
      const lead = post.media.find((m) => m.url === project.hero);
      if (lead) {
        const { id, url, alt, caption, width, height, wp_url } = lead;
        post.featured = Object.fromEntries(Object.entries({ id, url, alt, caption, width, height, wp_url }).filter(([, v]) => v !== undefined));
        report.heroes++;
      } else report.unmatched.push(`${projectId}::${project.hero} (lead picture)`);
    }
    const keywords = tagsOf(project?.tags);
    if (!post || !keywords.length) continue;
    const merged = list([...(post.keywords ?? []), ...keywords]);
    if (merged.length !== (post.keywords ?? []).length) report.projects++;
    post.keywords = merged;
  }

  for (const [key, entry] of Object.entries(exported.images)) {
    const projectId = entry.projectId ?? key.split('::')[0];
    const url = entry.url ?? key.split('::')[1];
    const post = postFor(projectId);
    const records = post ? [post.featured, ...post.media].filter((m) => m?.url === url) : [];
    if (!records.length) { report.unmatched.push(key); continue; }
    const description = clean(entry.description);
    const keywords = tagsOf(entry.keywords?.length ? entry.keywords : [...(entry.projectKeywords ?? []), ...(entry.imageKeywords ?? [])]);
    let changed = false;
    for (const media of records) {
      const before = JSON.stringify(media);
      if (description) {
        media.description = description;
        media.alt = description;
      } else if (keywords.length && !clean(media.alt)) {
        media.alt = `${clean(post.title)} — ${keywords.join(', ')}`;
      }
      if (keywords.length) media.keywords = list([...(media.keywords ?? []), ...keywords]);
      changed ||= JSON.stringify(media) !== before;
    }
    if (changed) report.pictures++;
  }
  return report;
}

// Command line: read the export, apply it to src/data/*.json and say what changed
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [file, flag] = process.argv.slice(2);
  if (!file) {
    console.error('usage: node scripts/import-image-keywords.mjs <reddy-world-image-metadata.json> [--dry-run]');
    process.exit(2);
  }
  const path = (key) => new URL(`../src/data/${key}.json`, import.meta.url);
  const data = Object.fromEntries(KEYS.map((key) => [key, JSON.parse(readFileSync(path(key), 'utf-8'))]));
  const report = applyKeywords(JSON.parse(readFileSync(file, 'utf-8')), data);
  if (flag !== '--dry-run') for (const key of KEYS) writeFileSync(path(key), `${JSON.stringify(data[key], null, 2)}\n`);
  console.log(`import-image-keywords: ${report.pictures} pictures, ${report.projects} projects and ${report.heroes} lead pictures updated${flag === '--dry-run' ? ' (dry run, nothing written)' : ''}`);
  if (report.unmatched.length) {
    console.error(`${report.unmatched.length} pictures in the export are not in the archive data (renamed or hidden since the export):\n${report.unmatched.join('\n')}`);
    process.exit(1);
  }
}
