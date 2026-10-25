// Keeps the image desk's work for Ryan and shows him where he is.
//
// - Every save the desk makes in the browser is stamped (desk-store.js) and, when Ryan is signed in,
//   written to his account a moment later (desk-cloud.js). Opening the desk merges the account's copy
//   with the browser's, entry by entry, so newer work on either side is kept.
// - The overview (#overview) is the calm page: one "Next up" button, progress per portfolio, every
//   project's state, when it was last saved and how many days he worked on it.
//
// The page's own script (src/pages/image-metadata.astro) exposes window.imageDesk and calls
// window.deskSync.stamp / .saved from its save(); everything else lives here.
import { stamp, snapshotOf, mergeStates, sameWork, summarize, applyExport } from './desk-store.js';

const desk = window.imageDesk;
const $ = (id) => document.getElementById(id);
const time = (ms) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const existing = Object.fromEntries(desk.DATA.projects.flatMap((project) => project.images.map((image) => [image.key, image.existingDescription ?? ''])));
const credits = (() => { try { return JSON.parse($('credit-data')?.textContent ?? 'null'); } catch { return null; } })();

let snap = snapshotOf(desk.state);
let cloud = null; // desk-cloud.js once loaded
let user = null;
let first = true; // the first copy from the account moves Ryan to where he was; later ones keep his place
let timer = 0;
let status = { kind: 'local' };
let remoteCopy = null; // the account's copy as last seen, so a save that changes nothing writes nothing

function show(next) {
  status = next;
  const line = {
    local: 'Not signed in: saved in this browser only',
    checking: 'Checking your account…',
    saving: 'Saving…',
    saved: `Saved · ${time(status.at ?? Date.now())}`,
    denied: `Signed in as ${user?.email ?? 'another account'}: this account can't save the desk. Saved in this browser only`,
    offline: 'Offline: saved in this browser, your account follows when you are back online',
    error: `Not saved to your account (${status.message}). Saved in this browser`,
  }[status.kind];
  for (const el of document.querySelectorAll('[data-desk-saved]')) el.textContent = line;
  for (const el of document.querySelectorAll('[data-desk-signin]')) el.hidden = !(status.kind === 'local' && cloud);
  renderOverview();
}

/** Puts a merged copy into the page's state (same object, so the page's own code sees it) and redraws. */
function apply(merged, { keepPlace }) {
  if (keepPlace) merged.cursor = desk.state.cursor;
  for (const key of Object.keys(desk.state)) if (!(key in merged)) delete desk.state[key];
  Object.assign(desk.state, merged);
  snap = snapshotOf(desk.state);
  desk.render({ focus: false });
}

function push() {
  clearTimeout(timer);
  if (!cloud || !user || (remoteCopy && sameWork(desk.state, remoteCopy))) return;
  timer = setTimeout(async () => {
    if (!navigator.onLine) return show({ kind: 'offline' });
    show({ kind: 'saving' });
    try {
      const merged = await cloud.save((remote) => ({ ...mergeStates(desk.state, remote), summary: overviewSummary() }));
      remoteCopy = merged;
      if (!sameWork(merged, desk.state)) apply(merged, { keepPlace: true });
      show({ kind: 'saved', at: Date.now() });
    } catch (error) {
      show(error.code === 'permission-denied' ? { kind: 'denied' } : { kind: 'error', message: error.code === 'too-big' ? error.message : error.code ?? error.message });
    }
  }, 1200);
}

window.deskSync = {
  stamp: (state) => stamp(state, snap, Date.now(), existing),
  saved: () => { renderOverview(); push(); },
  // Load export: replaces the loaded projects' records (the page then calls save(), which writes through)
  load: (state, loaded) => applyExport(state, loaded, Date.now()),
};
addEventListener('online', push);

// what /private shows on its ticket for the desk
function overviewSummary() {
  const sum = summarize(desk.DATA.projects, desk.state, { credits });
  return { done: sum.done, total: sum.total, next: sum.next?.title ?? null, savedAt: Date.now() };
}

// ---------- the overview ----------
const label = { done: 'Done', started: 'Started', todo: 'Not started' };
const el = (tag, props = {}, ...children) => { const node = Object.assign(document.createElement(tag), props); node.append(...children.filter((child) => child !== null && child !== undefined && child !== false)); return node; };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function bar(part) {
  const wrap = el('div', { className: 'ov-bar', role: 'img' });
  wrap.setAttribute('aria-label', `${part.done} done, ${part.started} started, ${part.todo} not started, of ${part.total}`);
  for (const kind of ['done', 'started']) {
    const fill = el('span', { className: `ov-${kind}` });
    fill.style.width = `${(part[kind] / part.total) * 100}%`;
    wrap.append(fill);
  }
  return wrap;
}

