// The image desk's saved work: what changed, how two copies merge, and where Ryan is.
//
// The desk keeps one state object (see src/pages/image-metadata.astro):
//   { projects: {id: {tags, reviewed, hero, credit?, summary?, content?}}, images: {key: {description, tags, reviewed, credit?}},
//     articles: {id: {title, summary, content, status: 'draft', created} | {deleted: true}}, cursor, article, session }
// and this file adds, without changing those fields:
//   - `at` on a project or picture: when Ryan last changed it (ms), so two copies merge entry by entry
//     and the newer change wins;
//   - `doneAt` on a project: when Ryan marked it done on the desk, for "done today" (not for a loaded export);
//   - `days`: {"YYYY-MM-DD": true} for every day Ryan changed something;
//   - `savedAt`: the last change of the whole copy, which decides whose place (cursor) is kept.
// A copy from before these stamps has no `at`; such an entry merges field by field with the other copy's,
// stamped or not, keeping whatever either side has, so nothing typed before this change is lost either.
//
// Pure functions only: the page, the cloud sync and the tests all use them.

const STAMPS = new Set(['at', 'doneAt']);
// the kinds of entry Ryan works on; each merges entry by entry
const KINDS = ['projects', 'images', 'articles'];

/** The fields Ryan typed, in a stable order, without the stamps: equal strings mean nothing changed. */
export function contentOf(entry) {
  if (!entry || typeof entry !== 'object') return '';
  const keys = Object.keys(entry).filter((key) => !STAMPS.has(key)).sort();
  return JSON.stringify(keys.map((key) => [key, entry[key]]));
}

const blank = (value) => value === undefined || value === null || value === '' || value === false
  || (typeof value === 'object' && !Object.values(value).some((inner) => String(inner ?? '').trim()));

/**
 * True for a record the desk writes by merely showing a project or picture: no words, nothing ticked,
 * no lead picture or credit, and the picture's description is still the one the post already had.
 * Such a record is never stamped, so it cannot win over real work saved elsewhere.
 */
export function isPristine(entry, existingDescription = '') {
  if (!entry || typeof entry !== 'object') return true;
  return Object.entries(entry).every(([key, value]) => STAMPS.has(key)
    || (key === 'description' ? !String(value ?? '').trim() || String(value).trim() === String(existingDescription ?? '').trim() : blank(value)));
}

/** What `stamp` compares against: the content of every entry as last seen. */
export function snapshotOf(state) {
  const snap = {projects: {}, images: {}, articles: {}};
  for (const kind of KINDS) {
    for (const [key, entry] of Object.entries(state?.[kind] ?? {})) snap[kind][key] = contentOf(entry);
  }
  return snap;
}

