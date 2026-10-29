// Article and project text share Tiptap on #read-text. Project sessions keep the original source
// of unchanged blocks, so formatting or moving one paragraph does not rewrite its neighbours.
//
// The page's script is inline and can't import, so it drives this through window.deskEditor. Pictures and videos stay
// the page's own blocks (pictureBlock, videoBlock: ↑ ↓ ✕, dragged by ProseMirror), stored as they always were:
// <figure data-picture="id"></figure> and <figure data-video="youtube:…"></figure>.
import { Editor, Extension, Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import {DOMSerializer, Fragment} from '@tiptap/pm/model';
import {editorPieces} from './desk-text.js';
import {preserveBlocks} from './preserved-blocks.js';

// The notice the MIT licence asks to ship with the code. The build drops comments, so it travels as a string
// (window.deskEditor.licence).
const LICENCE = `Tiptap: Copyright (c) 2025, Tiptap GmbH. ProseMirror: Copyright (C) 2015-2017 by Marijn Haverbeke <marijn@haverbeke.berlin> and others.
Both under the MIT License:
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;

let editor = null;
let opts = null;
let placed = false; // the caret has been in the text since it opened, so ＋ Picture goes after its paragraph
let sourceSession = null;
const SourceIds = Extension.create({
  name:'sourceIds',
  addGlobalAttributes() {return [{types:['paragraph','heading','blockquote','bulletList','orderedList','horizontalRule','media','video','picture','keptSource'],attributes:{sourceId:{default:null,parseHTML:el=>el.getAttribute('data-desk-source'),renderHTML:attrs=>attrs.sourceId ? {'data-desk-source':attrs.sourceId} : {}}}}];},
});
const KeptSource = Node.create({name:'keptSource',group:'block',atom:true,
  parseHTML:()=>[{tag:'div[data-kept-source]'}],
  renderHTML:({HTMLAttributes})=>['div',{...HTMLAttributes,'data-kept-source':''}],
  addNodeView:()=>()=>{const dom=document.createElement('span');dom.hidden=true;dom.setAttribute('aria-hidden','true');return {dom};},
});
function sourceInput(original) {
  const pieces = editorPieces(original);
  sourceSession = {original,pieces,baseline:[]};
  return pieces.map(piece => {
    const template = document.createElement('template'); template.innerHTML = piece.html;
    if (!template.content.children.length) template.innerHTML = '<div data-kept-source=""></div>';
    let inline=[];
    const wrap=()=>{if(inline.length){const p=document.createElement('p');inline[0].before(p);p.append(...inline);inline=[];}};
    for (const node of [...template.content.childNodes]) {
      if(node.nodeType===3 || (node.nodeType===1 && !/^(P|H[2-4]|UL|OL|BLOCKQUOTE|HR|FIGURE|DIV)$/.test(node.nodeName))) inline.push(node);
      else wrap();
    }
    wrap();
    for (const node of template.content.children) node.setAttribute('data-desk-source',piece.id);
    return template.innerHTML;
  }).join('');
}
function sourceGroups() {
  const groups = [];
  editor.state.doc.forEach(node => {
    const id=node.attrs.sourceId;
    if (id && groups.at(-1)?.id===id) groups.at(-1).nodes.push(node);
    else groups.push({id,nodes:[node]});
  });
  return groups.map(group => {
    const json=group.nodes.map(node=>node.toJSON());
    const signature=JSON.stringify(json,(key,value)=>key==='sourceId'?undefined:value);
    const box=document.createElement('div'); box.append(DOMSerializer.fromSchema(editor.schema).serializeFragment(Fragment.fromArray(group.nodes)));
    return {id:group.id,signature,html:stored(box.innerHTML)};
  });
}
function captureSources() {
  if (!sourceSession) return;
  const originals=new Map(sourceSession.pieces.map(piece=>[piece.id,piece.source]));
  sourceSession.baseline=sourceGroups().map(group=>({...group,source:originals.get(group.id)??''}));
}

// a block the page shows: not an empty paragraph (or one of line breaks only), so every move is one the page shows
const shows = (node) => node.isAtom || node.type.name === 'horizontalRule' || node.textContent.trim() !== '';
const offsetOf = (doc, index) => { let at = 0; for (let i = 0; i < index; i++) at += doc.child(i).nodeSize; return at; };
function neighbour(doc, index, up) {
  for (let at = up ? index - 1 : index + 1; at >= 0 && at < doc.childCount; at += up ? -1 : 1) if (shows(doc.child(at))) return at;
  return -1;
}
// the top-level block at index moves past the shown block above or below it; a caret in it keeps its place
function move(index, up) {
  const { state, view } = editor;
  const other = neighbour(state.doc, index, up);
  if (other < 0) return false;
  const start = offsetOf(state.doc, index);
  const node = state.doc.child(index);
  const before = state.selection;
  const caret = before.from >= start && before.to <= start + node.nodeSize ? before.from - start : null;
  const at = up ? offsetOf(state.doc, other) : offsetOf(state.doc, other) + state.doc.child(other).nodeSize;
  const tr = state.tr.delete(start, start + node.nodeSize);
  const to = tr.mapping.map(at);
  tr.insert(to, node);
  if (caret !== null) tr.setSelection(node.isAtom ? NodeSelection.create(tr.doc, to) : TextSelection.create(tr.doc, to + caret));
  view.dispatch(tr.scrollIntoView());
  return to;
}
const indexAt = (pos) => editor.state.doc.resolve(pos).index(0);
const indexOfDom = (dom) => indexAt(editor.view.posAtDOM(dom, 0));

// a picture or a video: the page draws it, ↑ ↓ move it, ✕ takes it out of the text (it stays in the pictures list)
const figure = (name, key) => Node.create({
  name,
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return { [key]: { default: null, parseHTML: (el) => el.dataset[key] ?? null, renderHTML: (attrs) => ({ [`data-${key}`]: attrs[key] }) } };
  },
  parseHTML() { return [{ tag: `figure[data-${key}]` }]; },
  renderHTML({ HTMLAttributes }) { return ['figure', HTMLAttributes]; },
  addNodeView() {
    return ({ node, getPos }) => {
      const dom = opts.block(name, node.attrs[key]);
      dom.addEventListener('click', (event) => {
        const button = event.target.closest?.('.pic-tools button');
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        const index = indexAt(getPos());
        if (button.dataset.move === 'out') {
          const start = offsetOf(editor.state.doc, index);
          editor.view.dispatch(editor.state.tr.delete(start, start + editor.state.doc.child(index).nodeSize));
          return;
        }
        const to = move(index, button.dataset.move === 'up');
        // the same button again, on the block in its new place
        if (to !== false) editor.view.nodeDOM(to)?.querySelector(`.pic-tools [data-move="${button.dataset.move}"]`)?.focus();
      });
      return { dom, stopEvent: (event) => Boolean(event.target.closest?.('.pic-tools')), ignoreMutation: () => true };
    };
  },
});

// Alt+↑ / Alt+↓ move the paragraph the caret is in (#85), as they did before the bar
const MoveBlocks = Extension.create({
  name: 'moveBlocks',
  addKeyboardShortcuts() {
    const step = (up) => () => { const { selection } = this.editor.state; return move(indexAt(selection.from), up) !== false || true; };
    return { 'Alt-ArrowUp': step(true), 'Alt-ArrowDown': step(false) };
  },
});

// li and blockquote come back with one paragraph inside (<li><p>a</p></li>): stored as the page wrote them, <li>a</li>
function stored(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  for (const node of template.content.querySelectorAll('[data-kept-source]')) node.remove();
  for (const node of template.content.querySelectorAll('[data-desk-source]')) node.removeAttribute('data-desk-source');
  for (const wrap of template.content.querySelectorAll('li, blockquote')) {
    const kids = [...wrap.childNodes];
    if (kids.length === 1 && kids[0].nodeName === 'P') kids[0].replaceWith(...kids[0].childNodes);
  }
  return template.innerHTML;
}

function destroy() {
  if (!editor) return;
  const dom = editor.view.dom;
  editor.destroy();
  editor = null;
  placed = false;
  sourceSession = null;
  // the page's own editor takes the element back
  dom.classList.remove('ProseMirror', 'tiptap');
  dom.removeAttribute('translate');
  dom.contentEditable = 'true';
}

window.deskEditor = {
  licence: LICENCE,
  get on() { return Boolean(editor); },
  // a fresh editor (and so a fresh undo history) for every article opened
  mount(element, options) {
    destroy();
    opts = options;
    editor = new Editor({
      element: { mount: element },
      content: options.preserveSource ? sourceInput(options.content) : options.content,
      extensions: [
        StarterKit.configure({
          code: false, codeBlock: false, strike: false, underline: false, trailingNode: false,
          heading: { levels: [2, 3, 4] },
          dropcursor: { color: 'currentColor', width: 2 },
          link: {
            openOnClick: false, autolink: true, linkOnPaste: true, defaultProtocol: 'https',
            HTMLAttributes: { target: null, rel: null, class: null },
            isAllowedUri: (url) => options.safeHref(url),
          },
        }),
        figure('picture', 'picture'),
        figure('video', 'video'),
        figure('media', 'media'),
        KeptSource,
        SourceIds,
        MoveBlocks,
      ],
      editorProps: {
        // a picture from elsewhere (a file, a picture on another page) would show and never be uploaded
        handleDrop(view, event, slice, moved) {
          if (moved) return false;
          if (event.dataTransfer?.files?.length || /<img\b/i.test(event.dataTransfer?.getData('text/html') ?? '')) { options.refused(); return true; }
          return false;
        },
      },
      onUpdate: () => options.change(),
      onTransaction: () => options.selection(),
      onFocus: () => { placed = true; },
    });
    captureSources();
  },
  destroy,
  // the draft changed elsewhere (another device): its words, without an undo step
  set(html) { editor?.chain().setMeta('addToHistory', false).setContent(opts.preserveSource ? sourceInput(html) : html, { emitUpdate: false }).run(); captureSources(); },
  html: () => sourceSession ? preserveBlocks(sourceSession.original,sourceSession.baseline,sourceGroups()) : stored(editor.getHTML()),
  focused: () => Boolean(editor?.isFocused),
  // ↑ ↓ beside a paragraph (#block-tools), from the page
  moveBlock(dom, up) { editor.commands.focus(); return move(indexOfDom(dom), up) !== false; },
  // ＋ Picture, ＋ Video: after the block the caret was last in, else at the end
  insert(name, value) {
    const { state } = editor;
    const index = placed ? indexAt(state.selection.from) : state.doc.childCount - 1;
    const at = offsetOf(state.doc, index) + state.doc.child(index).nodeSize;
    editor.view.dispatch(state.tr.insert(at, state.schema.nodes[name].create({ [name]: value })));
  },
  // the bar
  insertLink(href) { editor.chain().focus().insertContent({type:'paragraph',content:[{type:'text',text:href,marks:[{type:'link',attrs:{href}}]}]}).run(); },
  replaceVideo(dom, key, linkOnly = false) {
    const index = indexOfDom(dom);
    const at = offsetOf(editor.state.doc, index);
    const before = editor.state.doc.child(index);
    const replacement = linkOnly ? editor.state.schema.nodes.paragraph.create(null,
      editor.state.schema.text(key, [editor.state.schema.marks.link.create({href:key})])) : editor.state.schema.nodes.video.create({video:key});
    editor.view.dispatch(editor.state.tr.replaceWith(at, at + before.nodeSize, replacement));
  },
  run(command, value) {
    const chain = editor.chain().focus();
    ({
      bold: () => chain.toggleBold(),
      italic: () => chain.toggleItalic(),
      h2: () => chain.toggleHeading({ level: 2 }),
      h3: () => chain.toggleHeading({ level: 3 }),
      bullet: () => chain.toggleBulletList(),
      ordered: () => chain.toggleOrderedList(),
      quote: () => chain.toggleBlockquote(),
      undo: () => chain.undo(),
      redo: () => chain.redo(),
      // with no words selected, the address itself goes in as the link's words
      link: () => (!value ? chain.extendMarkRange('link').unsetLink()
        : editor.state.selection.empty && !editor.isActive('link') ? chain.insertContent({ type: 'text', text: value, marks: [{ type: 'link', attrs: { href: value } }] })
        : chain.extendMarkRange('link').setLink({ href: value })),
    })[command]().run();
  },
  active(command) {
    if (!editor) return false;
    return {
      bold: () => editor.isActive('bold'),
      italic: () => editor.isActive('italic'),
      link: () => editor.isActive('link'),
      h2: () => editor.isActive('heading', { level: 2 }),
      h3: () => editor.isActive('heading', { level: 3 }),
      bullet: () => editor.isActive('bulletList'),
      ordered: () => editor.isActive('orderedList'),
      quote: () => editor.isActive('blockquote'),
    }[command]?.() ?? false;
  },
  can: (command) => Boolean(editor && (command === 'undo' ? editor.can().undo() : command === 'redo' ? editor.can().redo() : true)),
  link: () => editor?.getAttributes('link').href ?? '',
};
document.dispatchEvent(new Event('desk-editor-ready'));
