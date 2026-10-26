// Fetches the ratings for the image desk's third column into src/data/keyword-ratings.json.
// Runs before every build (npm run build); the page reads the file, so it has no keys and makes no calls.
//
//   npm run keywords:rate                       refresh what is missing or older than 30 days
//   KEYWORD_RATINGS=off npm run build           build with the file as it is, no fetching
//   KEYWORD_RATINGS_BUDGET=600 npm run keywords:rate   allow ten minutes instead of two
//
// Sources, all free and called one request at a time (their terms: see the comparison on issue #46):
// - Wikipedia (en, nl): readers of a topic's page in the last 30 days, and related pages from its search.
//   A phrase with no page of its own is rated by the closest page Wikipedia's search finds for it, when
//   that page shares a word with it (marked ≈ on the desk).
// - Wikimedia's pageview REST API, for the trend: the page's readers in the last full month against the
//   same month a year before, measured against all of that Wikipedia over the same months (it shrinks
//   year on year), so a season or Wikipedia's own decline is not taken for a rising word.
//   Wikimedia asks for a User-Agent with contact details and requests in series, not in parallel.
// - Datamuse: related words ("means like"); free without a key up to 100,000 requests a day.
// - Bing Webmaster Tools, only when BING_WEBMASTER_API_KEY is set: weekly searches in the Netherlands
//   for the exact words (GetKeywordStats), the last 4 weeks and the 4 before. The key stays in the build;
//   only the counts reach the page.
//
// Never fails the build: a source that is down leaves its words as they were (or "no data").
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { coreOf, normalize, rateable, stems } from '../src/lib/keyword-ratings.js';

const OUT = fileURLToPath(new URL('../src/data/keyword-ratings.json', import.meta.url));
const USER_AGENT = 'reddy.world-image-desk/1.0 (https://reddy.world/contact; build-time keyword ratings)';
const DAY = 24 * 60 * 60 * 1000;
export const MAX_AGE_DAYS = 30;
// entries written before the year-on-year trend and the closest page were kept are fetched again
export const VERSION = 4;
// Wikimedia allows about 200 requests a minute without a key
const GAP_MS = 300;

export function emptyRatings() {
  return {
    about: 'Ratings for the image desk\'s third column. Written by scripts/keyword-ratings.mjs; read by src/lib/keyword-ratings.js.',
    updatedAt: null,
    sources: {},
    topics: {},
    bing: {},
  };
}

export function readRatings(file = OUT) {
  try {
    return existsSync(file) ? { ...emptyRatings(), ...JSON.parse(readFileSync(file, 'utf-8')) } : emptyRatings();
  } catch {
    return emptyRatings();
  }
}

/** Topics (words without place names) and exact words to look up, from the desk's own words. */
export function lookups(wordLists) {
  const topics = new Set();
  const words = new Set();
  for (const list of wordLists) {
    for (const word of list) {
      if (!rateable(word)) continue;
      words.add(normalize(word));
      topics.add(coreOf(word).core);
    }
  }
  return { topics: [...topics].sort(), words: [...words].sort() };
}

export const isStale = (entry, now, maxAgeDays = MAX_AGE_DAYS, version = null) => !entry?.fetchedAt || now - Date.parse(entry.fetchedAt) > maxAgeDays * DAY || (version !== null && entry.v !== version);

/** Tidies a Wikipedia title into a keyword: no "(disambiguation)" part, lower case unless it is a name. */
export function titleToTag(title) {
  const plain = String(title).replace(/\s*\([^)]*\)\s*$/, '').trim();
  return /^[A-Z][a-z-]+(?: [a-z][a-z-]*)*$/.test(plain) ? plain.toLowerCase() : plain;
}

const sumViews = (pageviews) => {
  if (!pageviews || typeof pageviews !== 'object') return null;
  const values = Object.values(pageviews).filter((v) => typeof v === 'number');
  return values.length ? values.reduce((a, b) => a + b, 0) : 0;
};

