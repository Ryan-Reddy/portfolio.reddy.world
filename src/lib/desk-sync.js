import {samePlace} from './desk-progress.js';
import {publicationSnapshot,restoredState} from './desk-history.js';
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
import {allDeskItems,findDeskItems} from './desk-items.js';

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
    saved: `Saved privately · ${time(status.at ?? Date.now())}`,
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
  if (keepPlace){merged.cursor=desk.state.cursor;merged.article=desk.state.article;merged.place=desk.state.place;}
  else merged.cursor=desk.resumeCursor(merged);
  for (const key of Object.keys(desk.state)) if (!(key in merged)) delete desk.state[key];
  Object.assign(desk.state, merged);
  snap = snapshotOf(desk.state);
  // kept in the browser at once, so work merged in from the account is the browser's own copy from now on
  try { localStorage.setItem(desk.STORE, JSON.stringify(desk.state)); } catch {}
  desk.render({ focus: false,restorePlace:!keepPlace });
}

function push() {
  clearTimeout(timer);
  if (!cloud || !user || (remoteCopy && sameWork(desk.state, remoteCopy) && samePlace(desk.state,remoteCopy))) return;
  timer = setTimeout(saveNow, 1200);
}

async function saveNow() {
  clearTimeout(timer);
  if (!cloud || !user || (remoteCopy && sameWork(desk.state, remoteCopy) && samePlace(desk.state,remoteCopy))) return;
  if (!navigator.onLine) return show({ kind: 'offline' });
  show({ kind: 'saving' });
  try {
    // the /private ticket's summary is made from what is written, the merged copy
    const merged = await cloud.save((remote) => {
      const copy = mergeStates(desk.state, remote, existing);
      return { ...copy, summary: overviewSummary(copy) };
    });
    remoteCopy = merged;
    // merged again with what Ryan typed while the save was on its way, so those keystrokes win
    const next = mergeStates(desk.state, merged, existing);
    if (!sameWork(next, desk.state)) apply(next, { keepPlace: true });
    if (!sameWork(next, merged)||!samePlace(next,merged)) push();
    show({ kind: 'saved', at: Date.now() });
  } catch (error) {
    show(error.code === 'permission-denied' ? { kind: 'denied' } : { kind: 'error', message: error.code === 'too-big' ? error.message : error.code ?? error.message });
  }
}

// "Send to site": reddy.world's /api/desk-to-site (functions/desk.js there) starts the portfolio repo's
// desk-to-site workflow, which reads this desk from the account and opens a pull request with a preview.
// Off reddy.world (a PR preview of this repo) there is no such address: the workflow's page is the way.
const RUN_PAGE = 'https://github.com/Ryan-Reddy/portfolio.reddy.world/actions/workflows/desk-to-site.yml';
const DESK_PRS = 'https://github.com/Ryan-Reddy/portfolio.reddy.world/pulls?q=is%3Apr+is%3Aopen+head%3Adesk%2F';
async function send() {
  if (!cloud || !user) return { kind: 'signin' };
  await saveNow();
  if (status.kind !== 'saved') return { kind: 'unsaved', line: document.querySelector('[data-desk-saved]')?.textContent ?? '' };
  await cloud.checkpoint(publicationSnapshot(desk));
  let response;
  try {
    response = await fetch('/api/desk-to-site', { method: 'POST', headers: { Authorization: `Bearer ${await cloud.idToken()}` } });
  } catch {
    return { kind: 'manual', url: 'https://reddy.world/private/portfolio/' };
  }
  if (response.status === 404) return { kind: 'manual', url: 'https://reddy.world/private/portfolio/' };
  const body = await response.json().catch(() => ({}));
  if (!response.ok) return { kind: 'failed', message: body.error ?? `HTTP ${response.status}`, url: RUN_PAGE };
  return { kind: 'sent', prs: DESK_PRS, run: body.run ?? RUN_PAGE };
}

// An article's pictures: uploaded to reddy.world's /api/desk-upload (functions/desk.js there), private in the
// project's Storage until the article is published; shown on the desk from there with Ryan's sign-in.
async function upload(file) {
  if (!cloud || !user) throw new Error('Sign in to upload images or videos to your account.');
  const response = await fetch('/api/desk-upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${await cloud.idToken()}`, 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) },
    body: file,
  });
  if (response.status === 404) throw new Error('Upload files from the live desk at reddy.world.');
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? (response.status >= 500 ? 'The upload service is unavailable. Your page is saved; try the upload again later.' : `Upload failed (${response.status}). Try again.`));
  return { path: body.path, name: body.name };
}
async function picture(path) {
  if (!cloud || !user) return null;
  const response = await fetch(`/api/desk-upload?path=${encodeURIComponent(path)}`, { headers: { Authorization: `Bearer ${await cloud.idToken()}` } });
  return response.ok ? URL.createObjectURL(await response.blob()) : null;
}

