import {wallKey, placedTiles} from './desk-wall.js';
const desk = window.imageDesk;
const $ = id => document.getElementById(id);
const root = $('wall-organiser');
const node = (tag, props = {}, ...children) => {const el = Object.assign(document.createElement(tag), props); el.append(...children); return el;};
let catalog = [];
let openedFrom = null;
const entries = () => ({...desk.DATA.wall, ...desk.state.wall});
function tiles() {
  const articles = desk.DATA.wallArticles ?? [];
  const drafts = Object.entries(desk.state.articles ?? {}).filter(([, a]) => a && !a.deleted);
  const published = articles.filter(a => !a.desk || !(a.desk in (desk.state.articles ?? {})))
    .map(a => ({key: a.desk ? wallKey('a', a.desk) : wallKey('p', a.id), title: a.title, kind: a.kind, year: a.year}));
  const ownArticles = drafts.map(([id, a]) => {
    const live = articles.find(item => item.desk === id);
    return {key: wallKey('a', id), title: a.title || 'Untitled article',
      kind: desk.DATA.kinds[a.kind ?? 'story']?.label ?? 'Article', year: a.published ? new Date(a.published).getUTCFullYear() : live?.year || new Date(a.readyAt ?? a.created ?? Date.now()).getFullYear(),
      draft: a.status !== 'ready', article: id};
  });
  return [...catalog, ...(desk.DATA.wallProjects ?? []).map(p => {const record = desk.state.projects[p.id] ?? {}; return {...p, title: record.title || p.title, year: record.published ? new Date(record.published).getUTCFullYear() : p.year, key: wallKey('p', p.slug), kind: 'Project'};}), ...published, ...ownArticles]
    .sort((a, b) => b.year - a.year || Number(b.kind === 'Software') - Number(a.kind === 'Software') || (b.time ?? 0) - (a.time ?? 0) || a.title.localeCompare(b.title));
}
function all() {return placedTiles(tiles(), entries());}
function write(key, change) {
  desk.state.wall ??= {};
  desk.state.wall[key] = {...entries()[key], ...change};
}
function save(message, focus) {
  desk.save();
  render();
  $('wall-status').textContent = message;
  if (focus) [...root.querySelectorAll('[data-focus]')].find(el => el.dataset.focus === focus)?.focus({preventScroll: true});
}
function move(tile, delta) {
  const group = all().filter(t => t.year === tile.year && t.row === tile.row && !t.span);
  const at = group.findIndex(t => t.key === tile.key);
  const next = at + delta;
  if (next < 0 || next >= group.length) return;
  [group[at], group[next]] = [group[next], group[at]];
  group.forEach((t, order) => write(t.key, {year: t.year, row: t.row, order}));
  save(`${tile.title} moved ${delta < 0 ? 'up' : 'down'}.`, `${tile.key}:${delta}`);
}
function field(tile, name, value, min, max) {
  const input = node('input', {type: 'number', value, min, max, step: 1, disabled: Boolean(tile.span)});
  input.setAttribute('aria-label', `${name} for ${tile.title}`);
  input.dataset.focus = `${tile.key}:${name}`;
  input.addEventListener('change', () => {
    const next = Number(input.value);
    if (!input.value || !Number.isInteger(next) || next < min || next > max) {input.value = value; return;}
    const target = all().filter(t => t.key !== tile.key && t.year === (name === 'Year' ? next : tile.year) && t.row === (name === 'Row' ? next : tile.row));
    write(tile.key, {[name.toLowerCase()]: next, order: Math.max(-1, ...target.map(t => t.order)) + 1});
    save(`${tile.title} moved to ${name.toLowerCase()} ${next}.`, `${tile.key}:${name}`);
  });
  return node('label', {}, name, input);
}
function render() {
  if (root.hidden) return;
  const list = all();
  const search = $('wall-search').value.trim().toLowerCase();
  const filter = $('wall-filter').value;
  const shown = list.filter(t => (!search || `${t.title} ${t.kind}`.toLowerCase().includes(search))
    && (filter === 'all' || (filter === 'hidden') === (t.hidden || Boolean(t.draft))));
  const on = list.filter(t => !t.hidden && !t.draft).length;
  $('wall-title').textContent = `Wall organiser · ${on} on, ${list.length - on} off`;
  let previousGroup = '';
  $('wall-tiles').replaceChildren(...shown.flatMap(tile => {
    const groupKey = `${tile.year}:${tile.row}:${Boolean(tile.span)}`;
    const heading = groupKey === previousGroup ? [] : [node('h3', {className: 'wall-group'}, `${tile.year} · ${tile.span ? 'Study & work timeline' : tile.row ? `Row ${tile.row}` : 'Automatic rows'}`)];
    previousGroup = groupKey;
    const row = node('article', {className: 'wall-tile'});
    row.dataset.hidden = String(tile.hidden || Boolean(tile.draft));
    row.append(node('div', {className: 'tile-name'}, node('strong', {}, tile.title),
      node('small', {}, `${tile.kind} · ${tile.draft ? 'Draft — publish from its editor first' : tile.hidden ? 'Off the wall' : 'On the wall'}${tile.span ? ' · Timeline dates stay with the CV' : ''}`)));
    row.append(field(tile, 'Year', tile.year, 1900, 2200), field(tile, 'Row', tile.row, 0, 99));
    const group = list.filter(t => t.year === tile.year && t.row === tile.row && !t.span);
    const at = group.findIndex(t => t.key === tile.key);
    const moves = node('div', {className: 'tile-moves'});
    for (const [delta, text] of [[-1, '↑'], [1, '↓']]) {
      const button = node('button', {type: 'button', disabled: Boolean(tile.span) || (delta < 0 ? at <= 0 : at >= group.length - 1)}, text);
      button.setAttribute('aria-label', `Move ${tile.title} ${delta < 0 ? 'up' : 'down'}`);
      button.dataset.focus = `${tile.key}:${delta}`;
      button.addEventListener('click', () => move(tile, delta)); moves.append(button);
    }
    const toggle = node('button', {type: 'button', disabled: Boolean(tile.draft)}, tile.hidden ? 'Show' : 'Hide');
    toggle.setAttribute('aria-label', `${tile.hidden ? 'Show' : 'Hide'} ${tile.title}`);
    toggle.dataset.focus = `${tile.key}:visibility`;
    toggle.addEventListener('click', () => {write(tile.key, {hidden: !tile.hidden}); save(`${tile.title} ${tile.hidden ? 'shown' : 'hidden'}.`, `${tile.key}:visibility`);});
    moves.append(toggle); row.append(moves);
    return [...heading, row];
  }), ...(shown.length ? [] : [node('p', {}, 'No tiles match these filters.')]));
}
function open() {
  openedFrom = document.activeElement;
  root.hidden = false;
  for (const el of document.querySelectorAll('body > header, body > main, #overview')) el.inert = true;
  document.body.style.overflow = 'hidden';
  render(); $('wall-title').focus();
}
function close() {root.hidden = true; for (const el of document.querySelectorAll('body > header, body > main, #overview')) el.inert = false; document.body.style.overflow = ''; openedFrom?.focus();}
$('open-wall').addEventListener('click', open);
$('close-wall').addEventListener('click', close);
$('wall-search').addEventListener('input', render);
$('wall-filter').addEventListener('change', render);
$('wall-send').addEventListener('click', () => {close(); $('send').click();});
addEventListener('keydown', event => {if (!root.hidden && event.key === 'Escape') {event.stopImmediatePropagation(); close();}}, true);
root.addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const controls = [...root.querySelectorAll('button:not(:disabled), input:not(:disabled), select, [tabindex="0"]')];
  const first = controls[0], last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last?.focus();}
  else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first?.focus();}
});
addEventListener('desk-render', render);
fetch('/wall-catalog.json').then(res => {if (!res.ok) throw new Error(); return res.json();})
  .then(items => {if (!Array.isArray(items)) throw new Error(); catalog = items; render();})
  .catch(() => {$('wall-catalog-status').textContent = 'Projects and articles are available. Software and CV tiles need the companion wall update before they can be arranged here.';});
