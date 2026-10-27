// The desk's published articles as files of the articles collection (src/content/articles/<slug>.md), for
// "Send to site" (scripts/import-image-keywords.mjs runs it on the desk; .github/workflows/desk-to-site.yml).
// - A draft never leaves the desk. One Ryan marked ready is written: its fields as front matter, its text
//   cleaned to the tags the pages allow (storyHtml), and `desk: <id>` so the file stays tied to its draft.
// - Back to draft, or deleted on the desk: the file its draft wrote is taken off the site.
// - The search description is his own words, cut to a search result's length (src/lib/snippet.js): the summary,
//   with the start of the text after it when the summary alone is short. Nothing is added.
// - Its pictures: the lead picture across the top and the ones in the text, as the web copies
//   scripts/desk-pictures.mjs made of them (`photos`), each as a project's picture is written
//   (scripts/import-image-keywords.mjs): what Ryan said it shows as its alt, its keywords for the page's
//   ImageObject (`hero.keywords`, `figures`), and its photographer as the caption "Photo: <name>".
// - Its videos: a YouTube or Vimeo link the text holds becomes a play button; the player loads on play.
// - Running it twice gives the same files: the dates come from the draft (when it was first published, when it
//   last changed), not from the day of the send.
import { storyHtml, httpUrl } from '../src/lib/safe-output.js';
import { cutAt, DESCRIPTION_MIN, DESCRIPTION_MAX } from '../src/lib/snippet.js';
import { KINDS } from '../src/lib/article-kinds.js';
import { videoFigure } from '../src/lib/article-video.js';

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const plain = (html) => clean(String(html ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
const day = (ms) => new Date(ms).toISOString().slice(0, 10);
// YAML for a string: JSON's quoting is valid YAML and keeps every character as it is
const str = (value) => JSON.stringify(String(value));
const attr = (value) => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
// a picture's keywords: one of each, no web addresses (as for a project's pictures)
const keywordsOf = (picture) => {
  const seen = new Map();
  for (const word of String(picture?.tags ?? '').split(',').map(clean).filter((w) => w && !w.includes('://'))) if (!seen.has(word.toLowerCase())) seen.set(word.toLowerCase(), word);
  return [...seen.values()];
};
// its photographer: the name as typed, the site only when it is an http(s) address
const creditOf = (picture) => {
  const name = clean(picture?.credit?.name);
  if (!name) return null;
  const url = httpUrl(clean(picture.credit.url));
  return url ? { name, url } : { name };
};
// the keywords and the credit as front matter, indented under a picture
function pictureLines(picture, indent) {
  const lines = [];
  const keywords = keywordsOf(picture);
  if (keywords.length) lines.push(`${indent}keywords:`, ...keywords.map((word) => `${indent}  - ${str(word)}`));
  const credit = creditOf(picture);
  if (credit) lines.push(`${indent}credit:`, `${indent}  name: ${str(credit.name)}`, ...(credit.url ? [`${indent}  url: ${str(credit.url)}`] : []));
  return lines;
}
// the caption under a picture in the text: its photographer, linked to their site
const captionOf = (credit) => (credit ? `<figcaption><span class="photo-credit">Photo: ${credit.url ? `<a href="${attr(credit.url)}" rel="noopener">${attr(credit.name)}</a>` : attr(credit.name)}</span></figcaption>` : '');

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

/** The pictures the page shows: the lead and the ones in the text (removed ones never) */
export function shownPictures(article) {
  const inText = [...String(article.content ?? '').matchAll(/data-picture="([a-z0-9]+)"/gi)].map((m) => m[1]);
  return [...new Set([article.hero, ...inText].filter((id) => id && article.pictures?.[id] && !article.pictures[id].removed))];
}

/** What still stops a ready draft from going on the site (empty: nothing). `photos`: the web copies made for it, when known */
export function missing(article, photos = null) {
  const out = [];
  if (!clean(article.title)) out.push('a title');
  if (!descriptionFrom(article.summary, article.content)) out.push('50 characters of summary or text');
  if (!KINDS[article.kind ?? 'story']) out.push(`a known kind (not "${article.kind}")`);
  if ((article.kind ?? 'story') === 'interview' && !(clean(article.person?.name) && clean(article.person?.role) && clean(article.byline))) out.push('the person: name, role and the words before the name');
  const shown = shownPictures(article);
  if (shown.some((id) => !clean(article.pictures[id].alt))) out.push('what every picture shows');
  if (photos && shown.some((id) => !photos[id])) out.push('its pictures copied from your account (try Send to site again)');
  return out;
}

/** One article file's text */
export function articleFile(id, article, { software = [], photos = {} } = {}) {
  const kind = article.kind ?? 'story';
  const lines = ['---', `kind: ${kind}`, `title: ${str(clean(article.title))}`];
  // fields the desk doesn't edit but keeps, when a draft came with them (src/data/article-seeds/)
  if (clean(article.titleLang)) lines.push(`titleLang: ${str(clean(article.titleLang))}`);
  if (clean(article.seoTitle)) lines.push(`seoTitle: ${str(clean(article.seoTitle))}`);
  lines.push(`description: ${str(descriptionFrom(article.summary, article.content))}`);
  if (clean(article.summary)) lines.push(`summary: ${str(clean(article.summary))}`);
  lines.push(`lang: ${str(article.lang || 'en')}`);
  const person = article.person ?? {};
  if (kind === 'interview') {
    lines.push(`byline: ${str(clean(article.byline))}`, 'person:', `  name: ${str(clean(person.name))}`, `  role: ${str(clean(person.role))}`);
    if (clean(person.roleLang)) lines.push(`  roleLang: ${str(clean(person.roleLang))}`);
    if (clean(person.org)) lines.push(`  org: ${str(clean(person.org))}`);
    const orgUrl = httpUrl(clean(person.orgUrl));
    if (orgUrl) lines.push(`  orgUrl: ${str(orgUrl)}`);
    // words of the role linked to where they stand: the draft's own (only words the role has), else the
    // organisation's name to its site (no words added)
    const given = Object.entries(person.roleLinks ?? {}).map(([words, url]) => [clean(words), httpUrl(clean(url))])
      .filter(([words, url]) => words && url && clean(person.role).includes(words));
    const links = given.length ? given : orgUrl && clean(person.org) && clean(person.role).includes(clean(person.org)) ? [[clean(person.org), orgUrl]] : [];
    if (links.length) lines.push('  roleLinks:', ...links.map(([words, url]) => `    ${str(words)}: ${str(url)}`));
    const sameAs = (person.orgSameAs ?? []).map((url) => httpUrl(clean(url))).filter(Boolean);
    if (sameAs.length) lines.push('  orgSameAs:', ...sameAs.map((url) => `    - ${str(url)}`));
    const profile = httpUrl(clean(person.profile));
    if (profile) lines.push(`  profile: ${str(profile)}`);
  }
  const year = Number(article.year) || new Date(article.created ?? article.readyAt ?? Date.now()).getFullYear();
  lines.push(`year: ${year}`, `published: ${day(article.readyAt ?? article.at ?? article.created)}`);
  const lead = article.hero && photos[article.hero] && article.pictures?.[article.hero];
  if (lead) {
    lines.push('hero:', `  file: ${str(photos[article.hero].file)}`, `  alt: ${str(clean(lead.alt))}`);
    if (photos[article.hero].share) lines.push(`  share: ${str(photos[article.hero].share)}`);
    lines.push(...pictureLines(lead, '  '));
  }
  // the pictures in the text, for the page's structured data, in the order the text has them
  const inText = shownPictures(article).filter((pid) => pid !== article.hero && photos[pid]);
  if (inText.length) {
    lines.push('figures:');
    for (const pid of inText) lines.push(`  - file: ${str(photos[pid].file)}`, `    alt: ${str(clean(article.pictures[pid].alt))}`, ...pictureLines(article.pictures[pid], '    '));
  }
  // Ryan's own words above the article
  const intro = String(article.intro?.text ?? '').trim();
  if (intro) lines.push('intro:', `  lang: ${str(clean(article.intro.lang) || article.lang || 'en')}`, `  text: ${str(intro)}`);
  if (article.related && software.includes(article.related)) lines.push(`related: ${str(article.related)}`);
  // the pictures in the text, as the pictures themselves (a marker of a picture without a copy goes)
  const body = storyHtml(article.content).trim().replace(/<figure data-picture="([a-z0-9]+)"><\/figure>/gi, (_, pid) => {
    const copy = photos[pid];
    const picture = article.pictures?.[pid];
    if (!copy || !picture || picture.removed) return '';
    return `<figure class="article-figure"><img src="${attr(copy.src)}" srcset="${attr(copy.srcset)}" sizes="(max-width: 900px) 100vw, 46rem" width="${copy.width}" height="${copy.height}" alt="${attr(clean(picture.alt))}" loading="lazy" decoding="async">${captionOf(creditOf(picture))}</figure>`;
  });
  // a video: a play button that loads the player (src/lib/article-video.js)
  const withVideos = body.replace(/<figure data-video="([^"]+)"><\/figure>/g, (_, key) => videoFigure(key));
  lines.push(`updated: ${day(article.at ?? article.readyAt ?? article.created)}`, `desk: ${str(id)}`, '---', '', withVideos, '');
  return lines.join('\n');
}

/** The address each ready article gets: its own, else from its title; one another file has gets a number */
export function readySlugs(state, existing = {}) {
  const taken = new Map(Object.entries(existing).map(([slug, file]) => [slug, file.desk ?? null]));
  const slugs = {};
  for (const [id, article] of Object.entries(state?.articles ?? {})) {
    if (!article || article.deleted || article.status !== 'ready') continue;
    const base = article.slug || slugFrom(article.title);
    if (!base) continue;
    let slug = base;
    for (let n = 2; taken.has(slug) && taken.get(slug) !== id; n++) slug = `${base}-${n}`;
    taken.set(slug, id);
    slugs[id] = slug;
  }
  return slugs;
}

/**
 * The files to write and to take off, for the desk's articles.
 * @param {object} state the desk (state.articles: {id: {title, summary, content, kind, lang, year, byline, person, related, pictures, hero, status, slug, readyAt, at, deleted}})
 * @param {Record<string, {desk?: string, text: string}>} existing the article files there are now, by slug
 * @param {{software?: string[], photos?: Record<string, object>}} options the case studies an article can belong to;
 *   per article id, the web copies of its pictures (scripts/desk-pictures.mjs)
 * @returns {{ write: {slug: string, text: string}[], remove: string[], waiting: {id: string, title: string, missing: string[]}[] }}
 */
export function articleFiles(state, existing = {}, { software = [], photos = {} } = {}) {
  const write = [];
  const remove = [];
  const waiting = [];
  const slugs = readySlugs(state, existing);
  const sent = new Set();
  for (const [id, article] of Object.entries(state?.articles ?? {})) {
    if (!article || article.deleted || article.status !== 'ready') continue;
    const needs = missing(article, photos[id] ?? {});
    if (needs.length || !slugs[id]) { waiting.push({ id, title: clean(article.title) || 'Untitled article', missing: needs.length ? needs : ['a title'] }); continue; }
    sent.add(id);
    const text = articleFile(id, article, { software, photos: photos[id] ?? {} });
    if (existing[slugs[id]]?.text !== text) write.push({ slug: slugs[id], text });
  }
  // a file a draft wrote, whose draft is back to draft or deleted: off the site (one still waiting stays as it was)
  const holding = new Set(waiting.map((w) => w.id));
  for (const [slug, file] of Object.entries(existing)) {
    if (file.desk && !sent.has(file.desk) && !holding.has(file.desk) && file.desk in (state?.articles ?? {})) remove.push(slug);
  }
  return { write, remove, waiting };
}

/** The `desk:` id in an article file's front matter, or undefined */
export const deskIdOf = (text) => String(text).match(/^---[\s\S]*?^desk:\s*"?([^"\n]+)"?\s*$/m)?.[1];
