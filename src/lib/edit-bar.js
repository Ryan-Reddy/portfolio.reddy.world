// Ryan's edit bar on a project page, like WordPress's admin bar (Ryan, 2026-10-26: "maybe its nice to
// have a banner like wp admin ? and it just helps me edit the page in place?").
// - Base.astro loads this only in a browser where Ryan is signed in to the desk (desk-sync.js keeps the
//   flag), or on a preview address with ?edit, where it saves in that browser only.
// - "Edit this page": the short summary and the text become editable where they stand; every picture gets
//   a ✎ for what it shows, its own keywords, its photographer and "lead picture". The project's keywords
//   open from the bar.
// - Everything is written to the desk itself: the same browser copy and the same account copy, merged the
//   same way (desk-store.js). The desk shows it, and "Send to site" sends it; the page changes after that.
import { stamp, snapshotOf, mergeStates } from './desk-store.js';
import { mountEditor, fromEditor } from './desk-text.js';
import {blankText} from './content.js';

const STORE = 'reddy-world-image-metadata-v4';
const OWNER_FLAG = 'reddy-desk-owner';
const HERE = location.pathname.startsWith('/portfolio/') && location.hostname === 'reddy.world';
const DATA_URLS = ['/private/portfolio/data.json', '/portfolio/image-metadata/data.json'];
const DESK_URL = HERE ? '/private/portfolio/' : '/portfolio/image-metadata/';
const RUN_PAGE = 'https://github.com/Ryan-Reddy/portfolio.reddy.world/actions/workflows/desk-to-site.yml';
const DESK_PRS = 'https://github.com/Ryan-Reddy/portfolio.reddy.world/pulls?q=is%3Apr+is%3Aopen+head%3Adesk%2F';

const article = document.querySelector('[data-desk-project]');
if (article) start(article.dataset.deskProject).catch((error) => console.warn('edit bar:', error));

// ---------- the desk's rules for a field (src/pages/image-metadata.astro) ----------
const tagList = (value = '') => [...new Map(String(value).split(',').map((tag) => tag.trim()).filter(Boolean).map((tag) => [tag.toLowerCase(), tag])).values()];
const same = (a, b) => a.toLowerCase() === b.toLowerCase();
const isCleared = (record, field) => Array.isArray(record?.cleared) && record.cleared.includes(field);
const pick = (record, field, base) => (isCleared(record, field) ? '' : String(record?.[field] ?? '').trim() ? record[field] : base);
function withValue(record, field, value, base) {
  const cleared = (record?.cleared ?? []).filter((name) => name !== field);
  if (!String(value ?? '').trim() && String(base ?? '').trim()) cleared.push(field);
  const next = { ...record, [field]: value };
  if (cleared.length) next.cleared = cleared;
  else delete next.cleared;
  return next;
}
const readLocal = () => {
  try { return { projects: {}, images: {}, ...JSON.parse(localStorage.getItem(STORE) || '{}') }; } catch { return { projects: {}, images: {} }; }
};

async function loadData() {
  for (const url of DATA_URLS) {
    try {
      const response = await fetch(url, { cache: 'no-cache' });
      if (response.ok) return await response.json();
    } catch {}
  }
  return null;
}