export const dayOf = (ms) => {
  const date = new Date(ms);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

/**
 * Stamps every entry that changed since `snap` with `at: now` (and `doneAt` when a project became done),
 * marks today as worked, and moves `snap` along. Mutates `state` and `snap`; returns true when anything changed.
 * `existing` maps a picture key to the description its post already had (see isPristine).
 */
export function stamp(state, snap, now, existing = {}) {
  let changed = false;
  const finished = [];
  for (const kind of KINDS) {
    snap[kind] ??= {};
    for (const [key, entry] of Object.entries(state[kind] ?? {})) {
      if (!entry || typeof entry !== 'object') continue;
      const content = contentOf(entry);
      const before = snap[kind][key];
      if (before === content) continue;
      snap[kind][key] = content;
      const prev = before ? Object.fromEntries(JSON.parse(before)) : undefined;
      const had = kind === 'images' ? existing[key] : '';
      // shown, not worked on: no stamp (clearing real work does get one, since `prev` was not pristine)
      if (isPristine(entry, had) && isPristine(prev, had)) continue;
      entry.at = now;
      if (kind === 'projects' && entry.reviewed && !prev?.reviewed) finished.push(entry);
      changed = true;
    }
  }
  // Ryan finishes one project at a time; many at once is a loaded export, done on some earlier day
  if (finished.length === 1) finished[0].doneAt = now;
  if (changed) {
    state.days = {...state.days, [dayOf(now)]: true};
    state.savedAt = now;
  }
  return changed;
}

const tagList = (value) => String(value ?? '').split(',').map((tag) => tag.trim()).filter(Boolean);
const tagSet = (value) => new Set(tagList(value).map((tag) => tag.toLowerCase()));
const covers = (big, small) => [...tagSet(small)].every((tag) => tagSet(big).has(tag));
/** Every tag of both, once. When one side already has them all, that side as it is, so two devices settle. */
const unionTags = (a, b) => {
  if (covers(b, a)) return b;
  if (covers(a, b)) return a;
  const seen = new Map();
  for (const tag of [...tagList(a), ...tagList(b)]) if (!seen.has(tag.toLowerCase())) seen.set(tag.toLowerCase(), tag);
  return [...seen.values()].join(', ');
};

/**
 * One project or picture from two copies.
 * - Both stamped, at different times: the newer change wins whole (a deliberate clear stays cleared).
 * - Otherwise (either side has no stamp, or both the same one), field by field, so nothing typed is lost:
 *   a blank field takes the other side's value, tags are joined, done stays done, numbers take the larger
 *   (so the result carries the stamped side's `at` and is an ordinary stamped entry from then on), and the
 *   longer description is kept, unless one side only holds the post's own caption (`existingDescription`).
 *   Any other clash (a lead picture, a credit) goes to the stamped side, which is known to be the later
 *   change: stamps only exist from this version on, so unstamped work in a browser was typed before it.
 * `b` is the account copy in mergeStates; ties go to it, so two devices settle on one value.
 */
export function mergeEntry(a, b, existingDescription) {
  if (!a) return b;
  if (!b) return a;
  const ta = Number(a.at) || 0;
  const tb = Number(b.at) || 0;
  if (ta && tb && ta !== tb) return ta > tb ? a : b;
  const aFirst = ta > tb;
  const caption = String(existingDescription ?? '').trim();
  const out = {};
  for (const key of new Set([...Object.keys(b), ...Object.keys(a)])) {
    const va = a[key];
    const vb = b[key];
    if (blank(va)) out[key] = vb;
    else if (blank(vb)) out[key] = va;
    else if (key === 'tags') out[key] = unionTags(va, vb);
    else if (typeof va === 'boolean') out[key] = va || vb;
    else if (typeof va === 'number' && typeof vb === 'number') out[key] = Math.max(va, vb);
    else if (key === 'description' && typeof va === 'string' && typeof vb === 'string') {
      if (caption && va.trim() === caption) out[key] = vb;
      else if (caption && vb.trim() === caption) out[key] = va;
      else out[key] = va.length > vb.length || (va.length === vb.length && aFirst) ? va : vb;
    } else if (!ta && !tb && typeof va === 'string' && typeof vb === 'string') out[key] = va.length > vb.length ? va : vb;
    else out[key] = aFirst ? va : vb;
  }
  return out;
}

const mergeMap = (a = {}, b = {}, existing = {}) => Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])]
  .map((key) => [key, mergeEntry(a[key], b[key], existing[key])]));

/**
 * Two copies of the desk into one: this browser's (`local`) and the one saved to Ryan's account (`remote`).
 * Entry by entry, so newer work on either side survives; the place (cursor) comes from the copy changed last.
 * `existing` maps a picture key to the caption its post already had (see mergeEntry).
 */
export function mergeStates(local, remote, existing = {}) {
  const a = local ?? {};
  const b = remote ?? {};
  const newer = (Number(b.savedAt) || 0) > (Number(a.savedAt) || 0) ? b : a;
  const merged = {
    ...b,
    ...a,
    projects: mergeMap(a.projects, b.projects),
    images: mergeMap(a.images, b.images, existing),
    // a deleted article stays as a stamped {deleted: true}, so the newer delete wins over an older copy
    articles: mergeMap(a.articles, b.articles),
    days: {...b.days, ...a.days},
    cursor: Number.isInteger(newer.cursor) ? newer.cursor : (a.cursor ?? b.cursor ?? 0),
    session: Math.max(Number(a.session) || 0, Number(b.session) || 0),
    savedAt: Math.max(Number(a.savedAt) || 0, Number(b.savedAt) || 0) || undefined,
  };
  if (merged.savedAt === undefined) delete merged.savedAt;
  return merged;
}

const withoutStamps = (entry) => Object.fromEntries(Object.entries(entry ?? {}).filter(([key]) => !STAMPS.has(key)));

/**
 * Load export: the projects in a version 4 export, and their pictures, REPLACE what this copy has for them.
 * Nothing of the old record survives (a lead picture, a credit or words the export does not have are gone),
 * and every replaced entry is stamped `now`, so it also wins over the account copy when the two merge.
 * Projects not in the export are left alone. Mutates `state`; returns the ids of the projects loaded.
 */