/**
 * Readers in the last 30 days, from Wikipedia's daily counts (date -> count). Today and other days at the
 * end that have no count yet are left out, so the sum covers 30 whole days.
 */
export function lastThirtyDays(pageviews) {
  if (!pageviews || typeof pageviews !== 'object') return null;
  const days = Object.keys(pageviews).sort();
  while (days.length && typeof pageviews[days.at(-1)] !== 'number') days.pop();
  return days.slice(-30).reduce((sum, day) => sum + (typeof pageviews[day] === 'number' ? pageviews[day] : 0), 0);
}

/** One request at a time, a pause between them, one retry (after the wait a 429 asks for); null when the source is down. */
export function politeFetcher({ fetchImpl = globalThis.fetch, gapMs = GAP_MS, deadline = Infinity, log = () => {} } = {}) {
  let last = 0;
  let failures = 0;
  return async function fetchJson(url, init = {}) {
    if (Date.now() > deadline || failures >= 8) return null;
    let retryAfter = 0;
    for (let attempt = 0; attempt < 2; attempt++) {
      const wait = Math.max(last + gapMs * (attempt + 1) - Date.now(), retryAfter);
      if (wait > 0) await new Promise((r) => setTimeout(r, Math.min(wait, 30000)));
      last = Date.now();
      try {
        const res = await fetchImpl(url, { ...init, headers: { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT, Accept: 'application/json', ...init.headers }, signal: AbortSignal.timeout(15000) });
        if (res.ok) return await res.json();
        log(`  ${res.status} from ${new URL(url).host}`);
        if (res.status === 404) return null; // a page with no counts (too new, or none): not a failure of the source
        if (res.status < 500 && res.status !== 429) break;
        retryAfter = (Number(res.headers?.get?.('retry-after')) || 0) * 1000;
      } catch (error) {
        log(`  ${new URL(url).host}: ${error.message}`);
      }
    }
    failures++;
    return null;
  };
}

// ---------- the trend: the last full month against the same month a year before ----------
const stampOf = (date) => `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}0100`;
/**
 * The last full month and the same month a year before, as Wikimedia's REST API writes them (YYYYMM0100),
 * and the range to ask for: up to the month's last day, since the API cuts a month off at the end given.
 */
export function trendMonths(now) {
  const today = new Date(now);
  const month = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  const yearBefore = new Date(Date.UTC(month.getUTCFullYear() - 1, month.getUTCMonth(), 1));
  const lastDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
  const end = `${lastDay.getUTCFullYear()}${String(lastDay.getUTCMonth() + 1).padStart(2, '0')}${String(lastDay.getUTCDate()).padStart(2, '0')}00`;
  return { month: stampOf(month), yearBefore: stampOf(yearBefore), end };
}
const restPage = (lang, title, { yearBefore, end }) => `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${lang}.wikipedia/all-access/user/${encodeURIComponent(title.replace(/ /g, '_'))}/monthly/${yearBefore}/${end}`;
const restWiki = (lang, { yearBefore, end }) => `https://wikimedia.org/api/rest_v1/metrics/pageviews/aggregate/${lang}.wikipedia/all-access/user/monthly/${yearBefore}/${end}`;
const pick = (items, stamp) => items?.find((item) => item.timestamp === stamp)?.views ?? null;

/** A page's readers in the last full month and in the same month a year before; null when Wikimedia has no counts. */
export async function pageYear(fetchJson, lang, title, months) {
  const data = await fetchJson(restPage(lang, title, months));
  if (!data?.items) return null;
  return { lang, page: title, month: pick(data.items, months.month), yearBefore: pick(data.items, months.yearBefore) };
}

/** All of a Wikipedia's readers in the same two months: the yardstick a page's change is measured against. */
export async function wikiYear(fetchJson, lang, months) {
  const data = await fetchJson(restWiki(lang, months));
  if (!data?.items) return null;
  return { month: pick(data.items, months.month), yearBefore: pick(data.items, months.yearBefore), months };
}

