// npm test  (node --test "scripts/**/*.test.mjs")
// The image desk's third column: the rating JSON builder (scripts/keyword-ratings.mjs) and how the page
// reads it (src/lib/keyword-ratings.js). No network: every source is a fake that answers like the real one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { refreshRatings, lookups, isStale, titleToTag, serialise, emptyRatings, politeFetcher, bingStats } from './keyword-ratings.mjs';
import { coreOf, rateable, levelOf, ratedFor, rate, relevant } from '../src/lib/keyword-ratings.js';

const NOW = Date.parse('2026-10-25T12:00:00Z');
const days = (n) => n * 24 * 60 * 60 * 1000;

// Answers like Wikipedia's action API and Datamuse, from a small table
function fakeSources({ down = [] } = {}) {
  const pages = { 'Industrial design': 4500, 'Product design': 1800, 'Industrial engineering': 6200, 'Computer-aided design': 19900, Sculpture: 10500, Statue: 4300, 'Jeffrey Dahmer': 590000 };
  const nlPages = { 'Industrial design': ['Industriële vormgeving', 200] };
  const calls = [];
  const fetchJson = async (url) => {
    const u = new URL(url);
    calls.push(u.host);
    if (down.some((host) => u.host.includes(host))) return null;
    if (u.host === 'api.datamuse.com') {
      const ml = u.searchParams.get('ml');
      if (ml === 'sculpture') return [{ word: 'statue', score: 20041332, tags: ['n'] }, { word: 'sculpting', score: 20041288, tags: ['n'] }];
      return [{ word: 'mirror', score: 15354, tags: ['results_type:backfill_gloss', 'n'] }];
    }
    const lang = u.host.split('.')[0];
    const p = Object.fromEntries(u.searchParams);
    const views = (n) => ({ '2026-10-01': n - 100, '2026-10-02': 100, '2026-10-03': null });
    if (p.generator === 'search') {
      const hits = p.gsrsearch === 'industrial design' ? ['Industrial engineering', 'Jeffrey Dahmer', 'Computer-aided design', 'Industrial design'] : [];
      return { query: { pages: hits.map((title) => ({ title, pageviews: views(pages[title]) })) } };
    }
    const titles = p.titles.split('|');
    const normalized = [];
    const redirects = [];
    const out = [];
    for (const title of titles) {
      if (lang === 'nl') {
        const hit = nlPages[title];
        if (hit) { redirects.push({ from: title, to: hit[0] }); out.push({ title: hit[0], pageviews: views(hit[1]) }); } else out.push({ title, missing: true });
        continue;
      }
      if (title === 'Sculpting') { redirects.push({ from: title, to: 'Sculpture' }); continue; }
      out.push(pages[title] ? { title, pageviews: views(pages[title]) } : { title, missing: true });
    }
    if (titles.includes('Sculpting')) out.push({ title: 'Sculpture', pageviews: views(pages.Sculpture) });
    return { query: { normalized, redirects, pages: out } };
  };
  return { fetchJson, calls };
}

test('place words are left out of the topic and mark the word as local', () => {
  assert.deepEqual(coreOf('Product design Amsterdam'), { core: 'product design', local: true });
  assert.deepEqual(coreOf('sculpture'), { core: 'sculpture', local: false });
  assert.deepEqual(coreOf('Amsterdam'), { core: 'amsterdam', local: false });
});

test('camera file numbers and long phrases are not looked up', () => {
  assert.equal(rateable('33156289 948063188701484'), false);
  assert.equal(rateable('ab'), false);
  assert.equal(rateable('festival stage design'), true);
  assert.deepEqual(lookups([['Product design', 'product design Amsterdam', 'IMG 20190412']]), { topics: ['product design'], words: ['product design', 'product design amsterdam'] });
});

test('the dots have a stated meaning: readers in 30 days, 100+, 1,000+, 10,000+', () => {
  assert.equal(levelOf(null), null);
  assert.equal(levelOf(99), 0);
  assert.equal(levelOf(100), 1);
  assert.equal(levelOf(1000), 2);
  assert.equal(levelOf(10000), 3);
});