async function start(id) {
  const data = await loadData();
  const project = data?.projects.find((p) => p.id === id);
  if (!project) return;
  const existing = Object.fromEntries(project.images.map((image) => [image.key, image.existingDescription ?? '']));
  let state = readLocal();
  let snap = snapshotOf(state);
  let cloud = null;
  let user = null;
  let remoteSeen = false;
  let timer = 0;
  let editing = false;

  // ---------- reading and writing the desk ----------
  const record = () => state.projects[project.id] ?? {};
  const imageRecord = (image) => state.images[image.key] ?? state.images[image.url] ?? {};
  const ownWords = (image) => image.keywords.filter((word) => !project.keywords.some((shared) => same(shared, word)));
  const projectTags = () => tagList(pick(record(), 'tags', project.keywords.join(', ')));
  const summaryOf = () => pick(record(), 'summary', project.summary);
  const contentOf = () => (record().content !== undefined ? record().content : project.content);
  const imageTags = (image) => tagList(pick(imageRecord(image), 'tags', ownWords(image).join(', ')));
  const descriptionOf = (image) => pick(imageRecord(image), 'description', image.description || image.existingDescription || image.alt || '');
  const heroOf = () => record().hero || project.hero;

  function persist() {
    stamp(state, snap, Date.now(), existing);
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch {}
    show('Saved in this browser');
    clearTimeout(timer);
    if (cloud && user) timer = setTimeout(saveRemote, 1200);
  }
  async function saveRemote() {
    show('Saving to your desk…');
    try {
      const merged = await cloud.save((remote) => ({ ...mergeStates(state, remote, existing), ...(remote?.summary ? { summary: remote.summary } : {}) }));
      state = mergeStates(state, merged, existing);
      snap = snapshotOf(state);
      try { localStorage.setItem(STORE, JSON.stringify(state)); } catch {}
      show(`Saved to your desk · ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`);
    } catch (error) {
      show(error.code === 'permission-denied' ? 'This account can\'t save the desk: saved in this browser only' : `Not saved to your desk (${error.code ?? error.message})`);
    }
  }
  function setProject(field, value, base) {
    const current = state.projects[project.id];
    if (!current && value === base) return;
    state.projects[project.id] = withValue(current, field, value, base);
    persist();
  }
  function setImage(image, field, value, base) {
    const current = state.images[image.key] ?? state.images[image.url];
    if (!current && value === base) return;
    state.images[image.key] = withValue(current, field, value, base);
    persist();
  }

  // ---------- the bar ----------
  const host = document.createElement('div');
  host.id = 'desk-edit-bar';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; font-family: Inter, system-ui, sans-serif; }
      .bar { position: fixed; inset: 0 0 auto 0; z-index: 2147483000; height: 44px; display: flex; align-items: center; gap: .5rem; padding: 0 .75rem; background: #111; color: #f5f5f0; border-bottom: 1px solid #c7a86d; font-size: 13px; }
      .name { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 17px; font-weight: 600; color: #c7a86d; white-space: nowrap; }
      button, a.button { min-height: 30px; padding: 0 .7rem; border: 1px solid #c7a86d; background: transparent; color: #c7a86d; font-size: 13px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; white-space: nowrap; }
      button.on, button.primary { background: #c7a86d; color: #111; font-weight: 600; }
      button.quiet { border-color: #444; color: #ddd; }
      button:focus-visible, a:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
      .status { color: #aaa; font-size: 12px; margin-left: auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
      .panel { position: fixed; top: 52px; right: 12px; z-index: 2147483001; width: min(360px, calc(100vw - 24px)); max-height: calc(100vh - 70px); overflow: auto; padding: 1rem; background: #151515; color: #f5f5f0; border: 1px solid #c7a86d; display: grid; gap: .6rem; font-size: 13px; }
      .panel[hidden] { display: none; }
      .panel h2 { margin: 0; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 20px; color: #c7a86d; }
      .panel img { width: 100%; max-height: 180px; object-fit: contain; background: #000; }
      label { display: grid; gap: .25rem; font-weight: 600; }
      input, textarea { width: 100%; padding: .45rem .55rem; background: #1f1f1f; color: #f5f5f0; border: 1px solid #555; font-size: 13px; }
      textarea { min-height: 70px; resize: vertical; }
      .chips { display: flex; flex-wrap: wrap; gap: .3rem; }
      .chip { display: inline-flex; align-items: center; gap: .2rem; padding: .15rem .2rem .15rem .5rem; background: #2b251a; color: #e7cf9d; }
      .chip button { min-height: 0; padding: 0 .3rem; border: 0; color: #e7cf9d; }
      .hint { color: #aaa; font-weight: 400; margin: 0; line-height: 1.4; }
      .row { display: flex; gap: .4rem; flex-wrap: wrap; align-items: center; }
      @media (max-width: 700px) { .name, .wide { display: none; } }
    </style>
    <div class="bar" role="region" aria-label="Edit bar">
      <span class="name">Desk</span>
      <button id="edit" type="button" aria-pressed="false">✎ Edit this page</button>
      <button id="words" type="button" class="quiet">Keywords</button>
      <span class="status" id="status" aria-live="polite"></span>
      <button id="signin" type="button" class="quiet" hidden>Sign in</button>
      <a class="button wide" id="desk" href="${DESK_URL}#project=${encodeURIComponent(project.id)}">Open in the desk</a>
      <button id="send" type="button" class="primary">Send to site</button>
      <button id="close" type="button" class="quiet" aria-label="Hide the bar for this page">×</button>
    </div>
    <section class="panel" id="words-panel" hidden aria-label="Keywords for every picture in this project">
      <h2>Keywords</h2>
      <p class="hint">Every picture in this project gets them.</p>
      <div class="chips" id="word-chips"></div>
      <input id="word-input" placeholder="Add a keyword, then Enter" autocomplete="off">
    </section>
    <section class="panel" id="picture-panel" hidden aria-label="This picture">
      <h2>This picture</h2>
      <img id="pic" alt="">
      <label>What someone who can't see it should hear <textarea id="pic-description"></textarea></label>
      <label>Its own keywords <input id="pic-words" autocomplete="off" placeholder="comma between words"></label>
      <label>Photographer <input id="pic-credit" autocomplete="off" placeholder="Name as it should appear"></label>
      <label>Their site <input id="pic-credit-url" autocomplete="off" inputmode="url" placeholder="https://…"></label>
      <div class="row"><button id="pic-lead" type="button">☆ Make it the lead picture</button><button id="pic-close" type="button" class="quiet">Close</button></div>
    </section>`;
  document.body.prepend(host);
  const $ = (name) => shadow.getElementById(name);
  const show = (text) => { $('status').textContent = text; };

  // room for the bar above the page
  const room = document.createElement('style');
  room.textContent = `
    body { margin-top: 44px !important; }
    .site-header { top: 44px !important; }
    html[data-desk-editing] .post-summary, html[data-desk-editing] .modal-body-text { outline: 2px dashed #c7a86d; outline-offset: 6px; cursor: text; min-height: 1.6em; }
    html[data-desk-editing] .post-summary:empty::before { content: attr(data-placeholder); opacity: .5; }
    .desk-pics { display: inline-flex; gap: .2rem; padding: .2rem; margin: .2rem 0; border: 1px solid #555; background: #111; user-select: none; vertical-align: middle; }
    .desk-pics img { width: 2.8rem; height: 2.1rem; object-fit: cover; display: block; }
    .desk-pic-edit { position: absolute; top: .4rem; right: .4rem; z-index: 5; min-width: 2.2rem; min-height: 2.2rem; border: 1px solid #c7a86d; background: rgba(17,17,17,.85); color: #c7a86d; font-size: 1rem; cursor: pointer; }
    .desk-pic-edit[data-lead="true"]::after { content: ' ★'; }`;
  document.head.append(room);

  // ---------- the account ----------
  try {
    cloud = await import('./desk-cloud.js');
    cloud.watchUser((signedIn) => {
      user = signedIn;
      // signing in works on reddy.world itself; a preview address saves in the browser only
      $('signin').hidden = Boolean(user) || !HERE;
      if (!user) { show(HERE ? 'Not signed in: changes stay in this browser' : 'Preview: changes stay in this browser'); return; }
      cloud.watchRemote((remote) => {
        remoteSeen = true;
        state = mergeStates(state, remote, existing);
        snap = snapshotOf(state);
        try { localStorage.setItem(STORE, JSON.stringify(state)); } catch {}
        show('Your desk is up to date');
        if (!editing) refreshFields();
      }, (error) => {
        if (error.code === 'permission-denied') { try { localStorage.removeItem(OWNER_FLAG); } catch {} show('This account can\'t edit the desk'); }
        else show(`Your desk could not be read (${error.code ?? error.message})`);
      });
    });
  } catch {
    show('Changes stay in this browser');
  }
  $('signin').addEventListener('click', () => cloud?.signIn().catch((error) => show(error.code ?? error.message)));

  // ---------- editing in place ----------
  const header = article.querySelector('.modal-header, .comp-title');
  const title = article.querySelector('h1.modal-title');
  let summaryEl = article.querySelector('.post-summary');
  let createdSummary = false;
  let body = article.querySelector('.modal-body-text');
  let createdBody = false;
  let originalSummary = summaryEl?.textContent ?? '';
  let originalBody = body?.innerHTML ?? '';
  const pictureButtons = [];

  function refreshFields() {
    renderWords();
    for (const button of pictureButtons) button.dataset.lead = String(button.dataset.url === heroOf());
  }

  function enter() {
    editing = true;
    document.documentElement.dataset.deskEditing = '';
    $('edit').classList.add('on');
    $('edit').setAttribute('aria-pressed', 'true');
    $('edit').textContent = '✓ Done editing';
    if (!summaryEl) {
      summaryEl = Object.assign(document.createElement('p'), { className: 'post-summary' });
      (title ?? header)?.after(summaryEl);
      createdSummary = true;
    }
    summaryEl.dataset.placeholder = 'A short summary in your own words';
    summaryEl.textContent = summaryOf();
    summaryEl.contentEditable = 'plaintext-only';
    if (summaryEl.contentEditable !== 'plaintext-only') summaryEl.contentEditable = 'true';
    if (!body) {
      // a project without text gets an empty one where the text would stand: after the lead picture
      body = Object.assign(document.createElement('div'), { className: 'modal-body-text' });
      (article.querySelector('.post-hero') ?? article.querySelector('.modal-header') ?? article.querySelector('.comp-lead'))?.after(body);
      createdBody = true;
    }
    // the lead picture and the pictures below the text get a ✎; the ones in the text become small blocks
    // in the editor, and a click on one opens it too
    addPictureButtons();
    mountEditor(body,contentOf(),project.thumbs);
    body.contentEditable = 'true';
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch {}
    summaryEl.focus();
    show('Editing: everything you change is saved to your desk');
  }
  function leave() {
    editing = false;
    delete document.documentElement.dataset.deskEditing;
    $('edit').classList.remove('on');
    $('edit').setAttribute('aria-pressed', 'false');
    $('edit').textContent = '✎ Edit this page';
    summaryEl.contentEditable = 'false';
    body.contentEditable = 'false';
    // the page shows what the site has until Send to site; the desk has the changes
    if (createdSummary) { summaryEl.remove(); summaryEl = null; createdSummary = false; } else summaryEl.textContent = originalSummary;
    if (createdBody) { body.remove(); body = null; createdBody = false; } else body.innerHTML = originalBody;
    for (const button of pictureButtons.splice(0)) button.remove();
    $('picture-panel').hidden = true;
    show('Your changes are on the desk; Send to site puts them on the page');
  }
  $('edit').addEventListener('click', () => (editing ? leave() : enter()));
  article.addEventListener('input', (event) => {
    if (!editing) return;
    if (event.target === summaryEl) setProject('summary', summaryEl.textContent.trim(), project.summary);
    else if (body && body.contains(event.target)) {
      const current = state.projects[project.id] ?? {};
      const content = fromEditor(body);
      const next = {...current};
      if (blankText(content) || content === project.content) delete next.content;
      else next.content = content;
      state.projects[project.id] = next;
      persist();
    }
  });
  // Enter in the summary ends it: it is one or two lines
  article.addEventListener('keydown', (event) => { if (editing && event.target === summaryEl && event.key === 'Enter') { event.preventDefault(); body?.focus(); } });
  article.addEventListener('click', (event) => {
    const thumb = editing && event.target.closest?.('.desk-pics img');
    if (!thumb) return;
    const image = project.images.find((candidate) => candidate.src === thumb.getAttribute('src'));
    if (image) openPicture(image);
  });

  // ---------- pictures ----------
  const imageFor = (url) => project.images.find((image) => image.url === url);
  function addPictureButtons() {
    const marked = [...article.querySelectorAll('.gallery-thumb[data-full], img[data-desk-picture]')];
    for (const node of marked) {
      const url = node.dataset.full ?? node.dataset.deskPicture;
      const image = imageFor(url);
      if (!image) continue;
      const holder = node.closest('figure') ?? node.parentElement;
      if (getComputedStyle(holder).position === 'static') holder.style.position = 'relative';
      const button = Object.assign(document.createElement('button'), { type: 'button', className: 'desk-pic-edit', textContent: '✎' });
      button.dataset.url = url;
      button.dataset.lead = String(url === heroOf());
      button.setAttribute('aria-label', `Edit this picture (${image.index})`);
      button.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); openPicture(image); });
      holder.append(button);
      pictureButtons.push(button);
    }
  }
  let pictureOpen = null;
  function openPicture(image) {
    pictureOpen = image;
    $('words-panel').hidden = true;
    $('picture-panel').hidden = false;
    $('pic').src = image.src;
    $('pic-description').value = descriptionOf(image);
    $('pic-words').value = imageTags(image).join(', ');
    const credit = imageRecord(image).credit ?? image.credit ?? {};
    $('pic-credit').value = credit.name ?? '';
    $('pic-credit-url').value = credit.url ?? '';
    $('pic-lead').textContent = image.url === heroOf() ? '★ The lead picture' : '☆ Make it the lead picture';
    $('pic-description').focus();
  }
  $('pic-description').addEventListener('input', () => setImage(pictureOpen, 'description', $('pic-description').value.trim(), pictureOpen.description || pictureOpen.existingDescription || pictureOpen.alt || ''));
  $('pic-words').addEventListener('change', () => setImage(pictureOpen, 'tags', tagList($('pic-words').value).join(', '), ownWords(pictureOpen).join(', ')));
  const creditInput = () => {
    const current = state.images[pictureOpen.key] ?? state.images[pictureOpen.url] ?? {};
    state.images[pictureOpen.key] = { ...current, credit: { name: $('pic-credit').value.trim(), url: $('pic-credit-url').value.trim() } };
    persist();
  };
  $('pic-credit').addEventListener('input', creditInput);
  $('pic-credit-url').addEventListener('input', creditInput);
  $('pic-lead').addEventListener('click', () => {
    state.projects[project.id] = { ...state.projects[project.id], hero: pictureOpen.url };
    persist();
    $('pic-lead').textContent = '★ The lead picture';
    refreshFields();
  });
  $('pic-close').addEventListener('click', () => { $('picture-panel').hidden = true; });

  // ---------- the project's keywords ----------
  function setWords(list) {
    setProject('tags', list.join(', '), project.keywords.join(', '));
    renderWords();
  }
  function renderWords() {
    const words = projectTags();
    $('words').textContent = `Keywords ${words.length}`;
    $('word-chips').replaceChildren(...words.map((word) => {
      const remove = Object.assign(document.createElement('button'), { type: 'button', textContent: '×' });
      remove.setAttribute('aria-label', `Remove ${word}`);
      remove.addEventListener('click', () => { setWords(projectTags().filter((w) => !same(w, word))); $('word-input').focus(); });
      const chip = Object.assign(document.createElement('span'), { className: 'chip' });
      chip.append(word, remove);
      return chip;
    }));
  }
  $('words').addEventListener('click', () => { $('picture-panel').hidden = true; $('words-panel').hidden = !$('words-panel').hidden; if (!$('words-panel').hidden) $('word-input').focus(); });
  $('word-input').addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ',') && $('word-input').value.trim()) {
      event.preventDefault();
      const now = projectTags();
      setWords([...now, ...tagList($('word-input').value).filter((w) => !now.some((x) => same(x, w)))]);
      $('word-input').value = '';
    }
  });

  // ---------- send, and hide ----------
  $('send').addEventListener('click', async () => {
    if (!cloud || !user) { window.open(RUN_PAGE, '_blank', 'noopener'); show('Sign in on reddy.world to send from here; the workflow page sends by hand'); return; }
    clearTimeout(timer);
    await saveRemote();
    try {
      const response = await fetch('/api/desk-to-site', { method: 'POST', headers: { Authorization: `Bearer ${await cloud.idToken()}` } });
      if (response.status === 404) { window.open(RUN_PAGE, '_blank', 'noopener'); show('Send from the workflow page that just opened'); return; }
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { show(`Not sent (${result.error ?? response.status})`); return; }
      show('Sent: a pull request with a preview comes in about five minutes');
      window.open(DESK_PRS, '_blank', 'noopener');
    } catch (error) {
      show(`Not sent (${error.message})`);
    }
  });
  $('close').addEventListener('click', () => {
    if (editing) leave();
    host.remove();
    room.remove();
  });
  addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && (!$('picture-panel').hidden || !$('words-panel').hidden)) { $('picture-panel').hidden = true; $('words-panel').hidden = true; }
  });

  renderWords();
  if (!remoteSeen && !cloud) show('Changes stay in this browser');
}