const wikiApi = (lang, params) => `https://${lang}.wikipedia.org/w/api.php?${new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', maxlag: '5', ...params })}`;

/** Readers in 30 days of the pages with exactly these titles (after Wikipedia's own redirects). */
export async function wikiExact(fetchJson, lang, titles) {
  const out = {};
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    let params = { titles: batch.join('|'), redirects: '1', prop: 'pageviews', pvipdays: '31' };
    const pages = new Map();
    let data = null;
    for (let round = 0; round < 6; round++) {
      data = await fetchJson(wikiApi(lang, params));
      if (!data?.query) break;
      const q = data.query;
      for (const page of q.pages ?? []) {
        const known = pages.get(page.title) ?? { missing: Boolean(page.missing || page.invalid), days: null };
        // a continued answer can bring a page's days in parts
        if (page.pageviews && typeof page.pageviews === 'object') known.days = { ...known.days, ...page.pageviews };
        pages.set(page.title, known);
      }
      const follow = (title) => {
        let t = title;
        for (const n of q.normalized ?? []) if (n.from === t) t = n.to;
        for (const r of q.redirects ?? []) if (r.from === t) t = r.to;
        return t;
      };
      for (const title of batch) {
        const page = pages.get(follow(title));
        if (!page) continue;
        out[title] = page.missing ? { title: null, views: null } : { title: follow(title), views: lastThirtyDays(page.days) ?? 0 };
      }
      if (!data.continue) break;
      params = { ...params, ...data.continue };
    }
  }
  return out;
}

/** Wikipedia's own search for a topic: the pages it finds, in its order (`rank`), with readers in 30 days. */
export async function wikiRelated(fetchJson, lang, topic, limit = 6) {
  const data = await fetchJson(wikiApi(lang, { generator: 'search', gsrsearch: topic, gsrlimit: String(limit), gsrnamespace: '0', prop: 'pageviews', pvipdays: '31' }));
  if (!data) return null;
  return (data.query?.pages ?? [])
    .map((page) => ({ tag: titleToTag(page.title), page: page.title, views: lastThirtyDays(page.pageviews), rank: page.index ?? 99, source: 'wikipedia' }))
    .filter((item) => typeof item.views === 'number' && normalize(item.tag) !== topic);
}

/**
 * The page a phrase without its own page is rated by: Wikipedia's first search hit that shares a word
 * with it ("3d designs" -> "3D modeling", never an unrelated famous page). null when none does.
 */
export function closestPage(topic, hits) {
  const own = new Set(stems(topic));
  const best = [...(hits ?? [])].sort((a, b) => a.rank - b.rank).find((hit) => hit.views > 0 && stems(hit.page).some((stem) => own.has(stem)));
  return best ? { page: best.page, views: best.views } : null;
}

/** Datamuse: words that mean something like the topic. */
export async function datamuseRelated(fetchJson, topic, limit = 6) {
  const data = await fetchJson(`https://api.datamuse.com/words?${new URLSearchParams({ ml: topic, max: String(limit) })}`);
  if (!Array.isArray(data)) return null;
  // A phrase Datamuse does not know gets "backfill" words with low scores (event decor: mirror, bee, cold);
  // its real relations score in the millions.
  return data
    .filter((item) => typeof item.word === 'string' && item.score >= 1e6 && !item.tags?.some((tag) => tag.includes('backfill')))
    .map((item) => item.word)
    .filter((word) => normalize(word) !== topic);
}

/** Bing Webmaster Tools: searches for the exact words in one market over the last weeks, and the weeks before (the trend). */
export async function bingStats(fetchJson, key, word, { country = 'nl', language = 'nl-NL', weeks = 4 } = {}) {
  const url = `https://ssl.bing.com/webmaster/api.svc/json/GetKeywordStats?${new URLSearchParams({ q: word, country, language, apikey: key })}`;
  const data = await fetchJson(url);
  if (!data || !Array.isArray(data.d)) return null;
  const sum = (rows) => rows.reduce((total, row) => total + (Number(row.Impressions) || 0), 0);
  const recent = data.d.slice(-weeks);
  const before = data.d.slice(-2 * weeks, -weeks);
  return { impressions: sum(recent), weeks: recent.length, previous: before.length === weeks ? sum(before) : null, market: `${country}/${language}` };
}

