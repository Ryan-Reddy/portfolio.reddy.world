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
//   alt text becomes the project title followed by the first three of those keywords.
// Per project: its shared keywords become the post's `keywords` (the page's JSON-LD),
// and the lead picture Ryan chose (`hero`, a picture url) becomes the post's `featured`
// picture: it heads the page and the card, and the reddy.world wall takes it from rss.xml.
// Credits: the photographer Ryan typed for a picture (`credit: { name, url }`), or else the
// one he typed for its whole project, becomes the picture's `credit` (its caption reads
// "Photo: <name>", and the page's ImageObject gets the photographer as its creator). The
// site goes in only when it is an http(s) address; a credit without a name is ignored.
//
// Only words from the export are written; nothing is made up. An empty field in the
// export never clears what the data already has. Running it twice changes nothing.
// Pictures of projects Ryan never opened on the desk are left alone: the export carries
// WordPress's own captions for those, not his words. A caption that is only the file
// name (37737598_881…_o) or WordPress's "Enter a caption" never becomes alt text.
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
const letters = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const fileName = (url) => String(url ?? '').split('/').pop().replace(/\.[a-z0-9]+$/i, '');
// a description that says nothing: the picture's own file name, or WordPress's placeholder
export const isFileNameCaption = (description, url) => {
  const text = letters(description);
  return !text || text === letters(fileName(url)) || ['enteracaption', 'image', 'capture'].includes(text);
};
// a photographer's credit from the export: the name as typed, the site only when it parses as http(s)
export const creditOf = (value) => {
  const name = clean(value?.name);
  if (!name) return undefined;
  let url;
  try {
    const parsed = new URL(clean(value.url));
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') url = parsed.href;
  } catch {}
  return url ? { name, url } : { name };
};

/**
 * Applies a desk export to the archive data, in place.
 * @param {object} exported the parsed export (version 4: { projects, images })
 * @param {Record<string, object>} data the parsed src/data/<key>.json files, by key
 * @returns {{ pictures: number, projects: number, heroes: number, credits: number, skipped: number, unmatched: string[] }}
 */
export function applyKeywords(exported, data) {
  if (!exported || typeof exported.images !== 'object') throw new Error('not an image desk export: no "images"');
  if (exported.version !== 4) throw new Error(`export version ${exported.version}; this importer reads version 4`);
  const report = { pictures: 0, projects: 0, heroes: 0, credits: 0, skipped: 0, unmatched: [] };
  const postFor = (projectId) => {
    const [key, slug] = String(projectId).split('/');
    return data[key]?.posts.find((post) => post.slug === slug);
  };

  for (const [projectId, project] of Object.entries(exported.projects ?? {})) {
    const post = postFor(projectId);
    if (post && project?.hero && post.featured?.url !== project.hero) {
      const lead = post.media.find((m) => m.url === project.hero);
      if (lead) {
        const { id, url, alt, caption, width, height, wp_url, credit } = lead;
        post.featured = Object.fromEntries(Object.entries({ id, url, alt, caption, width, height, wp_url, credit }).filter(([, v]) => v !== undefined));
        report.heroes++;
      } else report.unmatched.push(`${projectId}::${project.hero} (lead picture)`);
    }
    const keywords = tagsOf(project?.tags);
    if (!post || !keywords.length) continue;
    const merged = list([...(post.keywords ?? []), ...keywords]);
    if (merged.length !== (post.keywords ?? []).length) report.projects++;
    post.keywords = merged;
  }

  const opened = new Set(Object.keys(exported.projects ?? {}));
  for (const [key, entry] of Object.entries(exported.images)) {
    const projectId = entry.projectId ?? key.split('::')[0];
    const url = entry.url ?? key.split('::')[1];
    if (!opened.has(projectId)) { report.skipped++; continue; }
    const post = postFor(projectId);
    const records = post ? [post.featured, ...post.media].filter((m) => m?.url === url) : [];
    if (!records.length) { report.unmatched.push(key); continue; }
    const description = isFileNameCaption(entry.description, url) ? '' : clean(entry.description);
    const keywords = tagsOf(entry.keywords?.length ? entry.keywords : [...(entry.projectKeywords ?? []), ...(entry.imageKeywords ?? [])]);
    // the picture's own photographer, else the one for the whole project
    const credit = creditOf(entry.credit) ?? creditOf(exported.projects?.[projectId]?.credit);
    let changed = false;
    let credited = false;
    for (const media of records) {
      const before = JSON.stringify(media);
      if (description) {
        media.description = description;
        media.alt = description;
      } else if (keywords.length && !clean(media.alt)) {
        // the title and its first three words: alt text describes, it is not a keyword list
        media.alt = `${clean(post.title)} — ${keywords.filter((word) => word.toLowerCase() !== clean(post.title).toLowerCase()).slice(0, 3).join(', ')}`;
      }
      if (keywords.length) media.keywords = list([...(media.keywords ?? []), ...keywords]);
      if (credit && JSON.stringify(media.credit) !== JSON.stringify(credit)) {
        media.credit = credit;
        credited = true;
      }
      changed ||= JSON.stringify(media) !== before;
    }
    if (changed) report.pictures++;
    if (credited) report.credits++;
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
  console.log(`import-image-keywords: ${report.pictures} pictures, ${report.projects} projects and ${report.heroes} lead pictures updated, ${report.credits} pictures credited; ${report.skipped} pictures of projects not opened on the desk left alone${flag === '--dry-run' ? ' (dry run, nothing written)' : ''}`);
  if (report.unmatched.length) {
    console.error(`${report.unmatched.length} pictures in the export are not in the archive data (renamed or hidden since the export):\n${report.unmatched.join('\n')}`);
    process.exit(1);
  }
}