window.deskSync = {
  stamp: (state) => stamp(state, snap, Date.now(), existing),
  saved: () => { renderOverview(); push(); },
  // Load export: replaces the loaded projects' records (the page then calls save(), which writes through)
  load: (state, loaded) => applyExport(state, loaded, Date.now()),
  send,
  saveNow,
  upload,
  picture,
};
addEventListener('online', push);

// what /private shows on its ticket for the desk
function overviewSummary(state = desk.state) {
  const sum = summarize(desk.DATA.projects, state, { credits });
  return { done: sum.done, total: sum.total, next: sum.next?.title ?? null, drafts: drafts(state).length, savedAt: Date.now() };
}
const drafts = (state = desk.state) => Object.entries(state.articles ?? {}).filter(([, article]) => article && !article.deleted)
  .sort(([, a], [, b]) => (b.created ?? 0) - (a.created ?? 0));

// ---------- the overview ----------
const label = { done: 'Reviewed', started: 'Started', todo: 'Not started' };
const el = (tag, props = {}, ...children) => { const node = Object.assign(document.createElement(tag), props); node.append(...children.filter((child) => child !== null && child !== undefined && child !== false)); return node; };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function bar(part) {
  const wrap = el('div', { className: 'ov-bar', role: 'img' });
  wrap.setAttribute('aria-label', `${part.done} reviewed, ${part.started} started, ${part.todo} not started, of ${part.total}`);
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
  desk.state.article = null;desk.save();
  closeOverview();
  desk.render();
}

function renderOverview() {
  const root = $('overview');
  if (!root || root.hidden) return;
  const sum = summarize(desk.DATA.projects, desk.state, { credits });
  const next = $('ov-next');
  next.textContent = sum.next ? `Next up: ${sum.next.title} →` : 'Every project reviewed ✓';
  next.disabled = !sum.next;
  next.onclick = () => sum.next && openProject(sum.next.index);
  $('ov-total').textContent = `${sum.done} of ${sum.total} projects reviewed`;
  $('ov-total-bar').replaceChildren(bar(sum));
  $('ov-legend').textContent = `${sum.done} reviewed · ${sum.started} started · ${sum.todo} not started`;
  $('ov-days').textContent = sum.daysWorked
    ? `Worked on ${plural(sum.daysWorked, 'day')}${sum.doneToday ? ` · ${sum.doneToday} reviewed today` : ''}`
    : 'No days counted yet: the count starts with your next change.';
  $('ov-portfolios').replaceChildren(...sum.portfolios.map((part) => {
    const rows = part.rows.map((row) => {
      const facts = [
        label[row.status],
        plural(row.keywords, 'tag'),
        row.lead ? 'Cover image chosen' : null,
        row.creditsMissing ? `${plural(row.creditsMissing, 'image')} without photographer` : null,
      ].filter(Boolean).join(' · ');
      const button = el('button', { type: 'button', className: 'ov-row' }, el('span', { className: `ov-dot ov-${row.status}`, ariaHidden: 'true' }), el('strong', {}, row.title), el('small', {}, facts));
      button.addEventListener('click', () => openProject(row.index));
      return el('li', {}, button);
    });
    const details = el('details', { className: 'ov-portfolio' },
      el('summary', {}, el('span', {}, el('strong', {}, part.name), el('small', {}, `${part.done} of ${part.total} reviewed`)), bar(part)),
      el('ul', {}, ...rows));
    return details;
  }));
  renderItemList();
}

function renderItemList() {
  const items = allDeskItems(desk.DATA,desk.state);
  const matches = findDeskItems(items,{query:$('ov-search').value,type:$('ov-type').value,status:$('ov-status').value});
  const statusLabels={draft:'Draft',ready:'Ready to publish',published:'Published',todo:'Needs review',reviewed:'Reviewed'};
  $('ov-results').textContent=`${matches.length} of ${items.length} items · ${plural(items.filter(i=>i.type==='article').length,'article')} · ${plural(items.filter(i=>i.type==='project').length,'project')}`;
  const rows = matches.map(item => {
    const button = el('button', { type: 'button', className: 'ov-row' }, el('span', { className: 'ov-dot', ariaHidden: 'true' }),
      el('strong', {}, item.title), el('small', {}, [item.type==='article'?'Article':'Project',item.detail,statusLabels[item.status],!item.hasText?'No body text':null].filter(Boolean).join(' · ')));
    if(item.editable)button.addEventListener('click',()=>{if(item.type==='project')openProject(item.index);else{closeOverview();desk.openArticle(item.id);}});
    else {
      const link=el('a',{href:item.href,className:'ov-row'},el('strong',{},item.title),el('small',{},'Published article · View page'));
      return el('li',{},link);
    }
    return el('li',{},button);
  });
  $('ov-items').replaceChildren(...(rows.length?rows:[el('li',{},'No items match. Try a different search or filter.')]));
}
for(const id of ['ov-search','ov-type','ov-status'])$(id).addEventListener(id==='ov-search'?'input':'change',renderItemList);
$('ov-new').addEventListener('click',()=>{closeOverview();desk.newArticle();});