const capitalise = (topic) => topic.charAt(0).toUpperCase() + topic.slice(1);

/**
 * Refreshes the ratings for these word lists. Topics that are missing or older than 30 days are
 * fetched, missing ones first, until the time budget runs out; the rest keep what they had.
 */
export async function refreshRatings(wordLists, previous, { fetchJson, now = Date.now(), bingKey = '', log = () => {}, maxTopics = Infinity } = {}) {
  const ratings = { ...emptyRatings(), ...previous, topics: { ...previous?.topics }, bing: { ...previous?.bing } };
  const { topics, words } = lookups(wordLists);
  const stale = topics.filter((t) => isStale(ratings.topics[t], now, MAX_AGE_DAYS, VERSION)).sort((a, b) => Number(Boolean(ratings.topics[a])) - Number(Boolean(ratings.topics[b])) || a.localeCompare(b)).slice(0, maxTopics);
  const stamp = new Date(now).toISOString();
  let updated = 0;
  // the yardstick for the trend: all of each Wikipedia, the same two months as the pages (once a week)
  const months = trendMonths(now);
  ratings.wikiYear = { ...previous?.wikiYear };
  for (const lang of ['en', 'nl']) {
    const known = ratings.wikiYear[lang];
    if (known?.months?.month === months.month && known?.months?.end === months.end && !isStale(known, now, 7)) continue;
    const year = await wikiYear(fetchJson, lang, months);
    if (year) ratings.wikiYear[lang] = { fetchedAt: stamp, ...year };
  }
  if (stale.length) {
    log(`Rating ${stale.length} of ${topics.length} topics`);
    const exact = {};
    for (const lang of ['en', 'nl']) exact[lang] = await wikiExact(fetchJson, lang, stale.map(capitalise));
    const pending = [];
    for (const topic of stale) {
      const en = exact.en[capitalise(topic)];
      const nl = exact.nl[capitalise(topic)];
      if (!en && !nl) continue; // Wikipedia did not answer: keep the old entry, or "no data"
      const wikiRelatedItems = await wikiRelated(fetchJson, 'en', topic);
      const similar = await datamuseRelated(fetchJson, topic);
      if (wikiRelatedItems === null && similar === null) continue;
      pending.push({ topic, en, nl, related: wikiRelatedItems ?? [], similar: similar ?? [] });
    }
    // Rate Datamuse's words by their own Wikipedia pages, so every related word has a number
    const similarTitles = [...new Set(pending.flatMap((p) => p.similar.map(capitalise)))];
    const similarViews = similarTitles.length ? await wikiExact(fetchJson, 'en', similarTitles) : {};
    for (const { topic, en, nl, related, similar } of pending) {
      const fromDatamuse = similar.map((word) => ({ tag: word, page: similarViews[capitalise(word)]?.title, views: similarViews[capitalise(word)]?.views, source: 'datamuse' })).filter((item) => typeof item.views === 'number' && item.views > 0);
      // one entry per Wikipedia page (sculpting and sculptor both lead to Sculpture), never the topic's own page
      const own = new Set([en?.title, nl?.title].filter(Boolean));
      const all = new Map();
      for (const item of [...related, ...fromDatamuse]) {
        const key = item.page ?? normalize(item.tag);
        if (normalize(item.tag) === topic || own.has(item.page)) continue;
        if (!all.has(key) || (all.get(key).source === 'datamuse' && item.source !== 'datamuse')) all.set(key, item);
      }
      const hasPage = Boolean(en?.title || nl?.title);
      const closest = hasPage ? null : closestPage(topic, related);
      // the trend of the page the word is rated by: its own (English first), else its closest page
      const trendPage = en?.title ? ['en', en.title] : nl?.title ? ['nl', nl.title] : closest ? ['en', closest.page] : null;
      const year = trendPage ? await pageYear(fetchJson, trendPage[0], trendPage[1], months) : null;
      ratings.topics[topic] = {
        v: VERSION,
        fetchedAt: stamp,
        wiki: { en: en?.title ? en : null, nl: nl?.title ? nl : null },
        ...(hasPage ? {} : { closest }),
        ...(year ? { year } : {}),
        related: [...all.values()].sort((a, b) => b.views - a.views || a.tag.localeCompare(b.tag)).slice(0, 12).map(({ rank, ...item }) => item),
      };
      updated++;
    }
  }
  if (bingKey) {
    const staleWords = words.filter((w) => isStale(ratings.bing[w], now, 7));
    for (const word of staleWords) {
      const stats = await bingStats(fetchJson, bingKey, word);
      if (stats) ratings.bing[word] = { fetchedAt: stamp, ...stats };
    }
  }
  ratings.sources = {
    wikipedia: 'Readers of the topic\'s Wikipedia page in 30 days, English + Dutch; a phrase without a page: its closest page (Wikimedia API, CC0 data)',
    trend: 'The page\'s readers in the last full month against the same month a year before, measured against all of that Wikipedia (Wikimedia pageview REST API)',
    datamuse: 'Related words, means-like (Datamuse API, https://www.datamuse.com/api/)',
    ...(bingKey || Object.keys(ratings.bing).length ? { bing: 'Searches in the Netherlands for the exact words, last 4 weeks and the 4 before (Bing Webmaster Tools GetKeywordStats)' } : {}),
  };
  if (updated || stale.length === 0) ratings.updatedAt = updated ? stamp : ratings.updatedAt;
  return { ratings, updated, stale: stale.length, topics: topics.length };
}