test('the builder rates every topic from Wikipedia (en + nl) and keeps related words, one per page', async () => {
  const { fetchJson } = fakeSources();
  const { ratings, updated } = await refreshRatings([['industrial design', 'Sculpture', 'event decor Amsterdam']], emptyRatings(), { fetchJson, now: NOW });
  assert.equal(updated, 3);
  const industrial = ratings.topics['industrial design'];
  assert.deepEqual(industrial.wiki.en, { title: 'Industrial design', views: 4500 });
  assert.deepEqual(industrial.wiki.nl, { title: 'Industriële vormgeving', views: 200 });
  // its own page is not "related"; the search's famous unrelated page is kept here and filtered when read
  assert.deepEqual(industrial.related.map((r) => r.tag), ['Jeffrey Dahmer', 'computer-aided design', 'industrial engineering']);
  // Datamuse's sculpting leads to Sculpture itself, so only statue stays
  assert.deepEqual(ratings.topics.sculpture.related.map((r) => [r.tag, r.source]), [['statue', 'datamuse']]);
  // a phrase without a page: fetched, no page, and Datamuse's backfill words are dropped
  assert.deepEqual(ratings.topics['event decor'], { fetchedAt: new Date(NOW).toISOString(), wiki: { en: null, nl: null }, related: [] });
});

test('a source that is down leaves the words without data, and the build goes on', async () => {
  const { fetchJson } = fakeSources({ down: ['wikipedia.org'] });
  const { ratings, updated } = await refreshRatings([['industrial design']], emptyRatings(), { fetchJson, now: NOW });
  assert.equal(updated, 0);
  assert.deepEqual(ratings.topics, {});
  const column = ratedFor(['industrial design'], ratings);
  assert.equal(column.hasData, false);
  assert.equal(column.rated[0].badge, 'no data');
});

test('fresh entries are not fetched again; old ones are, and an old entry survives a failed refresh', async () => {
  const old = { ...emptyRatings(), topics: { sculpture: { fetchedAt: new Date(NOW - days(40)).toISOString(), wiki: { en: { title: 'Sculpture', views: 1 }, nl: null }, related: [] } } };
  assert.equal(isStale(old.topics.sculpture, NOW), true);
  assert.equal(isStale({ fetchedAt: new Date(NOW - days(3)).toISOString() }, NOW), false);
  const down = fakeSources({ down: ['wikipedia.org'] });
  const kept = await refreshRatings([['sculpture']], old, { fetchJson: down.fetchJson, now: NOW });
  assert.equal(kept.ratings.topics.sculpture.wiki.en.views, 1);
  const up = fakeSources();
  const fresh = await refreshRatings([['sculpture']], old, { fetchJson: up.fetchJson, now: NOW });
  assert.equal(fresh.ratings.topics.sculpture.wiki.en.views, 10500);
  const again = await refreshRatings([['sculpture']], fresh.ratings, { fetchJson: up.fetchJson, now: NOW + days(1) });
  assert.equal(again.stale, 0);
});

test('the page column: phrases first, most read first; local words rated by their topic; related words only when better', async () => {
  const { fetchJson } = fakeSources();
  const { ratings } = await refreshRatings([['industrial design', 'Sculpture', 'event decor Amsterdam']], emptyRatings(), { fetchJson, now: NOW });
  const column = ratedFor(['event decor Amsterdam', 'industrial design', 'Sculpture', 'IMG 20190412'], ratings);
  assert.deepEqual(column.rated.map((r) => [r.tag, r.badge]), [['industrial design', '●●○ 4.7k'], ['event decor Amsterdam', '○○○'], ['Sculpture', '●●● 11k']]);
  assert.match(column.rated[1].title, /no Wikipedia page/);
  assert.equal(column.rated[1].local, true);
  // Jeffrey Dahmer is a name, and industrial engineering is another trade: neither shows
  assert.deepEqual(column.related.map((r) => [r.tag, r.from]), [['computer-aided design', 'industrial design']]);
  assert.equal(column.hasData, true);
});

