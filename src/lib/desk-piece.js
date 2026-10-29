import {CRAFTS, articleCraft, publicationDay, pieceTags} from './piece-fields.js';
const desk = window.imageDesk;
const $ = id => document.getElementById(id);
const fields = $('piece-fields');
for (const [id, label] of Object.entries(CRAFTS)) $('piece-craft').append(new Option(label, id));
// One set of fields moves with the active piece; the specialist boxes remain below it.
for (const selector of ['#project-bench .tabs', '#project-bench [data-box="summary"]', '#article-bench [data-box="title"]', '#article-bench [data-box="summary"]']) document.querySelector(selector).hidden = true;
document.querySelector('#project-bench [data-box="keywords"] .box-name').textContent = 'Tag ideas';
$('project-chips').hidden = true;
let context = '';
function render() {
  const piece = desk.piece();
  const panel = $(piece.type === 'article' ? 'article-bench' : 'project-bench');
  if (fields.parentNode !== panel) panel.querySelector('.head').after(fields);
  fields.hidden = false;
  const key = `${piece.type}:${piece.id}`;
  if (context !== key) {
    // Browsers must not keep the undo history of another piece in these shared fields.
    if (fields.contains(document.activeElement)) document.activeElement.blur();
    for (const input of fields.querySelectorAll('input,textarea')) {const parent = input.parentNode, next = input.nextSibling; input.remove(); parent.insertBefore(input, next);}
    context = key;
  }
  for (const name of ['title', 'summary', 'tags', 'craft', 'published']) {
    const input = $(`piece-${name}`);
    if (input && document.activeElement !== input) input.value = piece[name] ?? '';
  }
  $('piece-craft').options[0].textContent = piece.type === 'article' ? `Automatic · ${CRAFTS[articleCraft(piece, desk.DATA.software)]}` : 'Automatic · from its kind of work';
  $('piece-picture').textContent = piece.type === 'article' ? '＋ Add pictures' : 'Insert selected picture';
  $('piece-fields-note').textContent = piece.type === 'article' ? 'Pictures: add, choose a lead, set alt text and credits, or insert them in the text.' : 'Pictures opens the image library, lead selection, alt text, tags and credits. Insert selected picture places it in the page text.';
}
for (const name of ['title', 'summary', 'tags', 'craft', 'published']) {
  const input = $(`piece-${name}`);
  let editing = '';
  input.addEventListener('focus', () => {const p = desk.piece(); editing = `${p.type}:${p.id}`;});
  input.addEventListener(['title','summary','tags'].includes(name) ? 'input' : 'change', () => {
    const current = desk.piece();
    if (editing && editing !== `${current.type}:${current.id}`) return;
    let value = $(`piece-${name}`).value;
    if (name === 'published' && !publicationDay(value)) {$('piece-fields-note').textContent = 'Choose a valid publication date.'; input.value = current.published ?? ''; return;}
    if (name === 'title' && !value.trim()) {$('piece-fields-note').textContent = 'Give the piece a title.'; return;}
    if (name === 'tags') value = pieceTags(value).join(', ');
    desk.setPiece(name, value);
    render();
  });
}
for (const button of fields.querySelectorAll('[data-piece-mode]')) button.addEventListener('click', () => {
  for (const tab of fields.querySelectorAll('[data-piece-mode]')) tab.setAttribute('aria-pressed', String(tab === button));
  desk.pieceMode(button.dataset.pieceMode);
});
$('piece-wall').addEventListener('click', () => {$('open-wall').click(); $('wall-search').value = desk.piece().title ?? ''; $('wall-search').dispatchEvent(new Event('input'));});
$('piece-video').addEventListener('click', () => desk.openVideoForm());
$('piece-picture').addEventListener('click', () => {if (desk.piece().type === 'article') $('add-picture-here').click(); else desk.insertSelectedPicture();});
addEventListener('desk-render', render);
addEventListener('desk-saved', render);
render();