function openOverview() {
  $('overview').hidden = false;
  renderOverview();
  if (location.hash !== '#overview') history.replaceState(null, '', '#overview');
  $('ov-search').focus({ preventScroll: true });
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
// The edit bar on the project pages (src/lib/edit-bar.js) loads only where this flag is set: in a browser
// whose account has read the desk, which only Ryan's can (the rules are owner-only)
const OWNER_FLAG = 'reddy-desk-owner';
const owner = (yes) => { try { if (yes) localStorage.setItem(OWNER_FLAG, '1'); else localStorage.removeItem(OWNER_FLAG); } catch {} };
import('./desk-cloud.js').then((module) => {
  cloud = module;
  cloud.watchUser((signedIn) => {
    unwatch?.();
    unwatch = null;
    user = signedIn;
    first = true;
    if (!user) { owner(false); return show({ kind: 'local' }); }
    show({ kind: 'checking' });
    remoteCopy = null;
    unwatch = cloud.watchRemote((remote, updated) => {
      owner(true);
      if(first)queueMicrotask(()=>desk.render({focus:false}));
      remoteCopy = remote;
      const merged = mergeStates(desk.state, remote, existing);
      if (!sameWork(merged, desk.state) || (first && remote && !samePlace(merged,desk.state))) {
        // opened on one project (the edit bar's "Open in the desk"): stay there
        apply(merged, { keepPlace: !first || desk.pinned });
      }
      const behind = !remote || !sameWork(merged, remote)||!samePlace(merged,remote);
      first = false;
      if (behind) push();
      else if (status.kind === 'checking' || status.kind === 'saved') show({ kind: 'saved', at: updated ?? Date.now() });
    }, (error) => {
      if (error.code === 'permission-denied') owner(false);
      show(error.code === 'permission-denied' ? { kind: 'denied' } : { kind: 'error', message: error.code ?? error.message });
    });
  });
}).catch((error) => show({ kind: 'error', message: `could not load the account code: ${error.message}` }));

// History is beside publishing: restoring is a new draft, never an immediate site change.
const historyButton=document.createElement('button');historyButton.type='button';historyButton.textContent='Version history';historyButton.className='quiet';document.querySelector('.more .menu').prepend(historyButton);
const historyDialog=document.createElement('dialog');historyDialog.setAttribute('aria-label','Version history');document.body.append(historyDialog);
historyButton.addEventListener('click',async()=>{
 historyDialog.replaceChildren();const title=document.createElement('h2');title.textContent='Version history';historyDialog.append(title);
 const note=document.createElement('p');note.textContent='Four recent versions, including three updates back. Restore loads a draft for review; Publish changes sends it to the site.';historyDialog.append(note);
 const close=document.createElement('button');close.textContent='Close';close.onclick=()=>historyDialog.close();historyDialog.append(close);historyDialog.showModal();
 try{
  if(!user || !cloud)throw new Error('Sign in to see your account history.');
  const versions=await cloud.versions();
  if(!versions.length){const empty=document.createElement('p');empty.textContent='Your first backup is created when you publish from this updated desk.';historyDialog.append(empty);}
  for(const [i,version] of versions.entries()){
   const row=document.createElement('p');const button=document.createElement('button');button.textContent='Restore as draft';row.append(document.createTextNode((i===0?'Latest sent version':i+' update'+(i===1?'':'s')+' back')+' · '+new Date(version.at).toLocaleString()+' '),button);historyDialog.append(row);
   button.onclick=async()=>{button.disabled=true;try{await cloud.checkpoint(publicationSnapshot(desk));apply(restoredState(publicationSnapshot(desk),version.state),{keepPlace:true});desk.save();await saveNow();historyDialog.close();}catch(error){note.textContent=error.message;button.disabled=false;}};
  }
 }catch(error){note.textContent=error.message;}
});

// An explicit save complements autosave; it never starts publishing.
$('save-desk').addEventListener('click',async()=>{
 const button=$('save-desk');button.disabled=true;button.textContent='Saving…';
 try {desk.saveCurrent();await saveNow();button.textContent=status.kind==='saved'?'Saved':'Saved here';}
 catch(error){button.textContent='Save failed';show({kind:'error',message:error.message});}
 finally {button.disabled=false;setTimeout(()=>{button.textContent='Save';},2500);}
});
