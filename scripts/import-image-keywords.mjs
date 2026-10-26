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
//   (the page's ImageObject in JSON-LD). With no description, an alt text that is empty or
//   that no person wrote (a file name, or this importer's own) becomes the title, the
//   picture's place on the page and up to three keywords ("Merchandise, photo 3 — brand
//   activation, fun, shop"). A keyword that is a web address ("://") is left out, and listed.
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
// Only projects Ryan marked done on the desk (projects[id].reviewed === true) are imported;
// the others are left alone: the export carries WordPress's own captions and the desk's
// guesses for those, not his words. A caption that is a file name (37737598_881…_o,
// IMG_6773, a UUID) or WordPress's "Enter a caption" never becomes alt text.
//
// The desk itself (the copy in Ryan's account, which .github/workflows/desk-to-site.yml
// fetches when he presses "Send to site") is read too, by applyDesk below:
//   node scripts/import-image-keywords.mjs desk.json [--dry-run]
// It holds only what he changed, so every project is read, done or not, and his value
// replaces the archive's; it also carries the short summary and the post's text.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isFileNameCaption, isMachineAlt, fallbackAlt } from '../src/lib/alt-text.js';
import { httpUrl, storyHtml } from '../src/lib/safe-output.js';
import { curatedPost } from '../src/lib/archive-curation.js';

export { isFileNameCaption };

const KEYS = ['rmaekers', 'rrproductions', 'vaguelyvulgar'];
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
// one of each word, ignoring case; the first spelling wins
const list = (xs) => {
  const seen = new Map();
  for (const x of (xs ?? []).map(clean).filter(Boolean)) if (!seen.has(x.toLowerCase())) seen.set(x.toLowerCase(), x);
  return [...seen.values()];
};
// the words of a tags field; web addresses are not keywords, they go to `dropped`
const tagsOf = (value, dropped = []) => list(Array.isArray(value) ? value : String(value ?? '').split(','))
  .filter((tag) => !tag.includes('://') || (dropped.includes(tag) || dropped.push(tag), false));
// the pictures a page shows, in order (src/lib/portfolios.js photos())
const shownOf = (post) => post.media.filter((m) => m.type === 'image' && m.duplicate_of === undefined);
// a photographer's credit from the export: the name as typed, the site only when it parses as http(s)
export const creditOf = (value) => {
  const name = clean(value?.name);
  if (!name) return undefined;
  const url = httpUrl(clean(value.url));
  return url ? { name, url } : { name };
};

/**
 * Applies a desk export to the archive data, in place.
 * @param {object} exported the parsed export (version 4: { projects, images })
 * @param {Record<string, object>} data the parsed src/data/<key>.json files, by key
 * @returns {{ pictures: number, projects: number, heroes: number, credits: number, skipped: number, unmatched: string[], dropped: string[], alts: {key: string, before: string, after: string}[] }}
 */
export function applyKeywords(exported, data) {
  if (!exported || typeof exported.images !== 'object') throw new Error('not an image desk export: no "images"');
  if (exported.version !== 4) throw new Error(`export version ${exported.version}; this importer reads version 4`);
  const report = { pictures: 0, projects: 0, heroes: 0, credits: 0, skipped: 0, unmatched: [], dropped: [], alts: [] };
  const postFor = (projectId) => {
    const [key, slug] = String(projectId).split('/');
    return data[key]?.posts.find((post) => post.slug === slug);
  };

  const done = Object.entries(exported.projects ?? {}).filter(([, project]) => project?.reviewed === true);
  for (const [projectId, project] of done) {
    const post = postFor(projectId);
    if (post && project?.hero) setLead(post, project.hero, projectId, report);
    const keywords = tagsOf(project?.tags, report.dropped);
    if (!post || !keywords.length) continue;
    const merged = tagsOf([...(post.keywords ?? []), ...keywords], report.dropped);
    if (JSON.stringify(merged) !== JSON.stringify(post.keywords ?? [])) report.projects++;
    post.keywords = merged;
  }

  const opened = new Set(done.map(([projectId]) => projectId));
  for (const [key, entry] of Object.entries(exported.images)) {
    const projectId = entry.projectId ?? key.split('::')[0];
    const url = entry.url ?? key.split('::')[1];
    if (!opened.has(projectId)) { report.skipped++; continue; }
    const post = postFor(projectId);
    const records = post ? [post.featured, ...post.media].filter((m) => m?.url === url) : [];
    if (!records.length) { report.unmatched.push(key); continue; }
    const description = isFileNameCaption(entry.description, url) ? '' : clean(entry.description);
    const keywords = tagsOf(entry.keywords?.length ? entry.keywords : [...(entry.projectKeywords ?? []), ...(entry.imageKeywords ?? [])], report.dropped);
    const shown = shownOf(post);
    const position = (shown.findIndex((m) => m.url === url) + 1) || (post.media.filter((m) => m.type === 'image').findIndex((m) => m.url === url) + 1) || 1;
    // the picture's own photographer, else the one for the whole project
    const credit = creditOf(entry.credit) ?? creditOf(exported.projects?.[projectId]?.credit);
    let changed = false;
    let credited = false;
    for (const media of records) {
      const before = JSON.stringify(media);
      if (description) {
        media.description = description;
        media.alt = description;
      } else if (clean(media.alt) ? isMachineAlt(media.alt, url, post.title) : keywords.length) {
        // (an empty alt with no keywords is left empty: the page says "Title, photo 3" itself)
        // the title, where the picture sits, and three of his words: alt text describes, it is not a keyword list
        media.alt = fallbackAlt(post.title, position, keywords);
      }
      if (keywords.length) media.keywords = tagsOf([...(media.keywords ?? []), ...keywords], report.dropped);
      const was = JSON.parse(before).alt ?? '';
      if (media.alt !== was && !report.alts.some((a) => a.key === key && a.after === media.alt)) report.alts.push({ key, before: was, after: media.alt });
      changed ||= JSON.stringify(media) !== before;
      // a credit alone counts as "credited", not as an updated picture
      if (credit && JSON.stringify(media.credit) !== JSON.stringify(credit)) {
        media.credit = credit;
        credited = true;
      }
    }
    if (changed) report.pictures++;
    if (credited) report.credits++;
  }
  return report;
}