export function applyExport(state, loaded, now) {
  if (loaded?.version !== 4 || !loaded.images || typeof loaded.images !== 'object') throw new Error('not a version 4 export');
  const opened = Object.keys(loaded.projects ?? {});
  const isOpened = new Set(opened);
  state.projects ??= {};
  state.images ??= {};
  for (const id of opened) state.projects[id] = { ...withoutStamps(loaded.projects[id]), at: now };
  // pictures of a loaded project that the export does not list are cleared too
  for (const key of Object.keys(state.images)) if (isOpened.has(key.split('::')[0])) state.images[key] = { at: now };
  for (const [key, entry] of Object.entries(loaded.images)) {
    if (!isOpened.has(entry?.projectId ?? key.split('::')[0])) continue;
    const record = { description: entry.description ?? '', tags: (entry.imageKeywords ?? []).join(', '), reviewed: Boolean(entry.reviewed) };
    if (entry.credit !== undefined) record.credit = entry.credit;
    state.images[key] = { ...record, at: now };
  }
  return opened;
}

/** Same work in both? (Ignores the place and the session counter, which are per browser.) */
export function sameWork(a, b) {
  const keyed = (state) => JSON.stringify(KINDS.map((kind) => Object.entries(state?.[kind] ?? {})
    .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)).map(([key, entry]) => [key, contentOf(entry), entry?.at ?? 0])));
  return keyed(a) === keyed(b) && JSON.stringify(Object.keys(a?.days ?? {}).sort()) === JSON.stringify(Object.keys(b?.days ?? {}).sort());
}

/**
 * Where Ryan is, for the overview: per portfolio and per project, done / started / not started.
 * `projects` is the desk's DATA.projects (with images and their existingDescription). `credits`, when the
 * page has photographer credits, maps a picture key to the credit the archive already has; modelling
 * projects then count their pictures without a photographer.
 */
export function summarize(projects, state, {credits = null, now = Date.now()} = {}) {
  const today = dayOf(now);
  const record = (image) => state.images?.[image.key] ?? state.images?.[image.url];
  const rows = projects.map((project, index) => {
    const own = state.projects?.[project.id] ?? {};
    const touched = !isPristine(own) || project.images.some((image) => !isPristine(record(image), image.existingDescription));
    // a project the archive already has words for counts as done until Ryan reopens it on the desk
    const status = (own.reviewed ?? project.done) ? 'done' : touched ? 'started' : 'todo';
    const creditName = (credit) => String(credit?.name ?? '').trim();
    const creditsMissing = credits && project.id.startsWith('vaguelyvulgar/')
      ? project.images.filter((image) => !creditName(record(image)?.credit) && !creditName(own.credit) && !creditName(credits[image.key])).length
      : null;
    return {
      index,
      id: project.id,
      title: project.title,
      portfolio: project.portfolio,
      pictures: project.images.length,
      status,
      keywords: own.tags !== undefined ? tagList(own.tags).length : (project.keywords?.length ?? 0),
      lead: Boolean(own.hero),
      creditsMissing,
      doneToday: Boolean(own.reviewed && own.doneAt && dayOf(own.doneAt) === today),
    };
  });
  const count = (list, status) => list.filter((row) => row.status === status).length;
  const portfolios = [...new Set(rows.map((row) => row.portfolio))].map((name) => {
    const list = rows.filter((row) => row.portfolio === name);
    return {name, total: list.length, done: count(list, 'done'), started: count(list, 'started'), todo: count(list, 'todo'), rows: list};
  });
  // the one next step: where Ryan is if that project is not done, else the next one that is not
  const flatIndex = Number.isInteger(state.cursor) ? state.cursor : 0;
  let at = 0;
  let seen = 0;
  for (const [index, project] of projects.entries()) {
    if (flatIndex < seen + project.images.length) { at = index; break; }
    seen += project.images.length;
  }
  const order = [...rows.slice(at), ...rows.slice(0, at)];
  const next = order.find((row) => row.status !== 'done') ?? null;
  return {
    total: rows.length,
    done: count(rows, 'done'),
    started: count(rows, 'started'),
    todo: count(rows, 'todo'),
    portfolios,
    next: next && {index: next.index, id: next.id, title: next.title, status: next.status},
    daysWorked: Object.keys(state.days ?? {}).length,
    doneToday: rows.filter((row) => row.doneToday).length,
    savedAt: state.savedAt ?? null,
  };
}
