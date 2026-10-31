// The image desk's third column: the desk's own words, each with a rating, plus related words that rate higher.
// The numbers are fetched at build time by scripts/keyword-ratings.mjs into src/data/keyword-ratings.json;
// this file only reads them, so the page carries no keys and makes no calls.
//
// The rating, in plain words: how many people read the Wikipedia page of the word's topic in the last
// 30 days (English plus Dutch Wikipedia). It shows interest in a topic, not searches for the exact words.
// "Amsterdam" and other place words are left out of the topic and marked as local instead.
// When a Bing Webmaster key was present at build time, Bing's own count of searches in the Netherlands
// for the exact words is added.

const PLACE = ['amsterdam', 'netherlands', 'nederland', 'holland', 'dutch', 'nl'];
const PLACE_WORD = new RegExp(`\\b(${PLACE.join('|')})\\b`, 'giu');

export const normalize = (word) => String(word ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

/** The topic a word is rated by, without its place words, and whether it had one. */
export function coreOf(word) {
  const clean = normalize(word);
  const core = clean.replace(PLACE_WORD, ' ').replace(/\s+/g, ' ').trim();
  // a place on its own ("Amsterdam") is its own topic
  return core ? { core, local: core !== clean } : { core: clean, local: false };
}

/** Only words worth a lookup: no camera file numbers, at least three letters, at most five words. */
export function rateable(word) {
  const clean = normalize(word);
  return clean.length >= 3 && !/\d{4,}/.test(clean) && /\p{L}{3}/u.test(clean) && clean.split(' ').length <= 5;
}

/** 0 to 3 dots: under 100, 100+, 1,000+, 10,000+ readers in 30 days. null when there is no data. */
export function levelOf(views) {
  if (views === null || views === undefined) return null;
  return views >= 10000 ? 3 : views >= 1000 ? 2 : views >= 100 ? 1 : 0;
}

export function compact(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '')}k`;
  return String(n);
}

const viewsOf = (topic) => {
  if (!topic?.wiki) return null;
  const counts = ['en', 'nl'].map((lang) => topic.wiki[lang]?.views).filter((v) => typeof v === 'number');
  return counts.length ? counts.reduce((a, b) => a + b, 0) : 0;
};
/**
 * The trend of the page a word is rated by: its readers in the last full month against the same month a
 * year before, measured against all of that Wikipedia over the same months, which shrinks year on year.
 * So a season (festivals every summer) or Wikipedia's own decline is not taken for a rising word.
 * Returns the change as a fraction (0.4: 40% better than Wikipedia as a whole), or null with too little
 * to go on (under 300 readers that month, or no count a year before).
 */
export function trendOf(year, wikiYear) {
  if (!year || typeof year.month !== 'number' || !(year.yearBefore > 0) || year.month < 300) return null;
  const wiki = wikiYear?.month > 0 && wikiYear?.yearBefore > 0 ? wikiYear.month / wikiYear.yearBefore : 1;
  return year.month / year.yearBefore / wiki - 1;
}
/** Bing's own trend for the exact words: the last 4 weeks against the 4 before, from 20 searches up. */
export function bingTrendOf(bing) {
  return typeof bing?.impressions === 'number' && bing.previous >= 20 ? (bing.impressions - bing.previous) / bing.previous : null;
}
export const RISING = 0.25;
const trendBadge = (trend) => (trend !== null && trend >= RISING ? ` ↑${Math.round(trend * 100)}%` : '');

/** One word's rating, from the build's data. */
export function rate(word, ratings) {
  const { core, local } = coreOf(word);
  const topic = ratings?.topics?.[core];
  const bing = ratings?.bing?.[normalize(word)];
  const pages = topic?.wiki ? ['en', 'nl'].map((lang) => topic.wiki[lang]?.title && `${lang}: ${topic.wiki[lang].title}`).filter(Boolean) : [];
  // a phrase without a page of its own is rated by its closest page (≈)
  const closest = !pages.length ? topic?.closest ?? null : null;
  const views = closest ? closest.views : topic ? viewsOf(topic) : null;
  // Bing counts searches for the exact words, so its trend goes first; else the page's year on year
  const searchTrend = bingTrendOf(bing);
  const pageTrend = trendOf(topic?.year, ratings?.wikiYear?.[topic?.year?.lang]);
  const trend = searchTrend ?? pageTrend;
  const level = levelOf(views);
  const parts = [];
  if (!topic) parts.push('no data yet');
  else if (closest) parts.push(`no page of its own; its closest page “${closest.page}” had ${closest.views.toLocaleString('en')} readers in 30 days`);
  else if (!pages.length) parts.push('no Wikipedia page for this topic, nor a close one');
  else parts.push(`${views.toLocaleString('en')} readers in 30 days (${pages.join(', ')})`);
  if (pageTrend !== null) parts.push(`${pageTrend >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(pageTrend * 100))}% on a year before, against Wikipedia as a whole`);
  if (local) parts.push(`rated by its topic “${core}”; the place makes it local`);
  if (typeof bing?.impressions === 'number') parts.push(`Bing, Netherlands: ${bing.impressions.toLocaleString('en')} searches in ${bing.weeks} weeks${searchTrend !== null ? `, ${searchTrend >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(searchTrend * 100))}% on the 4 weeks before` : ''}`);
  return {
    tag: word,
    topic: closest?.page ?? pages.join(', '),
    fetchedAt: topic?.fetchedAt ?? null,
    views,
    level,
    local,
    trend,
    approx: Boolean(closest),
    badge: level === null ? 'no data' : `${closest ? '≈ ' : ''}${'●'.repeat(level)}${'○'.repeat(3 - level)}${views ? ` ${compact(views)}` : ''}${trendBadge(trend)}`,
    bing: typeof bing?.impressions === 'number' ? bing.impressions : null,
    title: parts.join(' · '),
  };
}

const SMALL_WORDS = new Set(['the', 'and', 'for', 'with', 'van', 'het', 'een', 'voor', 'met']);
/** The first five letters of each word, so forms of one word match (sculpture, sculptor). */
export const stems = (text) => normalize(text).split(/[^\p{L}]+/u).filter((w) => w.length >= 3 && !SMALL_WORDS.has(w)).map((w) => w.slice(0, 5));

/**
 * Whether a related word is worth showing next to a topic. Both sources also find things that only
 * look alike (Wikipedia's search: famous unrelated pages; Datamuse: "fiction" for "fabrication"), so:
 * - no names, lists or years;
 * - not a broader piece of the topic ("design" for "industrial design", "solution" for "product solutions");
 * - a two-word phrase with the topic's last word, the thing itself ("digital signage" for "custom
 *   signage"), or one that shares a word and all its other words are words the desk already uses (`vocabulary`):
 *   "interior design" for "experiential design studio", never "custom car" for "custom signage".
 */
export function relevant(topic, item, vocabulary = new Set()) {
  const tag = String(item?.tag ?? '');
  if (!tag || /[A-Z]/.test(tag) || /\d/.test(tag) || /^list of /i.test(tag)) return false;
  const topicStems = stems(topic);
  const own = stems(tag);
  if (!own.length) return false;
  if (own.length === 1 && normalize(tag).split(/[\s-]+/).length === 1 && topicStems.includes(own[0])) return false;
  // a short phrase with the topic's last word; longer ones ("semiconductor device fabrication") need the vocabulary
  if (normalize(tag).split(' ').length <= 2 && own.includes(topicStems.at(-1))) return true;
  return own.some((stem) => topicStems.includes(stem)) && own.every((stem) => topicStems.includes(stem) || vocabulary.has(stem));
}

/**
 * The third column for one project: its words rated and sorted (most read first, no data last),
 * and related words that more people read about than the word they came from.
 */
export function ratedFor(words, ratings, { limit = Infinity, relatedLimit = 6, vocabulary = new Set(), relatedFrom = null } = {}) {
  // related words only for these (the customer-search ideas); a pair of words lifted from a caption
  // ("chair no") finds nonsense ("electric chair")
  const from = relatedFrom ? new Set(relatedFrom.map(normalize)) : null;
  const seen = new Set();
  const rated = words.filter(rateable).filter((word) => !seen.has(normalize(word)) && seen.add(normalize(word))).map((word) => rate(word, ratings));
  // Bing's real search counts first when there are any; then phrases (what clients type) before
  // single words; within each, most readers first
  const single = (item) => Number(!normalize(item.tag).includes(' '));
  const order = (a, b) => (b.bing ?? -1) - (a.bing ?? -1) || single(a) - single(b) || (b.views ?? -1) - (a.views ?? -1) || a.tag.localeCompare(b.tag);
  rated.sort(order);
  const related = new Map();
  for (const item of rated) {
    const { core } = coreOf(item.tag);
    // a single word's neighbours are too loose to be advice (light: speed of light; beach: nude beach)
    if (!core.includes(' ') || /\d/.test(core) || (from && !from.has(normalize(item.tag)))) continue;
    const topic = ratings?.topics?.[core];
    for (const other of topic?.related ?? []) {
      const key = normalize(other.tag);
      if (seen.has(key) || !rateable(other.tag) || !relevant(core, other, vocabulary) || typeof other.views !== 'number' || other.views <= (item.views ?? 0)) continue;
      if (!related.has(key) || related.get(key).views < other.views) {
        const level = levelOf(other.views);
        // a related word's own trend is not fetched: its rating is its 30 days only
        related.set(key, {
          tag: other.tag,
          views: other.views,
          level,
          trend: null,
          approx: false,
          bing: null,
          badge: `${'●'.repeat(level)}${'○'.repeat(3 - level)} ${compact(other.views)}`,
          from: item.tag,
          title: `Related to “${item.tag}” (${other.source === 'datamuse' ? 'Datamuse' : 'Wikipedia search'}) · ${other.views.toLocaleString('en')} readers of its Wikipedia page in 30 days`,
        });
      }
    }
  }
  return {
    rated: rated.slice(0, limit),
    related: [...related.values()].sort((a, b) => b.views - a.views || a.tag.localeCompare(b.tag)).slice(0, relatedLimit),
    hasData: rated.some((item) => item.level !== null),
  };
}

/**
 * Every word idea for one project in one list, each rated (Ryan, 2026-10-26: "why seperated? bring them
 * together, and please can we get them all rated?"): his own words from the captions, what clients
 * search, related words that more people read about, and the word bank. One entry per word, with the
 * places it came from (`sources`), sorted like the rated column: Bing's searches, then most read; no data last.
 * @param {{source: string, words: string[]}[]} lists
 */
export function ideasFor(lists, ratings, { vocabulary = new Set(), relatedFrom = null, relatedLimit = 12 } = {}) {
  const ideas = new Map();
  const add = (word, source, rating) => {
    const key = normalize(word);
    if (!key) return;
    const entry = ideas.get(key) ?? { ...(rating ?? (rateable(word) ? rate(word, ratings) : { tag: word, views: null, level: null, trend: null, approx: false, bing: null, badge: '', title: 'too short or too long to rate' })), sources: [] };
    if (!entry.sources.includes(source)) entry.sources.push(source);
    ideas.set(key, entry);
  };
  for (const { source, words } of lists) for (const word of words) add(word, source);
  const { related } = ratedFor(lists.flatMap((list) => list.words), ratings, { relatedLimit, vocabulary, relatedFrom });
  for (const item of related) add(item.tag, 'related', item);
  const known = (item) => (item.level === null ? 0 : 1);
  return [...ideas.values()].sort((a, b) => (b.bing ?? -1) - (a.bing ?? -1) || known(b) - known(a) || (b.views ?? -1) - (a.views ?? -1) || a.tag.localeCompare(b.tag));
}