// the lead picture Ryan chose becomes the post's `featured` picture (a copy of the media record)
function setLead(post, hero, projectId, report) {
  if (post.featured?.url === hero) return;
  const lead = post.media.find((m) => m.url === hero);
  if (!lead) return report.unmatched.push(`${projectId}::${hero} (lead picture)`);
  const { id, url, alt, caption, width, height, wp_url, credit } = lead;
  post.featured = Object.fromEntries(Object.entries({ id, url, alt, caption, width, height, wp_url, credit }).filter(([, v]) => v !== undefined));
  report.heroes++;
}

const filled = (value) => (typeof value === 'string' ? value.trim() !== '' : value !== undefined && value !== null);
const sameText = (a, b) => String(a ?? '').replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim() === String(b ?? '').replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();

/**
 * Applies the desk itself to the archive data, in place: the state the desk keeps in Ryan's account
 * ({ projects: {id: {tags, hero, credit, summary, content, reviewed}}, images: {key: {description, tags, credit}} }).
 * The desk opens on the archive's own values and writes a record only once Ryan changes one, so every
 * project is read, done or not, and a value he gave replaces the archive's (a keyword he removed goes).
 * A blank value means "not changed" (the desk writes blanks by merely showing a project) and changes nothing.
 * The post's text is cleaned to the tags the pages allow (storyHtml) and kept as `edited_content`, which
 * src/lib/archive-curation.js shows as it stands. Running it twice changes nothing.
 * @returns {{ pictures: number, projects: number, heroes: number, credits: number, summaries: number, texts: number, unmatched: string[], dropped: string[], alts: {key: string, before: string, after: string}[] }}
 */
