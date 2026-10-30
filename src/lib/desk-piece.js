import {CRAFTS, articleCraft, publicationDay, pieceTags} from './piece-fields.js';
import {PAGE_LAYOUTS,pageLayout,bannerVideo,bannerFocus} from './page-layout.js';
import {videoFigure,videoFor} from './article-video.js';
import '../styles/page-layout.css';
import '../styles/desk-ui.css';
const desk = window.imageDesk;
const $ = id => document.getElementById(id);
const fields = $('piece-fields');
for (const [id, label] of Object.entries(CRAFTS)) $('piece-craft').append(new Option(label, id));
// One set of fields moves with the active piece; the specialist boxes remain below it.
for (const selector of ['#project-bench .tabs', '#project-bench [data-box="summary"]', '#article-bench [data-box="title"]', '#article-bench [data-box="summary"]']) document.querySelector(selector).hidden = true;
document.querySelector('#project-bench [data-box="keywords"] .box-name').textContent = 'Tag ideas';
$('project-chips').hidden = true;
const make=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
const mediaTools=make('div');mediaTools.className='piece-media-actions';fields.querySelector('.piece-modes').after(mediaTools);mediaTools.append($('piece-upload'),$('piece-picture'),$('piece-selection'));
const uploadStatus=make('p');uploadStatus.id='piece-upload-status';uploadStatus.className='hint';uploadStatus.setAttribute('role','status');mediaTools.append(uploadStatus);
const layoutBox=fields.querySelector('.layout-choice');
const design=make('details');design.className='desk-design';
const designTitle=make('summary','Page design');design.append(designTitle,layoutBox);
$('piece-summary').closest('label').after(design);
const designHint=make('p','Choose the opening layout and cover image or video.');designHint.className='hint';design.prepend(designHint);design.prepend(designTitle);
// The selected image and its action stay together, only while editing images.
const selectionCard=make('div');selectionCard.className='desk-selected-image';mediaTools.append(selectionCard);selectionCard.append($('piece-selection'),$('piece-picture'));
const imageHelp=make('p','Select an image from the image strip to edit its description and credit.');imageHelp.className='hint';selectionCard.append(imageHelp);
const previewHelp=make('p','This is the wall card preview. Use View live page to open the published page.');previewHelp.className='hint';mediaTools.append(previewHelp);
$('piece-video').hidden=true;
$('piece-wall').hidden=true;
const bannerSettings=make('details');bannerSettings.className='field-source';bannerSettings.append(make('summary','Cover image or video'));
for(const id of ['piece-banner-kind','piece-banner-video','piece-banner-focus'])bannerSettings.append($(id).closest('label'));
layoutBox.append(bannerSettings);