function openProject(index) {
  const start = desk.flat.findIndex((item) => item.projectIndex === index);
  if (start >= 0) desk.state.cursor = start;
  closeOverview();
  desk.render();
}

function renderOverview() {
  const root = $('overview');
  if (!root || root.hidden) return;
  const sum = summarize(desk.DATA.projects, desk.state, { credits });
  const next = $('ov-next');
  next.textContent = sum.next ? `Next up: ${sum.next.title} →` : 'Every project is done ✓';
  next.disabled = !sum.next;
  next.onclick = () => sum.next && openProject(sum.next.index);
  $('ov-total').textContent = `${sum.done} of ${sum.total} projects done`;
  $('ov-total-bar').replaceChildren(bar(sum));
  $('ov-legend').textContent = `${sum.done} done · ${sum.started} started · ${sum.todo} not started`;
  $('ov-days').textContent = sum.daysWorked
    ? `Worked on ${plural(sum.daysWorked, 'day')}${sum.doneToday ? ` · ${sum.doneToday} done today` : ''}`
    : 'No days counted yet: the count starts with your next change.';
  $('ov-portfolios').replaceChildren(...sum.portfolios.map((part) => {
    const rows = part.rows.map((row) => {
      const facts = [
        label[row.status],
        plural(row.keywords, 'keyword'),
        row.lead ? '★ lead picture chosen' : null,
        row.creditsMissing ? `${plural(row.creditsMissing, 'picture')} without photographer` : null,
      ].filter(Boolean).join(' · ');
      const button = el('button', { type: 'button', className: 'ov-row' }, el('span', { className: `ov-dot ov-${row.status}`, ariaHidden: 'true' }), el('strong', {}, row.title), el('small', {}, facts));
      button.addEventListener('click', () => openProject(row.index));
      return el('li', {}, button);
    });
    const details = el('details', { className: 'ov-portfolio' },
      el('summary', {}, el('span', {}, el('strong', {}, part.name), el('small', {}, `${part.done} of ${part.total} done`)), bar(part)),
      el('ul', {}, ...rows));
    return details;
  }));
}

function openOverview() {
  $('overview').hidden = false;
  renderOverview();
  if (location.hash !== '#overview') history.replaceState(null, '', '#overview');
  $('ov-next').focus({ preventScroll: true });
}
function closeOverview() {
  $('overview').hidden = true;
  if (location.hash === '#overview') history.replaceState(null, '', location.pathname + location.search);
}
$('open-overview')?.addEventListener('click', openOverview);
$('ov-close').addEventListener('click', () => { closeOverview(); desk.render(); });
addEventListener('hashchange', () => (location.hash === '#overview' ? openOverview() : closeOverview()));
addEventListener('keydown', (event) => { if (event.key === 'Escape' && !$('overview').hidden) { closeOverview(); desk.render(); } });
for (const button of document.querySelectorAll('[data-desk-signin]')) {
  button.addEventListener('click', async () => {
    try { await cloud?.signIn(); } catch (error) { show({ kind: 'error', message: error.code ?? error.message }); }
  });
}
if (location.hash === '#overview') openOverview();
show({ kind: 'local' });

// ---------- the account copy ----------
let unwatch = null;
import('./desk-cloud.js').then((module) => {
  cloud = module;
  cloud.watchUser((signedIn) => {
    unwatch?.();
    unwatch = null;
    user = signedIn;
    first = true;
    if (!user) return show({ kind: 'local' });
    show({ kind: 'checking' });
    remoteCopy = null;
    unwatch = cloud.watchRemote((remote, updated) => {
      remoteCopy = remote;
      const merged = mergeStates(desk.state, remote);
      if (!sameWork(merged, desk.state) || (first && remote && merged.cursor !== desk.state.cursor)) {
        apply(merged, { keepPlace: !first });
        try { localStorage.setItem(desk.STORE, JSON.stringify(desk.state)); } catch {}
      }
      const behind = !remote || !sameWork(merged, remote);
      first = false;
      if (behind) push();
      else if (status.kind === 'checking' || status.kind === 'saved') show({ kind: 'saved', at: updated ?? Date.now() });
    }, (error) => show(error.code === 'permission-denied' ? { kind: 'denied' } : { kind: 'error', message: error.code ?? error.message }));
  });
}).catch((error) => show({ kind: 'error', message: `could not load the account code: ${error.message}` }));