export function applyDesk(state, data) {
  if (!state || typeof state.projects !== 'object' || typeof state.images !== 'object') throw new Error('not an image desk: no "projects" and "images"');
  const report = { pictures: 0, projects: 0, heroes: 0, credits: 0, summaries: 0, texts: 0, unmatched: [], dropped: [], alts: [] };
  const postFor = (projectId) => {
    const [key, slug] = String(projectId).split('/');
    return data[key]?.posts.find((post) => post.slug === slug);
  };
  // the records per project; a picture saved by an early desk under its url alone is found by its url
  const work = new Map(Object.entries(state.projects).map(([id, record]) => [id, { record: record ?? {}, images: new Map() }]));
  for (const [key, record] of Object.entries(state.images)) {
    let [projectId, url] = key.includes('::') ? key.split('::') : [undefined, key];
    projectId ??= KEYS.flatMap((k) => data[k].posts.filter((post) => post.media.some((m) => m.url === url)).map((post) => `${k}/${post.slug}`))[0];
    if (!projectId) { report.unmatched.push(key); continue; }
    if (!work.has(projectId)) work.set(projectId, { record: {}, images: new Map() });
    work.get(projectId).images.set(url, record ?? {});
  }

  for (const [projectId, { record, images }] of work) {
    const post = postFor(projectId);
    if (!post) { if (!Object.values(record).every((v) => !filled(v) || v === false)) report.unmatched.push(projectId); continue; }
    const portfolio = projectId.split('/')[0];
    const before = JSON.stringify({ keywords: post.keywords, summary: post.summary, edited_content: post.edited_content });
    const archiveWords = post.keywords ?? [];
    const projectWords = filled(record.tags) ? tagsOf(record.tags, report.dropped) : null;
    if (projectWords?.length) post.keywords = projectWords;
    if (filled(record.summary)) {
      const summary = clean(record.summary);
      if (summary !== post.summary) { post.summary = summary; report.summaries++; }
    }
    if (filled(record.content)) {
      const text = storyHtml(record.content).trim();
      if (text && !sameText(text, curatedPost(portfolio, post).content)) { post.edited_content = text; report.texts++; }
    }
    if (filled(record.hero)) setLead(post, record.hero, projectId, report);
    if (JSON.stringify({ keywords: post.keywords, summary: post.summary, edited_content: post.edited_content }) !== before) report.projects++;

    const sharedWords = post.keywords ?? [];
    const shown = shownOf(post);
    const urls = [...new Set(post.media.filter((m) => m.type === 'image').map((m) => m.url))];
    for (const url of images.keys()) if (!urls.includes(url)) report.unmatched.push(`${projectId}::${url}`);
    for (const url of urls) {
      const own = images.get(url) ?? {};
      const credit = creditOf(own.credit) ?? creditOf(record.credit);
      const ownWords = filled(own.tags) ? tagsOf(own.tags, report.dropped) : null;
      const description = filled(own.description) && !isFileNameCaption(own.description, url) ? clean(own.description) : '';
      if (!projectWords?.length && !ownWords && !description && !credit) continue;
      const records = [post.featured, ...post.media].filter((m) => m?.url === url);
      const position = (shown.findIndex((m) => m.url === url) + 1) || (urls.indexOf(url) + 1);
      let changed = false;
      let credited = false;
      for (const media of records) {
        const was = JSON.stringify(media);
        if (projectWords?.length || ownWords) {
          // the picture's own words: Ryan's, else the ones it has beyond the project's (old) keywords
          const mine = ownWords ?? (media.keywords ?? []).filter((word) => !archiveWords.some((shared) => shared.toLowerCase() === word.toLowerCase()));
          const keywords = tagsOf([...sharedWords, ...mine], report.dropped);
          if (keywords.length) media.keywords = keywords;
        }
        if (description) {
          media.description = description;
          media.alt = description;
        } else if (clean(media.alt) ? isMachineAlt(media.alt, url, post.title) : media.keywords?.length) {
          media.alt = fallbackAlt(post.title, position, media.keywords ?? []);
        }
        const altBefore = JSON.parse(was).alt ?? '';
        if (media.alt !== altBefore && !report.alts.some((a) => a.key === `${projectId}::${url}` && a.after === media.alt)) report.alts.push({ key: `${projectId}::${url}`, before: altBefore, after: media.alt });
        changed ||= JSON.stringify(media) !== was;
        if (credit && JSON.stringify(media.credit) !== JSON.stringify(credit)) {
          media.credit = credit;
          credited = true;
        }
      }
      if (changed) report.pictures++;
      if (credited) report.credits++;
    }
  }
  return report;
}

// Command line: read the export (or the desk itself), apply it to src/data/*.json and say what changed
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [file, flag] = process.argv.slice(2);
  if (!file) {
    console.error('usage: node scripts/import-image-keywords.mjs <reddy-world-image-metadata.json | desk.json> [--dry-run]');
    process.exit(2);
  }
  const path = (key) => new URL(`../src/data/${key}.json`, import.meta.url);
  const data = Object.fromEntries(KEYS.map((key) => [key, JSON.parse(readFileSync(path(key), 'utf-8'))]));
  const input = JSON.parse(readFileSync(file, 'utf-8'));
  const fromDesk = input.version === undefined;
  const report = fromDesk ? applyDesk(input, data) : applyKeywords(input, data);
  if (flag !== '--dry-run') for (const key of KEYS) writeFileSync(path(key), `${JSON.stringify(data[key], null, 2)}\n`);
  if (fromDesk) console.log(`import-image-keywords (the desk): ${report.projects} projects (${report.summaries} summaries, ${report.texts} texts), ${report.pictures} pictures and ${report.heroes} lead pictures updated, ${report.credits} pictures credited${flag === '--dry-run' ? ' (dry run, nothing written)' : ''}`);
  else console.log(`import-image-keywords: ${report.pictures} pictures, ${report.projects} projects and ${report.heroes} lead pictures updated, ${report.credits} pictures credited; ${report.skipped} pictures of projects not marked done on the desk left alone${flag === '--dry-run' ? ' (dry run, nothing written)' : ''}`);
  for (const { key, before, after } of report.alts) console.log(`alt ${key}
  before: ${before}
  after:  ${after}`);
  if (report.dropped.length) console.log(`${report.dropped.length} keywords left out, they are web addresses: ${report.dropped.join(' | ')}`);
  if (report.unmatched.length) {
    console.error(`${report.unmatched.length} pictures in the export are not in the archive data (renamed or hidden since the export):\n${report.unmatched.join('\n')}`);
    process.exit(1);
  }
}