test('related words: no names, lists or broader pieces of the topic; they share a word with it', () => {
  assert.equal(relevant('industrial design', { tag: 'Clean-room design', source: 'wikipedia' }), false);
  assert.equal(relevant('industrial design', { tag: 'design', source: 'wikipedia' }), false);
  assert.equal(relevant('set building', { tag: 'list of tallest buildings', source: 'wikipedia' }), false);
  assert.equal(relevant('industrial design', { tag: 'interior design', source: 'wikipedia' }), true);
  assert.equal(relevant('industrial design', { tag: 'industrial engineering', source: 'wikipedia' }), false);
  assert.equal(relevant('event decor', { tag: 'interior design', source: 'wikipedia' }), false);
  // Datamuse too has to share a word: fabrication is not fiction
  assert.equal(relevant('custom fabrication', { tag: 'fiction', source: 'datamuse' }), false);
  // another form of the same word is not a new word
  assert.equal(relevant('sculpture', { tag: 'sculptor', source: 'datamuse' }), false);
  assert.equal(relevant('custom fabrication', { tag: 'art fabrication', source: 'datamuse' }), true);
  // a longer phrase only with words the desk already uses
  assert.equal(relevant('custom fabrication', { tag: 'semiconductor device fabrication', source: 'wikipedia' }), false);
  assert.equal(relevant('custom fabrication', { tag: 'metal stage fabrication', source: 'wikipedia' }, new Set(['metal', 'stage'])), true);
  // the topic's last word is the thing itself
  assert.equal(relevant('custom signage', { tag: 'digital signage', source: 'wikipedia' }), true);
  assert.equal(relevant('custom signage', { tag: 'custom car', source: 'wikipedia' }), false);
  assert.equal(relevant('experiential design studio', { tag: 'interior design', source: 'wikipedia' }, new Set(['inter'])), true);
  assert.equal(relevant('product solutions', { tag: 'solution', source: 'datamuse' }), false);
});

test('Bing counts, when a key was there, come first and say what they are', () => {
  const ratings = { ...emptyRatings(), topics: { sculpture: { fetchedAt: 'x', wiki: { en: { title: 'Sculpture', views: 50 }, nl: null }, related: [] }, 'product design': { fetchedAt: 'x', wiki: { en: { title: 'Product design', views: 2000 }, nl: null }, related: [] } }, bing: { sculpture: { impressions: 320, weeks: 4 } } };
  const column = ratedFor(['product design', 'sculpture'], ratings);
  assert.equal(column.rated[0].tag, 'sculpture');
  assert.equal(column.rated[0].bing, 320);
  assert.match(rate('sculpture', ratings).title, /Bing, Netherlands: 320 searches in 4 weeks/);
});

test('Bing Webmaster Tools: the last four weeks of GetKeywordStats are added up', async () => {
  let asked = '';
  const fetchJson = async (url) => { asked = url; return { d: [1, 2, 3, 4, 5].map((n) => ({ Impressions: n * 10, BroadImpressions: n * 20, Query: 'sculpture' })) }; };
  assert.deepEqual(await bingStats(fetchJson, 'KEY', 'sculpture'), { impressions: 140, weeks: 4, market: 'nl/nl-NL' });
  assert.match(asked, /^https:\/\/ssl\.bing\.com\/webmaster\/api\.svc\/json\/GetKeywordStats\?q=sculpture&country=nl&language=nl-NL&apikey=KEY$/);
});

test('the fetcher waits between requests, gives up after the time budget, and never throws', async () => {
  let n = 0;
  const fetchImpl = async () => { n++; throw new Error('offline'); };
  const fetchJson = politeFetcher({ fetchImpl, gapMs: 1 });
  assert.equal(await fetchJson('https://api.datamuse.com/words?ml=x'), null);
  assert.equal(n, 2); // one retry
  const late = politeFetcher({ fetchImpl, gapMs: 1, deadline: Date.now() - 1 });
  assert.equal(await late('https://api.datamuse.com/words?ml=x'), null);
  assert.equal(n, 2);
});

test('Wikipedia titles become keywords: no disambiguation part, lower case unless a name', () => {
  assert.equal(titleToTag('Stage (theatre)'), 'stage');
  assert.equal(titleToTag('Industrial engineering'), 'industrial engineering');
  assert.equal(titleToTag('Computer-aided design'), 'computer-aided design');
  assert.equal(titleToTag('Glastonbury Festival'), 'Glastonbury Festival');
});

test('the file is written with sorted keys, so a refresh is a small diff', () => {
  const text = serialise({ ...emptyRatings(), topics: { b: {}, a: {} } });
  assert.ok(text.indexOf('"a"') < text.indexOf('"b"'));
  assert.ok(text.endsWith('\n'));
});