/** Stable output: keys sorted, so a refresh shows as a small diff. */
export function serialise(ratings) {
  const sorted = (obj) => Object.fromEntries(Object.keys(obj).sort().map((k) => [k, obj[k]]));
  return `${JSON.stringify({ ...ratings, topics: sorted(ratings.topics), bing: sorted(ratings.bing) }, null, 1)}\n`;
}

async function main() {
  if (/^(off|0|false|no)$/i.test(process.env.KEYWORD_RATINGS ?? '')) {
    console.log('Keyword ratings: off, using src/data/keyword-ratings.json as it is');
    if (!existsSync(OUT)) writeFileSync(OUT, serialise(emptyRatings()));
    return;
  }
  const previous = readRatings();
  try {
    const { deskProjects, ratingCandidates } = await import('../src/lib/desk-keywords.js');
    const lists = deskProjects().map(ratingCandidates);
    const budget = Number(process.env.KEYWORD_RATINGS_BUDGET) || 120;
    const fetchJson = politeFetcher({ deadline: Date.now() + budget * 1000, log: console.log });
    const { ratings, updated, stale, topics } = await refreshRatings(lists, previous, { fetchJson, bingKey: process.env.BING_WEBMASTER_API_KEY ?? '', log: console.log });
    const text = serialise(ratings);
    // a Windows checkout has the file with CRLF; that alone is no reason to write it
    if (!existsSync(OUT) || text !== readFileSync(OUT, 'utf-8').replace(/\r\n/g, '\n')) writeFileSync(OUT, text);
    console.log(`Keyword ratings: ${topics} topics, ${stale} to refresh, ${updated} refreshed${stale > updated ? ` (${stale - updated} left for the next build: time budget or a source down)` : ''}`);
  } catch (error) {
    // never the reason a build fails: the page shows "no data" for what is missing
    console.warn(`Keyword ratings skipped: ${error.message}`);
    if (!existsSync(OUT)) writeFileSync(OUT, serialise(previous));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