function sourceHint(input,title) {const box=make('details');box.className='field-source';box.append(make('summary',title));const body=make('div');box.append(body);(input.closest('label') ?? input).after(box);return {box,body};}
const summarySource=sourceHint($('piece-summary'),'Original summary');
const titleSource=sourceHint($('piece-title'),'Original title');
const tagsSource=sourceHint($('piece-tags'),'WordPress tags and categories');
const ideaBox=document.querySelector('#project-bench [data-box="keywords"]');
$('piece-tags').closest('label').after(ideaBox);
const innerIdeas=ideaBox.querySelector('details');if(innerIdeas){const body=innerIdeas.querySelector('div');if(body)innerIdeas.replaceWith(...body.childNodes);}
$('piece-tags').addEventListener('focus',()=>{if(desk.piece().type==='project')ideaBox.open=true;});
$('piece-summary').addEventListener('focus',()=>{if(desk.piece().type==='project')summarySource.box.open=true;});
const textBox=document.querySelector('#project-bench [data-box="text"]');
$('page-source-content').append(textBox.querySelector('.box-body'));
textBox.hidden=true;
document.querySelector('#project-bench [data-box="wordpress"]').hidden=true;
const pictureSource=sourceHint($('description'),'Original image description');
document.querySelector('#pane-picture [data-box="wordpress"]').hidden=true;
const explanations={story:'Title, then text and images.',cover:'A wide image or video, with the title over it on desktop.',split:'Image or video beside the title on desktop. Stacked on phones.'};
for(const [value,label] of Object.entries(PAGE_LAYOUTS)) {
 const button=make('button');button.type='button';button.dataset.layout=value;button.setAttribute('aria-pressed','false');
 const sketch=make('span');sketch.className='layout-sketch sketch-'+value;sketch.setAttribute('aria-hidden','true');sketch.append(make('i'),make('b'),make('em'));
 button.append(sketch,make('span',label));button.addEventListener('click',()=>desk.setPiece('pageLayout',value));$('piece-layouts').append(button);
}
$('piece-upload').addEventListener('click',()=>desk.uploadPictures());
$('piece-banner-kind').addEventListener('change',()=>{const video=$('piece-banner-kind').value==='video';$('piece-banner-video-label').hidden=!video;if(!video)desk.setPiece('bannerVideo','');else $('piece-banner-video').focus();});
$('piece-banner-video').addEventListener('change',()=>{const key=bannerVideo($('piece-banner-video').value);if(!key && $('piece-banner-video').value){$('piece-fields-note').textContent='Use a YouTube or Vimeo link.';return;}desk.setPiece('bannerVideo',key);});
$('piece-banner-focus').addEventListener('change',()=>desk.setPiece('bannerFocus',bannerFocus($('piece-banner-focus').value)));
let bannerShown='';
let context = '';
let articleMode='page';
function render() {
  const piece = desk.piece();
  const panel = $(piece.type === 'article' ? 'article-bench' : 'project-bench');
  if (fields.parentNode !== panel) panel.querySelector('.head').after(fields);
  fields.hidden = false;
  const key = `${piece.type}:${piece.id}`;
  if (context !== key) {
    $('piece-upload-status').textContent='';
    // Browsers must not keep the undo history of another piece in these shared fields.
    if (fields.contains(document.activeElement)) document.activeElement.blur();
    for (const input of fields.querySelectorAll('input,textarea')) {const parent = input.parentNode, next = input.nextSibling; input.remove(); parent.insertBefore(input, next);}
    context = key;articleMode='page';design.open=false;
  }
  for (const name of ['title', 'summary', 'tags', 'craft', 'published']) {
    const input = $(`piece-${name}`);
    if (input && document.activeElement !== input) input.value = piece[name] ?? '';
  }
  $('piece-craft').options[0].textContent = piece.type === 'article' ? `Automatic · ${CRAFTS[articleCraft(piece, desk.DATA.software)]}` : 'Automatic';
  const selected=piece.selectedPicture;
  const mode=piece.type==='project' ? piece.mode : articleMode;
  fields.querySelector('.piece-inputs').hidden=mode!=='page';
  fields.dataset.mode=mode;
  selectionCard.hidden=mode!=='picture' || piece.type==='article';
  previewHelp.hidden=mode!=='preview';
  $('piece-upload').hidden=mode!=='picture';
  $('page-add').hidden=mode!=='page';$('show-elsewhere').hidden=true;
  $('delete-article').hidden=mode!=='page';
  $('pic-input').closest('label').hidden=true;
  for(const button of fields.querySelectorAll('[data-piece-mode]'))button.setAttribute('aria-pressed',String(button.dataset.pieceMode===mode));
  if(piece.type==='article')for(const box of document.querySelectorAll('#article-bench .box-list>[data-box]')){
    const name=box.dataset.box;box.hidden=mode==='preview' || (mode==='picture' ? name!=='pictures' : ['pictures','title','summary'].includes(name));
  }
  $('pane-picture').dataset.imageEditor='true';
  $('piece-selection').hidden=piece.type==='article';
  $('piece-picture').hidden=piece.type==='article';
  $('piece-picture').textContent='Add this image to page';
  $('piece-selection').replaceChildren();
  if(selected && piece.type==='project') {
    const thumb=make('img');thumb.src=selected.src;thumb.alt='';
    const name=selected.wordpress?.file || 'Picture '+selected.index;
    const caption=make('span','Selected image '+selected.index+' of '+piece.images.length);const filename=make('small',name);filename.title=name;caption.append(filename);$('piece-selection').append(thumb,caption);
    $('piece-picture').setAttribute('aria-label','Add '+name+' to page');
  }
  const layout=pageLayout(piece.pageLayout);
  for(const button of $('piece-layouts').children)button.setAttribute('aria-pressed',String(button.dataset.layout===layout));
  $('layout-description').textContent=explanations[layout];
  designTitle.textContent='Page design · '+PAGE_LAYOUTS[layout];
  const video=bannerVideo(piece.bannerVideo);const native=videoFor(video)?.file;
  let fileNote=$('banner-file-note');if(!fileNote){fileNote=make('p');fileNote.id='banner-file-note';fileNote.className='hint';bannerSettings.append(fileNote);}fileNote.hidden=!native;fileNote.textContent=native?'Uploaded video selected. Add video can replace it.':'';
  if(document.activeElement!==$('piece-banner-video'))$('piece-banner-video').value=videoFor(video)?.href ?? '';
  if(document.activeElement!==$('piece-banner-video') && document.activeElement!==$('piece-banner-kind')){$('piece-banner-kind').value=video?'video':'image';$('piece-banner-video-label').hidden=!video||native;}
  $('piece-banner-focus').value=bannerFocus(piece.bannerFocus);
  $('reading').dataset.pageLayout=layout;
  $('reading').style.setProperty('--banner-focus',bannerFocus(piece.bannerFocus));
  const bannerKey=piece.type+':'+piece.id+':'+video;
  if(video){const lead=$('read-lead');if(lead.dataset.banner!==bannerKey || !lead.querySelector('[data-player],video')){lead.innerHTML=videoFigure(video);lead.dataset.banner=bannerKey;}if(native){const player=lead.querySelector('video'),src=desk.videoSource?.(video);if(player&&src&&player.getAttribute('src')!==src)player.src=src;}lead.hidden=false;}
  else if(bannerShown && bannerShown!==bannerKey){delete $('read-lead').dataset.key;delete $('read-lead').dataset.banner;bannerShown=bannerKey;desk.render();return;}
  bannerShown=bannerKey;
  $('reading').dataset.hasBanner=String(!$('read-lead').hidden);
  const project=piece.type==='project' ? desk.DATA.projects.find(p=>p.id===piece.id) : null;
  for(const hint of [summarySource,titleSource,tagsSource])hint.box.hidden=!project;
  ideaBox.hidden=!project;
  $('page-source').hidden=!project;
  const choice=(body,text,field)=>{body.replaceChildren();if(!text){body.append(make('p','No original value.'));return;}body.append(make('p',text));const button=make('button',field==='title'?'Use original title':field==='summary'?'Use original summary':'Add these tags');button.type='button';button.addEventListener('click',()=>desk.setPiece(field,field==='tags'?pieceTags([...(desk.piece().tags ?? '').split(','),...text.split(',')]).join(', '):text));body.append(button);};
  if(project){choice(summarySource.body,project.wordpress.excerpt,'summary');choice(titleSource.body,project.title,'title');choice(tagsSource.body,[...project.wordpress.categories,...project.wordpress.tags].join(', '),'tags');}
  pictureSource.box.hidden=!selected || !(selected.wordpress?.caption || selected.wordpress?.alt);
  if(selected){const description=selected.wordpress?.caption || selected.wordpress?.alt || '';pictureSource.body.replaceChildren(make('p',description));if(description){const use=make('button','Use as description');use.type='button';use.onclick=()=>{$('description').value=description;$('description').dispatchEvent(new Event('input',{bubbles:true}));};pictureSource.body.append(use);}}

  $('piece-fields-note').textContent = '';
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
  articleMode=button.dataset.pieceMode;
  desk.pieceMode(button.dataset.pieceMode);render();
});
$('piece-wall').addEventListener('click', () => {$('open-wall').click(); $('wall-search').value = desk.piece().title ?? ''; $('wall-search').dispatchEvent(new Event('input'));});
$('piece-video').addEventListener('click', () => desk.openVideoForm());
$('piece-picture').addEventListener('click', () => {if (desk.piece().type === 'article') $('add-picture-here').click(); else desk.insertSelectedPicture();});
addEventListener('desk-render', render);
addEventListener('desk-saved', render);
render();
