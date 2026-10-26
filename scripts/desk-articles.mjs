// The desk's published articles as files of the articles collection (src/content/articles/<slug>.md), for
// "Send to site" (scripts/import-image-keywords.mjs runs it on the desk; .github/workflows/desk-to-site.yml).
// - A draft never leaves the desk. One Ryan marked ready is written: its fields as front matter, its text
//   cleaned to the tags the pages allow (storyHtml), and `desk: <id>` so the file stays tied to its draft.
// - Back to draft, or deleted on the desk: the file its draft wrote is taken off the site.
// - The search description is his own words, cut to a search result's length (src/lib/snippet.js): the summary,
//   with the start of the text after it when the summary alone is short. Nothing is added.
// - Running it twice gives the same files: the dates come from the draft (when it was first published, when it
//   last changed), not from the day of the send.
import { storyHtml, httpUrl } from '../src/lib/safe-output.js';
import { cutAt, DESCRIPTION_MIN, DESCRIPTION_MAX } from '../src/lib/snippet.js';
import { KINDS } from '../src/lib/article-kinds.js';

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const plain = (html) => clean(String(html ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
const day = (ms) => new Date(ms).toISOString().slice(0, 10);
// YAML for a string: JSON's quoting is valid YAML and keeps every character as it is
const str = (value) => JSON.stringify(String(value));
/** The address an article gets from its title, as the site writes addresses */
export const slugFrom = (title) => String(title ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

/** The search description from the summary and the text: 50 to 160 characters, or null when there are too few words */
export function descriptionFrom(summary, html) {
  const own = clean(summary);
  const text = plain(html);
  const joined = own.length >= DESCRIPTION_MIN || !text ? own : clean(`${own.replace(/[.!?…]?$/, (stop) => (own ? stop || '.' : ''))} ${text}`);
  const cut = cutAt(joined, DESCRIPTION_MAX);
  return cut.length >= DESCRIPTION_MIN ? cut : null;
}

/** What still stops a ready draft from going on the site (empty: nothing) */
export function missing(article) {
  const out = [];
  if (!clean(article.title)) out.push('a title');
  if (!descriptionFrom(article.summary, article.content)) out.push('50 characters of summary or text');
  if (!KINDS[article.kind ?? 'story']) out.push(`a known kind (not "${article.kind}")`);
  if ((article.kind ?? 'story') === 'interview' && !(clean(article.person?.name) && clean(article.person?.role) && clean(article.byline))) out.push('the person: name, role and the words before the name');
  return out;
}

/** One article file's text */
export function articleFile(id, article, { software = [] } = {}) {
  const kind = article.kind ?? 'story';
  const lines = ['---', `kind: ${kind}`, `title: ${str(clean(article.title))}`, `description: ${str(descriptionFrom(article.summary, article.content))}`];
  if (clean(article.summary)) lines.push(`summary: ${str(clean(article.summary))}`);
  lines.push(`lang: ${str(article.lang || 'en')}`);
  const person = article.person ?? {};
  if (kind === 'interview') {
    lines.push(`byline: ${str(clean(article.byline))}`, 'person:', `  name: ${str(clean(person.name))}`, `  role: ${str(clean(person.role))}`);
    if (clean(person.org)) lines.push(`  org: ${str(clean(person.org))}`);
    const orgUrl = httpUrl(clean(person.orgUrl));
    if (orgUrl) {
      lines.push(`  orgUrl: ${str(orgUrl)}`);
      // the organisation's name in the role links to its site (no words added)
      if (clean(person.org) && clean(person.role).includes(clean(person.org))) lines.push('  roleLinks:', `    ${str(clean(person.org))}: ${str(orgUrl)}`);
    }
    const profile = httpUrl(clean(person.profile));
    if (profile) lines.push(`  profile: ${str(profile)}`);
  }
  const year = Number(article.year) || new Date(article.created ?? article.readyAt ?? Date.now()).getFullYear();
  lines.push(`year: ${year}`, `published: ${day(article.readyAt ?? article.at ?? article.created)}`);
  if (article.related && software.includes(article.related)) lines.push(`related: ${str(article.related)}`);
  lines.push(`updated: ${day(article.at ?? article.readyAt ?? article.created)}`, `desk: ${str(id)}`, '---', '', storyHtml(article.content).trim(), '');
  return lines.join('\n');
}

/**
 * The files to write and to take off, for the desk's articles.
 * @param {object} state the desk (state.articles: {id: {title, summary, content, kind, lang, year, byline, person, related, status, slug, readyAt, at, deleted}})
 * @param {Record<string, {desk?: string, text: string}>} existing the article files there are now, by slug
 * @param {{software?: string[]}} options the case studies an article can belong to
 * @returns {{ write: {slug: string, text: string}[], remove: string[], waiting: {id: string, title: string, missing: string[]}[] }}
 */
export function articleFiles(state, existing = {}, { software = [] } = {}) {
  const write = [];
  const remove = [];
  const waiting = [];
  const taken = new Map(Object.entries(existing).map(([slug, file]) => [slug, file.desk ?? null]));
  const ready = new Set();
  for (const [id, article] of Object.entries(state?.articles ?? {})) {
    if (!article || article.deleted || article.status !== 'ready') continue;
    const needs = missing(article);
    if (needs.length) { waiting.push({ id, title: clean(article.title) || 'Untitled article', missing: needs }); continue; }
    // its own address; another article's file with the same name keeps it, and this one gets a number
    let slug = article.slug || slugFrom(article.title);
    for (let n = 2; taken.has(slug) && taken.get(slug) !== id; n++) slug = `${article.slug || slugFrom(article.title)}-${n}`;
    taken.set(slug, id);
    ready.add(id);
    const text = articleFile(id, article, { software });
    if (existing[slug]?.text !== text) write.push({ slug, text });
  }
  // a file a draft wrote, whose draft is back to draft or deleted: off the site
  for (const [slug, file] of Object.entries(existing)) if (file.desk && !ready.has(file.desk) && file.desk in (state?.articles ?? {})) remove.push(slug);
  return { write, remove, waiting };
}

/** The `desk:` id in an article file's front matter, or undefined */
export const deskIdOf = (text) => String(text).match(/^---[\s\S]*?^desk:\s*"?([^"\n]+)"?\s*$/m)?.[1];
