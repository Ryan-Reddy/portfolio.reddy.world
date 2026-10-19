// What an app says about itself: /app.json on its own site, published by the app's CI after every
// release (repo.template.reddy.world). Read at build time, so nothing that changes per release
// (version, last update, description, store links) is typed here, and none of it drifts
// (Ryan, 2026-10-19: the apps push their own details). A missing file or field is left out with a
// warning; an old or hand-typed value is never shown.

const cache = new Map();
const isUrl = (u) => { try { return ['https:', 'http:'].includes(new URL(u).protocol); } catch { return false; } };

/** The app's /app.json, checked: { name, version, line, description, updated, store: [{name, url}] } */
export function readAppJson(live) {
  if (!live) return Promise.resolve({});
  const url = new URL('/app.json', live).href;
  if (!cache.has(url)) {
    cache.set(url, (async () => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
        // a single-page app answers 200 text/html for a file it doesn't have
        if (!res.ok || !/json/.test(res.headers.get('content-type') ?? '')) throw new Error(`${res.status} ${res.headers.get('content-type')}`);
        const j = await res.json();
        const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
        const out = {
          name: str(j.name),
          version: str(j.version),
          line: str(j.line),
          description: str(j.description),
          updated: /^\d{4}-\d{2}-\d{2}/.test(str(j.updated) ?? '') ? j.updated.slice(0, 10) : undefined,
          store: Array.isArray(j.store) ? j.store.filter((s) => str(s?.name) && isUrl(s?.url)).map((s) => ({ name: s.name.trim(), url: s.url })) : undefined,
        };
        const missing = ['version', 'updated'].filter((k) => !out[k]);
        if (missing.length) console.warn(`app.json: ${url} has no ${missing.join(' or ')}; left out`);
        return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined));
      } catch (e) {
        console.warn(`app.json: none at ${url} (${e.message}); version and release date left out`);
        return {};
      }
    })());
  }
  return cache.get(url);
}

/**
 * An app's listings (the app's own list, else the ones Ryan gave in the .md), its main button
 * (the first listing, else its own site) and its release ({ version, updated } or null)
 */
export async function appFacts(data) {
  const app = await readAppJson(data.live);
  const stores = app.store?.length ? app.store : data.store;
  const main = stores[0];
  const button = main
    ? { label: data.cta ?? `Get it in the ${main.name}`, url: main.url }
    : data.live ? { label: data.cta ?? `Open ${data.title}`, url: data.live } : null;
  const release = app.version ? { version: app.version, updated: app.updated ?? null } : null;
  return { stores, button, release, description: app.description ?? null };
}
