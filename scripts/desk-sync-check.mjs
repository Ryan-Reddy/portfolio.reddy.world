// The image desk in a real browser: it works signed out as before, the overview shows where Ryan is,
// and (against the Firebase emulators) his work is saved to his account and reaches a second browser.
//
//   npm run build && node scripts/desk-sync-check.mjs
//       signed out only: serves dist/ under /portfolio/ and drives the desk
//   PUBLIC_DESK_EMULATORS=1 npm run build, then from a reddy.world checkout (its firestore.rules):
//   firebase emulators:exec --only auth,firestore --project getreddyworld "node <this repo>/scripts/desk-sync-check.mjs --signed-in"
//       also the account copy: sign in, save, a second browser sees it, another account is refused
//
// DESK_EXPORT=<file> loads that export (default: the sample fixture); BROWSER=<path> picks the browser
// (default: Edge on Windows, else Playwright's Chromium); SHOTS=<dir> keeps screenshots.
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { renderContent, segments } from '../src/lib/content.js';
import { deskText } from './import-image-keywords.mjs';

const root = resolve(new URL('../dist', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const signedIn = process.argv.includes('--signed-in');
const exportFile = process.env.DESK_EXPORT ?? new URL('./fixtures/image-desk-export.sample.json', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const executablePath = process.env.BROWSER ?? (existsSync(edge) ? edge : undefined);
const shots = process.env.SHOTS;
if (shots) await mkdir(shots, { recursive: true });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.xml': 'application/xml' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!path.startsWith('/portfolio/')) { res.writeHead(404); return res.end(); }
  let file = join(root, path.slice('/portfolio/'.length));
  try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); } catch {}
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file).toLowerCase()] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const DESK = `http://127.0.0.1:${server.address().port}/portfolio/image-metadata/`;

const browser = await chromium.launch({ executablePath, headless: true });
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` -> ${detail}` : ''}`); };

async function open(context, hash = '') {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text()); });
  page.on('dialog', (dialog) => dialog.dismiss());
  await page.goto(DESK + hash);
  await page.waitForFunction(() => window.deskSync && window.imageDesk);
  return { page, errors };
}
const progress = (page) => page.locator('#progress-label').textContent();
// the desk's boxes: folded to one line, or open; a click on the line opens one again
const box = (page, scope, name) => page.locator(`[data-boxes="${scope}"] > details.box[data-box="${name}"]`);
const openBox = async (page, scope, name) => { if (!(await box(page, scope, name).evaluate((b) => b.open))) await box(page, scope, name).locator(':scope > summary').click(); };
// every box of a list as Ryan sees it: its state, open or folded, how bright, the ✓ and its line
const boxes = async (page, scope) => {
  await page.mouse.move(1, 1);
  await page.waitForTimeout(250);
  return page.evaluate((s) => [...document.querySelectorAll(`[data-boxes="${s}"] > details.box`)].filter((b) => !b.hidden).map((b) => ({
    name: b.dataset.box, state: b.dataset.state, open: b.open, opacity: Number(getComputedStyle(b).opacity),
    tick: getComputedStyle(b.querySelector(':scope > summary .box-tick')).visibility, line: b.querySelector(':scope > summary .box-line').textContent,
  })), scope);
};
const show = (list) => list.map((b) => `${b.name}:${b.state}${b.open ? ':open' : ''}`).join(' ');
// only the first box still to do is open
const onlyNextOpen = (list) => { const open = list.filter((b) => b.open); const next = list.find((b) => b.state === 'todo'); return next ? open.length === 1 && open[0].name === next.name : open.length === 0; };
// a keyword typed into the project's keyword box, as Ryan does: open the box, type, then Enter
const addWord = async (page, word) => { await openBox(page, 'project', 'keywords'); await page.locator('#project-chips input').fill(word); await page.locator('#project-chips input').press('Enter'); };
const saved = (page) => page.locator('.top [data-desk-saved]').textContent();
const waitFor = (page, fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);
const shoot = (page, name) => shots && page.screenshot({ path: join(shots, `${name}.png`) });

try {
  // ---------- signed out: the desk as before ----------
  const contextOut = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const { page, errors } = await open(contextOut);
  // the desk opens on what the archive has: the projects with imported keywords count as done
  const archiveDone = await page.evaluate(() => window.imageDesk.DATA.projects.filter((project) => project.done).length);
  const projectCount = await page.evaluate(() => window.imageDesk.DATA.projects.length);
  check('signed out: starts with the archive\'s done projects', (await progress(page)) === `${archiveDone} of ${projectCount} projects done` && archiveDone > 0, await progress(page));
  check('an empty desk writes nothing', await page.evaluate(() => Object.keys(window.imageDesk.state.projects).length === 0 && Object.keys(window.imageDesk.state.images).length === 0));
  const seeded = await page.evaluate(() => window.imageDesk.DATA.projects.findIndex((project) => project.id === 'rmaekers/lightsurface-mk1-set'));
  await page.locator('#project-picker').selectOption(String(seeded));
  const chips = await page.locator('#project-chips .chip').allTextContents();
  const siteWords = await page.evaluate((i) => window.imageDesk.DATA.projects[i].keywords.length, seeded);
  check('a project shows the keywords the site has', chips.length > 0 && chips.length === siteWords, chips.join(' | '));
  // it opens on its page, in the article's editor: the site's title, not written on; the text with its picture blocks
  const onPage = await page.evaluate((i) => {
    const project = window.imageDesk.DATA.projects[i];
    const imgs = [...document.querySelectorAll('#read-text .media-block img')];
    return {
      kind: document.querySelector('#reading').dataset.kind, title: document.querySelector('#read-title').textContent === project.title,
      editable: document.querySelector('#read-title').getAttribute('contenteditable'), story: document.querySelectorAll('#story').length,
      blocks: document.querySelectorAll('#read-text .media-block').length, want: (project.content.match(/<figure data-media=/g) ?? []).length,
      keyed: imgs.length > 0 && imgs.every((img) => img.dataset.key),
    };
  }, seeded);
  check('a project opens on its page, in the article\'s editor', await page.locator('#reading').isVisible() && onPage.kind === 'project' && onPage.story === 0, JSON.stringify(onPage));
  check('its title is the site\'s, not written on', onPage.title && onPage.editable === 'false', JSON.stringify(onPage));
  check('its text has a block for every picture block, each picture by its key', onPage.want === 1 && onPage.blocks === onPage.want && onPage.keyed, JSON.stringify(onPage));
  check('a project\'s page has no ＋ Picture, ＋ Video or lead button', await page.locator('#add-picture-here').isHidden() && await page.locator('#add-video-here').isHidden() && await page.locator('#make-hero').isHidden());
  check('a text that places every picture has no Photographs below it', await page.locator('#read-rest').isHidden());
  check('opening a project changes nothing', await page.evaluate(() => Object.keys(window.imageDesk.state.projects).length === 0));
  // progressive disclosure: only the next box is open; a handled one is one dim line with a ✓
  let list = await boxes(page, 'project');
  check('a project opens only its next box', onlyNextOpen(list), show(list));
  const handled = list.filter((b) => b.state === 'done' && !b.open);
  check('a handled box is folded, dimmed, with a ✓ and a line of what it holds', handled.length > 0 && handled.every((b) => b.opacity < 0.7 && b.tick === 'visible' && b.line.trim()), JSON.stringify(handled));
  check('the keywords box says what it holds', list.find((b) => b.name === 'keywords').line === chips.map((chip) => chip.replace(/×$/, '')).join(', '), list.find((b) => b.name === 'keywords').line);
  await openBox(page, 'project', 'keywords');
  check('a click opens a folded box again, at full contrast', (({ open, opacity }) => open && opacity === 1)((await boxes(page, 'project')).find((b) => b.name === 'keywords')));
  // a box handled by Ryan folds once he moves on, and the next one to do opens
  const bare = await page.evaluate((other) => window.imageDesk.DATA.projects.findIndex((project, index) => !project.summary && index !== other), seeded);
  await page.locator('#project-picker').selectOption(String(bare));
  list = await boxes(page, 'project');
  check('a project without a summary opens on the summary', list.find((b) => b.open)?.name === 'summary', show(list));
  await page.locator('#summary').fill('Written on the desk');
  check('still open while typing in it', await box(page, 'project', 'summary').evaluate((b) => b.open));
  await page.locator('#project-title').click();
  list = await boxes(page, 'project');
  const summaryBox = list.find((b) => b.name === 'summary');
  check('moving on folds the handled box and dims it', !summaryBox.open && summaryBox.state === 'done' && summaryBox.opacity < 0.7 && summaryBox.line === 'Written on the desk', JSON.stringify(summaryBox));
  check('and only the next box to do is open', onlyNextOpen(list), show(list));
  await page.evaluate((i) => { delete window.imageDesk.state.projects[window.imageDesk.DATA.projects[i].id]; window.imageDesk.render(); }, bare);
  await page.locator('#project-picker').selectOption(String(seeded));
  await openBox(page, 'project', 'keywords');
  // a word left in the box lands on the project it was typed on, not on the next one (review finding)
  await page.locator('#project-chips input').fill('pendingword');
  await page.keyboard.press('Alt+ArrowRight');
  const after = await page.evaluate(() => { const s = window.imageDesk.state.projects; const ids = window.imageDesk.DATA.projects.map((p) => p.id); return { here: s['rmaekers/lightsurface-mk1-set']?.tags ?? '', next: s[ids[ids.indexOf('rmaekers/lightsurface-mk1-set') + 1]] ?? null }; });
  check('a pending keyword stays on its own project when moving on', /pendingword/.test(after.here) && after.next === null, JSON.stringify(after));
  await page.locator('#project-picker').selectOption(String(seeded));
  // removing the last chip with Backspace keeps the focus in the box
  await openBox(page, 'project', 'keywords');
  await page.locator('#project-chips input').click();
  await page.keyboard.press('Backspace');
  check('Backspace removes a chip and keeps the focus in the box', await page.evaluate(() => document.activeElement?.closest('#project-chips') !== null && !window.imageDesk.state.projects['rmaekers/lightsurface-mk1-set'].tags.includes('pendingword')));
  // removing every chip leaves none: the archive's words don't come back
  for (let i = 0; i < 6; i++) await page.keyboard.press('Backspace');
  check('removing every keyword leaves none', (await page.locator('#project-chips .chip').count()) === 0);
  await page.evaluate(() => { delete window.imageDesk.state.projects['rmaekers/lightsurface-mk1-set']; window.imageDesk.render(); });
  // written on the page: the summary and the text go to the project's record, the text as the archive stores it
  const recordOf = () => page.evaluate(() => window.imageDesk.state.projects['rmaekers/lightsurface-mk1-set'] ?? {});
  await page.locator('#read-sum').click();
  await page.keyboard.type('On the page.');
  let written = await recordOf();
  check('the summary written on the page is the project\'s summary', written.summary === 'On the page.' && (await page.locator('#summary').inputValue()) === 'On the page.'
    && await page.evaluate(() => !('null' in window.imageDesk.state.articles)), JSON.stringify(written));
  await page.locator('#read-text p').first().click();
  await page.keyboard.press('End');
  await page.keyboard.type(' (page)');
  written = await recordOf();
  const pageText = written.content ?? '';
  check('the text written on the page is stored as the archive stores it', /\(page\)/.test(pageText) && pageText.includes('\n\n')
    && (pageText.match(/<figure data-media="0"><\/figure>/g) ?? []).length === 1 && !/pic-block|contenteditable|data-picture|data-video/.test(pageText), pageText);
  // ✕ takes a picture row out of the text: the site shows it under Photographs, and so does the page. A line in its
  // place says so, with Put it back (review finding: the only way back undid every change to the text)
  await page.locator('#read-text .media-block button[data-move="out"]').click();
  written = await recordOf();
  const outLine = await page.evaluate(() => document.querySelector('#read-text .out-mark')?.textContent ?? '');
  check('✕ takes the pictures out of the text, to Photographs below, and says so in its place', !/data-media/.test(written.content) && (await page.locator('#read-rest img').count()) === 1
    && (await page.locator('#read-rest .rest-title').textContent()) === 'Photographs (1)' && /Photographs/.test(outLine) && /Put it back/.test(outLine), `${written.content} · ${outLine}`);
  // a picture dragged from Photographs into the text is refused: it would show there and never be saved (review finding)
  await page.locator('#read-rest img').first().dragTo(page.locator('#read-text p').first());
  const droppedIn = await page.evaluate(() => ({ loose: [...document.querySelectorAll('#read-text img')].filter((img) => !img.closest('.media-block')).length, note: document.querySelector('#page-note').textContent }));
  written = await recordOf();
  check('a picture dragged from Photographs into the text is refused, and the page says so', droppedIn.loose === 0 && !/data-media/.test(written.content)
    && /dropped/.test(droppedIn.note) && (await page.locator('#read-rest img').count()) === 1, JSON.stringify(droppedIn));
  const putBack = page.locator('#read-text .out-mark button');
  if (await putBack.count()) await putBack.click();
  written = await recordOf();
  check('Put it back puts the row back in its place, and the words written stay', (String(written.content).match(/<figure data-media="0"><\/figure>/g) ?? []).length === 1 && /\(page\)/.test(written.content)
    && await page.locator('#read-rest').isHidden() && (await page.locator('#read-text .out-mark').count()) === 0, written.content);
  await openBox(page, 'project', 'text');
  await page.locator('#story-reset').click();
  written = await recordOf();
  check('Undo my changes to the text brings the archive\'s text back', written.content === undefined && (await page.locator('#read-text .media-block').count()) === 1, JSON.stringify(written));
  await page.evaluate(() => { delete window.imageDesk.state.projects['rmaekers/lightsurface-mk1-set']; window.imageDesk.render(); });
  const indexOf = (id) => page.evaluate((i) => window.imageDesk.DATA.projects.findIndex((project) => project.id === i), id);
  const recordFor = (id) => page.evaluate((i) => window.imageDesk.state.projects[i] ?? null, id);
  // a click on a picture on the page opens it large on the Picture tab, the cursor on that picture; ← Its page goes back
  // to it. On a project of many pictures, one the desk is not on yet (review finding: with one picture it proved nothing)
  await page.locator('#project-picker').selectOption(String(await indexOf('rmaekers/merchandising')));
  const onText = page.locator('#reading img[data-key]').nth(4);
  const clickedKey = await onText.getAttribute('data-key');
  const keyBefore = await page.evaluate(() => window.imageDesk.flat[window.imageDesk.state.cursor].image.key);
  await onText.click();
  const counter = await page.locator('#image-counter').textContent();
  check('a click on a picture on the page opens it large, on the Picture tab', keyBefore !== clickedKey && (await page.locator('#tab-picture').getAttribute('aria-selected')) === 'true'
    && await page.locator('#picture-view').isVisible() && await page.locator('#filmstrip').isVisible() && await page.locator('#reading').isHidden()
    && (await page.evaluate(() => window.imageDesk.flat[window.imageDesk.state.cursor].image.key)) === clickedKey && !/^Picture 1 of/.test(counter), `${clickedKey} · ${counter}`);
  await page.locator('#back-to-page').click();
  const backInView = await page.evaluate((key) => {
    const reading = document.querySelector('#reading').getBoundingClientRect();
    const img = document.querySelector(`#reading img[data-key="${CSS.escape(key)}"]`).getBoundingClientRect();
    return img.top >= reading.top - 1 && img.bottom <= reading.bottom + 1;
  }, clickedKey);
  check('← Its page goes back to the page, that picture outlined and in view', await page.locator('#reading').isVisible() && (await page.locator('#tab-project').getAttribute('aria-selected')) === 'true'
    && (await page.locator(`#reading img[data-key="${clickedKey}"]`).first().getAttribute('data-current')) === 'true' && backInView);
  // another page opens at its top: another project, an article, and back (review finding)
  const scrollTo = (y) => page.evaluate((top) => { const reading = document.querySelector('#reading'); reading.scrollTop = top; return reading.scrollTop; }, y);
  const scrolls = { merchandising: await scrollTo(1500) };
  await page.locator('#project-picker').selectOption(String(await indexOf('rmaekers/giant-swings')));
  scrolls.giant = await page.evaluate(() => document.querySelector('#reading').scrollTop);
  scrolls.giantDown = await scrollTo(1500);
  await page.evaluate(() => { const s = window.imageDesk.state; s.articles['scroll-check'] = { title: 'A long draft', summary: '', content: '<p>A paragraph of the long draft.</p>'.repeat(120), status: 'draft', created: Date.now() }; window.imageDesk.openArticle('scroll-check'); });
  scrolls.article = await page.evaluate(() => document.querySelector('#reading').scrollTop);
  scrolls.articleDown = await scrollTo(1500);
  await page.locator('#back-to-projects').click();
  scrolls.back = await page.evaluate(() => document.querySelector('#reading').scrollTop);
  await page.evaluate(() => { delete window.imageDesk.state.articles['scroll-check']; window.imageDesk.render(); });
  check('another page opens at its top', scrolls.merchandising > 0 && scrolls.giantDown > 0 && scrolls.articleDown > 0 && scrolls.giant === 0 && scrolls.article === 0 && scrolls.back === 0, JSON.stringify(scrolls));
  // the paragraph tools stay with the page: after a picture and ← Its page none are left at its top corner (review finding)
  await page.locator('#project-picker').selectOption(String(await indexOf('rmaekers/giant-swings')));
  await page.locator('#read-text > p:not(:empty)').nth(2).click();
  const toolsBeside = await waitFor(page, () => !document.querySelector('#block-tools').hidden, undefined, 3000);
  await page.locator('#read-text img[data-key]').nth(3).click();
  await page.locator('#back-to-page').click();
  await page.waitForTimeout(150);
  check('after a picture and ← Its page, no paragraph tools are left at the top', toolsBeside && await page.locator('#block-tools').isHidden(),
    JSON.stringify(await page.evaluate(() => { const tools = document.querySelector('#block-tools'); return { hidden: tools.hidden, top: tools.style.top }; })));
  // a picture dropped on the summary is refused: it would show there and never be saved (review finding)
  await page.locator('#read-lead img').dragTo(page.locator('#read-sum'));
  await page.locator('#read-text .media-block img').first().dragTo(page.locator('#read-sum'));
  const onSummary = await page.evaluate(() => document.querySelectorAll('#read-sum img, #read-title img').length);
  check('a picture dropped on the summary is refused', onSummary === 0 && (await recordFor('rmaekers/giant-swings')) === null, String(onSummary));
  // ↑ ↓ move a row past what the page shows: the archive's texts keep empty paragraphs and lone line breaks between
  // their blocks, and a move past one of those changed nothing on the page (review finding)
  const shownOrder = () => page.evaluate(() => {
    const shows = (node) => !node.matches('br') && (node.textContent.trim() !== '' || node.matches('hr') || node.querySelector('img, hr') !== null);
    const kids = [...document.querySelector('#read-text').children];
    const at = kids.findIndex((node, i) => node.matches('.media-block') && i > 0 && !shows(kids[i - 1]) && kids.slice(0, i - 1).some(shows));
    return { at, shown: kids.slice(0, at).filter(shows).length, order: kids.filter(shows).map((node) => (node.dataset.media !== undefined ? `[${node.dataset.media}]` : node.textContent.trim().slice(0, 12))) };
  });
  const rowsBeforeUp = await shownOrder();
  if (rowsBeforeUp.at >= 0) await page.locator('#read-text > *').nth(rowsBeforeUp.at).locator('button[data-move="up"]').click();
  const rowsAfterUp = (await shownOrder()).order;
  const wantUp = [...rowsBeforeUp.order];
  wantUp.splice(rowsBeforeUp.shown - 1, 2, wantUp[rowsBeforeUp.shown], wantUp[rowsBeforeUp.shown - 1]);
  check('↑ moves a picture row past the block the page shows above it, not past an empty line', rowsBeforeUp.at >= 0 && JSON.stringify(rowsAfterUp) === JSON.stringify(wantUp),
    JSON.stringify({ before: rowsBeforeUp.order.slice(Math.max(0, rowsBeforeUp.shown - 2), rowsBeforeUp.shown + 2), after: rowsAfterUp.slice(Math.max(0, rowsBeforeUp.shown - 2), rowsBeforeUp.shown + 2) }));
  await page.evaluate(() => { delete window.imageDesk.state.projects['rmaekers/giant-swings']; window.imageDesk.render(); });
  // a click that moves nothing stores nothing, and neither does a page left as it was: the page's text is not the
  // archive's text letter for letter, so a save would rewrite the site's text (review finding)
  await page.locator('#project-picker').selectOption(String(seeded));
  await page.locator('#read-text .media-block button[data-move="down"]').click();
  const downOnLast = await recordFor('rmaekers/lightsurface-mk1-set');
  await page.locator('#read-text .media-block').dragTo(page.locator('#read-text .media-block'), { sourcePosition: { x: 30, y: 30 }, targetPosition: { x: 40, y: 36 } });
  const onItself = await recordFor('rmaekers/lightsurface-mk1-set');
  const untouched = await page.evaluate(() => {
    const desk = window.imageDesk;
    const stored = [];
    desk.DATA.projects.forEach((project, index) => {
      const cursor = desk.flat.findIndex((item) => item.projectIndex === index);
      if (cursor < 0 || desk.state.projects[project.id]) return;
      desk.state.cursor = cursor;
      desk.render();
      document.querySelector('#read-text').dispatchEvent(new Event('input'));
      if (desk.state.projects[project.id]?.content !== undefined) stored.push(project.id);
      delete desk.state.projects[project.id];
    });
    desk.render();
    return stored;
  });
  check('a click that moves nothing, or a page left as it was, stores no text', downOnLast === null && onItself === null && untouched.length === 0,
    JSON.stringify({ downOnLast, onItself, untouched: untouched.length, some: untouched.slice(0, 3) }));
  // the boxes beside the page share one undo history too: what was typed in a project's summary box doesn't come
  // back into the next project's with Ctrl+Z (review finding)
  await page.locator('#project-picker').selectOption(String(seeded));
  await openBox(page, 'project', 'summary');
  await page.locator('#summary').click();
  await page.keyboard.type('Boxed words');
  // picked as a click picks it: the focus goes to the picker (selectOption alone leaves it in the box)
  await page.locator('#project-picker').focus();
  await page.locator('#project-picker').selectOption(String(await indexOf('rmaekers/giant-swings')));
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  const boxUndo = { box: await page.locator('#summary').inputValue(), next: await recordFor('rmaekers/giant-swings') };
  check('Ctrl+Z on the next project brings nothing of the last one\'s summary box into it', !/Boxed/.test(boxUndo.box) && !JSON.stringify(boxUndo.next).includes('Boxed'), JSON.stringify(boxUndo));
  await page.evaluate(() => { const s = window.imageDesk.state.projects; delete s['rmaekers/lightsurface-mk1-set']; delete s['rmaekers/giant-swings']; window.imageDesk.render(); });
  // a text of several picture rows with one taken out: Photographs starts below the whole text, not over its pictures (review finding)
  await page.locator('#project-picker').selectOption(String(await indexOf('rrproductions/making-of-a-kaleidoscope')));
  const kaleidoRows = await page.locator('#read-text .media-block').count();
  const firstOut = page.locator('#read-text .media-block button[data-move="out"]').first();
  await firstOut.scrollIntoViewIfNeeded();
  const outBox = await firstOut.boundingBox();
  const pointer = [outBox.x + outBox.width / 2, outBox.y + outBox.height / 2];
  await page.mouse.click(...pointer);
  const layout = await page.evaluate(() => {
    const text = document.querySelector('#read-text').getBoundingClientRect();
    const rest = document.querySelector('#read-rest');
    return { rest: !rest.hidden, box: Math.round(text.height), content: document.querySelector('#read-text').scrollHeight, gap: Math.round(rest.getBoundingClientRect().top - text.bottom) };
  });
  check('with a picture row taken out, Photographs sits below the whole text', layout.rest && layout.box >= layout.content - 1 && layout.gap >= 0, JSON.stringify(layout));
  // the line in its place is under the pointer, not the next row's ✕: a second click there puts the row back rather
  // than taking out the next one (review finding)
  const underPointer = await page.evaluate(([x, y]) => { const at = document.elementFromPoint(x, y); return { mark: Boolean(at?.closest('#read-text .out-mark')), next: Boolean(at?.closest('.pic-tools')) }; }, pointer);
  await page.mouse.click(...pointer);
  const twice = { rows: await page.locator('#read-text .media-block').count(), record: await recordFor('rrproductions/making-of-a-kaleidoscope') };
  check('✕ twice at one spot: the row comes back, no other goes, and nothing is stored', underPointer.mark && !underPointer.next && twice.rows === kaleidoRows && twice.record?.content === undefined,
    JSON.stringify({ underPointer, rows: kaleidoRows, now: twice.rows, stored: twice.record?.content !== undefined }));
  await page.evaluate(() => { delete window.imageDesk.state.projects['rrproductions/making-of-a-kaleidoscope']; window.imageDesk.render(); });
  // a text of pictures only, every row taken out: Send to site skips an empty text, so nothing is stored and the page
  // shows the site's text again, and says so (review finding)
  const picturesOnly = await page.evaluate(() => window.imageDesk.DATA.projects.findIndex((project) => !project.compCard && /data-media/.test(project.content)
    && !project.content.replace(/<figure data-media="[^"]*"><\/figure>/g, '').replace(/<[^>]+>|&nbsp;|\s/g, '')));
  const picturesOnlyId = await page.evaluate((i) => window.imageDesk.DATA.projects[i]?.id, picturesOnly);
  await page.locator('#project-picker').selectOption(String(picturesOnly));
  const rowsIn = await page.locator('#read-text .media-block').count();
  for (let i = 0; i < rowsIn; i++) await page.locator('#read-text .media-block button[data-move="out"]').first().click();
  const emptied = { id: picturesOnlyId, rows: rowsIn, record: await recordFor(picturesOnlyId), blocks: await page.locator('#read-text .media-block').count(), note: await page.locator('#page-note').textContent() };
  check('every picture row taken out: the empty text is not stored, the page shows the site\'s text again and says why', picturesOnly >= 0 && rowsIn > 0
    && emptied.record?.content === undefined && emptied.blocks === rowsIn && emptied.note.trim() !== '' && !/Photographs/.test(emptied.note), JSON.stringify(emptied));
  await page.evaluate((id) => { delete window.imageDesk.state.projects[id]; window.imageDesk.render(); }, picturesOnlyId);
  // the text cleared from the keyboard (Ctrl+A, Backspace) leaves <p><br></p>: no words and no pictures, as empty as
  // nothing, so it is not stored either and the page says the same (review finding: Send to site would publish it)
  await page.locator('#project-picker').selectOption(String(await indexOf('rmaekers/giant-swings')));
  await page.locator('#read-text p').first().click();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Backspace');
  const keyCleared = { record: await recordFor('rmaekers/giant-swings'), note: await page.locator('#page-note').textContent(), blocks: await page.locator('#read-text .media-block').count() };
  check('the text cleared from the keyboard is not stored either: the page shows the site\'s text again and says why', keyCleared.record?.content === undefined
    && keyCleared.note === emptied.note && keyCleared.blocks > 0, JSON.stringify({ ...keyCleared, record: keyCleared.record?.content?.slice(0, 60) }));
  await page.evaluate(() => { delete window.imageDesk.state.projects['rmaekers/giant-swings']; window.imageDesk.render(); });
  // Ryan's site never changes because he edited a few words on the desk (review finding). The desk reads a text in the
  // pieces the site draws, and on every project a word added at the end of each paragraph, stored, written as Send to
  // site writes it (deskText) and drawn as the site draws it (renderContent), gives the archive's text drawn the same
  // way but for that paragraph, which keeps its words, links, pictures and players. On each project the word is typed
  // too, and taken out again with Backspace, which stores nothing.
  const WORD = ' Zqxw';
  const drawn = (text, title) => renderContent(text, { title, figure: (ids) => `<div class="FIG" data-ids="${ids.join(',')}"></div>` });
  const everyProject = await page.evaluate(() => window.imageDesk.DATA.projects.map((project) => ({ id: project.id, title: project.title, content: project.content, pieces: window.imageDesk.pieces(project.content) })));
  const readApart = everyProject.filter((project) => JSON.stringify(project.pieces) !== JSON.stringify(segments(project.content))).map((project) => project.id);
  check('the desk reads every project\'s text in the pieces the site draws', readApart.length === 0, readApart.slice(0, 5).join(' '));
  // the last words of a block of the page, outside its picture blocks: where a word typed at its end goes. A line that
  // is only a video's address is a player on the site; a word added to it makes it words with a player, as it should.
  const lastWords = () => {
    const text = document.querySelector('#read-text');
    return [...text.children].filter((block) => !/^https?:\/\/\S*(youtu\.?be|vimeo)\S*$/i.test(block.textContent.trim())).map((block) => {
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, { acceptNode: (node) => (node.data.trim() && !node.parentElement.closest('.pic-block') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP) });
      let last = null;
      for (let node = walker.nextNode(); node; node = walker.nextNode()) last = node;
      return last && { block, last, at: last.data.trimEnd().length };
    }).filter(Boolean);
  };
  await page.evaluate(`window.deskLastWords = ${lastWords}`);
  const round = { edits: 0, exact: 0, ownParagraph: 0, layout: 0, typed: 0 };
  const wrongEdits = [];
  const typedLeft = [];
  for (const [index, project] of everyProject.entries()) {
    // each paragraph in turn, the word put in and taken out again as typing does
    const edits = await page.evaluate(({ index, WORD }) => {
      const desk = window.imageDesk;
      const id = desk.DATA.projects[index].id;
      const cursor = desk.flat.findIndex((item) => item.projectIndex === index);
      if (cursor < 0) return null;
      desk.__kept = desk.state.projects[id];
      desk.state.cursor = cursor;
      desk.render();
      const text = document.querySelector('#read-text');
      const input = () => text.dispatchEvent(new InputEvent('input', { bubbles: true }));
      return window.deskLastWords().map(({ block, last, at }) => {
        const piece = desk.pieceSource(block) ?? '';
        last.insertData(at, WORD);
        input();
        const saved = desk.state.projects[id]?.content ?? null;
        last.deleteData(at, WORD.length);
        input();
        return { saved, piece, left: desk.state.projects[id]?.content ?? null, words: block.textContent.trim().slice(0, 40), marked: block.hasAttribute('data-layout') };
      });
    }, { index, WORD });
    if (edits === null) { wrongEdits.push({ id: project.id, why: 'not on the desk' }); continue; }
    // and the first paragraph typed in for real: the caret at its end, the word typed, then Backspace
    const typedPiece = await page.evaluate(() => {
      const first = window.deskLastWords()[0];
      if (!first) return null;
      document.querySelector('#read-text').focus();
      const range = document.createRange();
      range.setStart(first.last, first.at);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
      return { piece: window.imageDesk.pieceSource(first.block) ?? '', words: first.block.textContent.trim().slice(0, 40), marked: first.block.hasAttribute('data-layout') };
    });
    if (typedPiece) {
      await page.keyboard.type(WORD);
      const saved = (await recordFor(project.id))?.content ?? null;
      for (let i = 0; i < WORD.length; i++) await page.keyboard.press('Backspace');
      const left = (await recordFor(project.id))?.content;
      if (left !== undefined) typedLeft.push(project.id);
      edits.push({ saved, piece: typedPiece.piece, left: null, words: typedPiece.words, marked: typedPiece.marked, typed: true });
      round.typed++;
    }
    await page.evaluate((id) => { const desk = window.imageDesk; if (desk.__kept === undefined) delete desk.state.projects[id]; else desk.state.projects[id] = desk.__kept; delete desk.__kept; }, project.id);
    const before = drawn(project.content, project.title);
    const apart = [];
    for (const edit of edits) {
      round.edits++;
      const sent = edit.saved === null ? null : deskText(edit.saved, project.content);
      const after = sent === null ? '' : drawn(sent, project.title);
      if (edit.left !== null) wrongEdits.push({ id: project.id, words: edit.words, why: 'the word taken out again still stores a text' });
      if (sent === null || !after.includes(WORD)) { wrongEdits.push({ id: project.id, words: edit.words, typed: edit.typed, why: edit.saved === null ? 'nothing stored' : 'the word is not on the page' }); continue; }
      if (after.replace(WORD, '') === before) { round.exact++; continue; }
      apart.push({ before, after: after.replace(WORD, ''), piece: edit.piece, words: edit.words, marked: edit.marked, typed: edit.typed });
    }
    if (!apart.length) continue;
    // what changed: the top-level nodes between the ones that read the same from the start and from the end, which
    // must lie in the paragraph edited and hold the same words, links, pictures and players
    const verdicts = await page.evaluate((list) => list.map(({ before, after, piece, marked }) => {
      const nodes = (html) => { const t = document.createElement('template'); t.innerHTML = html; return [...t.content.childNodes].filter((n) => n.nodeType === 1 || n.textContent.trim()); };
      const a = nodes(before);
      const b = nodes(after);
      let s = 0;
      while (s < a.length && s < b.length && a[s].isEqualNode(b[s])) s++;
      let e = 0;
      while (e < a.length - s && e < b.length - s && a[a.length - 1 - e].isEqualNode(b[b.length - 1 - e])) e++;
      const box = (list) => { const div = document.createElement('div'); div.append(...list.map((n) => n.cloneNode(true))); return div; };
      const href = (value) => { try { return /^https?:/i.test(value) ? new URL(value).href : value; } catch { return value; } };
      // the words in order; a line break is no space in textContent, so spaces are left out
      const words = (div) => { const copy = div.cloneNode(true); for (const player of copy.querySelectorAll('figure.video-embed')) player.remove(); return copy.textContent.replace(/\s+/g, ''); };
      const holds = (div) => ({
        words: words(div),
        pictures: [...div.querySelectorAll('.FIG')].map((f) => f.dataset.ids),
        players: [...div.querySelectorAll('iframe')].map((f) => f.getAttribute('src')),
        links: [...div.querySelectorAll('a[href]')].filter((link) => !link.closest('figure.video-embed')).map((link) => href(link.getAttribute('href'))),
      });
      const was = holds(box(a.slice(s, a.length - e)));
      const now = holds(box(b.slice(s, b.length - e)));
      const own = document.createElement('template');
      own.innerHTML = piece;
      const inPiece = own.content.textContent.replace(/\s+/g, '').includes(was.words) && was.pictures.every((ids) => piece.includes(`data-media="${ids}"`));
      // the old site's own layout (its <div>s, a caption list) gone from it: only on a block the page marks as such
      const layouts = (list) => [...box(list).querySelectorAll('div:not(.FIG), dl, dt, dd, section, article, header, footer, address, pre, table, figcaption')].filter((n) => !n.closest('figure.video-embed')).length;
      const layout = layouts(a.slice(s, a.length - e)) > layouts(b.slice(s, b.length - e));
      return { ok: JSON.stringify(was) === JSON.stringify(now) && inPiece && (!layout || marked), layout, was, now, inPiece, marked };
    }), apart);
    verdicts.forEach((verdict, i) => {
      if (verdict.ok) { round.ownParagraph++; if (verdict.layout) round.layout++; }
      else wrongEdits.push({ id: project.id, words: apart[i].words, typed: apart[i].typed, was: verdict.was, now: verdict.now, inPiece: verdict.inPiece });
    });
  }
  await page.evaluate(() => window.imageDesk.render());
  check('a word added to any paragraph, on every project: the site draws the rest of the page as before, and that paragraph keeps its words, links, pictures and players',
    wrongEdits.length === 0 && round.edits > everyProject.length,
    `${round.edits} edits on ${everyProject.length} projects (${round.typed} typed): ${round.exact} the same but for the word, ${round.ownParagraph} with only the markup of their own paragraph changed (${round.layout} of them a block marked as the old site's layout)${wrongEdits.length ? `; ${wrongEdits.length} wrong, as ${JSON.stringify(wrongEdits.slice(0, Number(process.env.SHOW_WRONG ?? 3)))}` : ''}`);
  check('the word typed at the end of a paragraph and taken out again with Backspace stores nothing, on every project', round.typed > 0 && typedLeft.length === 0, typedLeft.slice(0, 5).join(' '));
  // a block in the old site's own layout is marked on the page, which says what a change there does, before any is made;
  // a page without one says nothing of it
  await page.locator('#project-picker').selectOption(String(await indexOf('rrproductions/sander-kleinenberg-felix-leiter-the-one-official-music-video')));
  const layoutPage = { marked: await page.locator('#read-text [data-layout]').count(), note: await page.locator('#layout-note').isVisible() };
  await page.locator('#project-picker').selectOption(String(seeded));
  const plainPage = { marked: await page.locator('#read-text [data-layout]').count(), note: await page.locator('#layout-note').isVisible() };
  const markedProjects = await page.evaluate(() => {
    const desk = window.imageDesk;
    const ids = desk.DATA.projects.filter((project, index) => { desk.state.cursor = desk.flat.findIndex((item) => item.projectIndex === index); desk.render(); return document.querySelector('#read-text [data-layout]'); }).map((project) => project.id);
    desk.render();
    return ids;
  });
  await page.locator('#project-picker').selectOption(String(seeded));
  check('a block in the old site\'s own layout is marked, and the page says what a change there does; a page without one says nothing', layoutPage.marked > 0 && layoutPage.note && plainPage.marked === 0 && !plainPage.note,
    JSON.stringify({ layoutPage, plainPage, markedProjects }));
  // the modelling page is a comp card: the site shows no text there, so the note promises no Photographs
  await page.locator('#project-picker').selectOption(String(await indexOf('vaguelyvulgar/photo-cv')));
  await page.locator('#read-text .media-block button[data-move="out"]').first().click();
  const compNote = await page.locator('#page-note').textContent();
  check('on the comp card the note promises no Photographs: the site shows no text there', compNote.trim() !== '' && !/Photographs/.test(compNote), compNote);
  await page.evaluate(() => { delete window.imageDesk.state.projects['vaguelyvulgar/photo-cv']; window.imageDesk.render(); });
  // moving on with the caret on the page (review findings): the next project's page shows its own words, its text has
  // no ↑ ↓ of the old one, and a key typed next lands nowhere
  const nextId = await page.evaluate(() => { const ids = window.imageDesk.DATA.projects.map((p) => p.id); return ids[ids.indexOf('rmaekers/lightsurface-mk1-set') + 1]; });
  const nextSummary = await page.evaluate((id) => window.imageDesk.DATA.projects.find((p) => p.id === id).summary, nextId);
  const onPageNow = () => page.evaluate(() => ({ on: window.imageDesk.flat[window.imageDesk.state.cursor].project.id, sum: document.querySelector('#read-sum').textContent,
    tools: !document.querySelector('#block-tools').hidden, inPage: document.querySelector('#reading').contains(document.activeElement) }));
  await page.locator('#project-picker').selectOption(String(seeded));
  await page.locator('#read-text p').first().click();
  const toolsShown = await waitFor(page, () => !document.querySelector('#block-tools').hidden, undefined, 3000);
  await page.keyboard.press('Alt+ArrowRight');
  const fromText = await onPageNow();
  await page.keyboard.type('!');
  check('Alt+→ from the text: the next page has no ↑ ↓ of the old one, and no caret', toolsShown && fromText.on === nextId && !fromText.tools && !fromText.inPage
    && (await recordFor(nextId)) === null, JSON.stringify({ toolsShown, fromText, next: await recordFor(nextId) }));
  await page.locator('#project-picker').selectOption(String(seeded));
  await page.locator('#read-sum').click();
  await page.keyboard.type('Alpha summary');
  await page.keyboard.press('Alt+ArrowRight');
  const fromSummary = await onPageNow();
  await page.keyboard.type('!');
  check('Alt+→ from the summary: the next page shows its own summary, and the next key saves nothing to it', fromSummary.on === nextId && fromSummary.sum === nextSummary && !fromSummary.inPage
    && (await recordFor(nextId)) === null && (await recordFor('rmaekers/lightsurface-mk1-set'))?.summary === 'Alpha summary', JSON.stringify({ fromSummary, nextSummary, next: await recordFor(nextId) }));
  await page.evaluate((id) => { const s = window.imageDesk.state.projects; delete s['rmaekers/lightsurface-mk1-set']; delete s[id]; window.imageDesk.render(); }, nextId);
  await page.locator('#project-picker').selectOption(String(seeded));
  await page.locator('#read-sum').click();
  await page.keyboard.press('Control+Enter');
  const fromDone = await onPageNow();
  await page.keyboard.type('x');
  check('Ctrl+Enter in the summary marks it done and moves on, with no caret in the next text', fromDone.on === nextId && !fromDone.inPage
    && await page.evaluate(() => (window.imageDesk.state.projects['rmaekers/lightsurface-mk1-set']?.reviewed ?? window.imageDesk.DATA.projects.find((p) => p.id === 'rmaekers/lightsurface-mk1-set').done) === true)
    && (await recordFor(nextId)) === null, JSON.stringify({ fromDone, next: await recordFor(nextId) }));
  await page.evaluate((id) => { const s = window.imageDesk.state.projects; delete s['rmaekers/lightsurface-mk1-set']; delete s[id]; window.imageDesk.render(); }, nextId);
  await page.locator('#project-picker').selectOption(String(seeded));
  await page.locator('#tab-picture').click();
  list = await boxes(page, 'picture');
  check('a picture opens only its next box', onlyNextOpen(list), show(list));
  check('From WordPress is folded, quiet, without a ✓', (({ open, state, tick, opacity }) => !open && state === 'quiet' && tick === 'hidden' && opacity < 0.7)(list.find((b) => b.name === 'wordpress')), JSON.stringify(list.find((b) => b.name === 'wordpress')));
  await openBox(page, 'picture', 'wordpress');
  const wp = await page.locator('#wp-picture').innerText();
  check('a picture shows its WordPress file name', /\.(jpe?g|png|webp|gif)/i.test(wp), wp.replace(/\s+/g, ' ').slice(0, 120));
  check('a picture shows what it says today', (await page.locator('#description').inputValue()).length > 0, await page.locator('#description').inputValue());
  await page.locator('#tab-project').click();
  await openBox(page, 'project', 'summary');
  await page.locator('#summary').fill('A desk check summary');
  await page.locator('#tab-preview').click();
  check('the summary shows on the wall preview', (await page.locator('#preview-wall .lead-text .desc').textContent()) === 'A desk check summary');
  check('and under the title on the page preview', (await page.locator('#preview-page .sum').textContent()) === 'A desk check summary');
  await shoot(page, 'desk-preview');
  await page.locator('#tab-project').click();
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.imageDesk);
  check('signed out: says so plainly', await waitFor(page, () => document.querySelector('.top [data-desk-saved]').textContent === 'Not signed in: saved in this browser only'), await saved(page));
  // a lead picture chosen here, on a project the export has without one: Load export must not keep it
  const exported = JSON.parse(await readFile(exportFile, 'utf8'));
  const plain = Object.keys(exported.projects).find((id) => !exported.projects[id].hero);
  const plainIndex = await page.evaluate((id) => window.imageDesk.DATA.projects.findIndex((project) => project.id === id), plain);
  await page.locator('#project-picker').selectOption(String(plainIndex));
  await page.locator('#tab-picture').click();
  await page.locator('#make-hero').click();
  check('before loading: a lead picture chosen on the desk', await page.evaluate((id) => Boolean(window.imageDesk.state.projects[id]?.hero), plain), plain);
  await page.setInputFiles('#load-file', exportFile);
  await page.waitForFunction(() => /^Loaded \d+ projects/.test(document.querySelector('#note').textContent));
  check('Load export replaces the project: the stale lead picture is gone', await page.evaluate((id) => !window.imageDesk.state.projects[id]?.hero && window.imageDesk.state.projects[id]?.at > 0, plain), plain);
  const loaded = await progress(page);
  check('Load export: the progress follows the export', !/^0 of/.test(loaded), loaded);
  const total = Number(loaded.match(/of (\d+)/)[1]);
  const doneLoaded = Number(loaded.match(/^(\d+)/)[1]);
  await page.reload();
  await page.waitForFunction(() => window.imageDesk);
  check('reload: the browser kept it', (await progress(page)) === loaded, await progress(page));
  await addWord(page, 'desk check word');
  const stamped = await page.evaluate((key) => { const s = JSON.parse(localStorage.getItem(key)); return Object.values(s.projects).some((p) => String(p.tags).includes('desk check word') && p.at > 0) && Object.keys(s.days ?? {}).length > 0; }, 'reddy-world-image-metadata-v4');
  check('a change is stamped and the day counted', stamped);

  await page.locator('#open-overview').click();
  const overview = await page.locator('#overview').innerText();
  check('overview: total done', overview.includes(`${doneLoaded} of ${total} projects done`), overview.split('\n').slice(0, 6).join(' | '));
  check('overview: one next step', /Next up: .+/.test(overview), (overview.match(/Next up: .+/) ?? [''])[0]);
  check('overview: done, started, not started', /\d+ done · \d+ started · \d+ not started/.test(overview));
  check('overview: one row per portfolio', (await page.locator('.ov-portfolio').count()) >= 2, String(await page.locator('.ov-portfolio').count()));
  await shoot(page, 'overview');
  await page.locator('.ov-portfolio summary').first().click();
  check('overview: every project listed', (await page.locator('#ov-portfolios .ov-row').count()) === total, String(await page.locator('#ov-portfolios .ov-row').count()));
  await shoot(page, 'overview-open');
  const next = (await page.locator('#ov-next').textContent()).replace(/^Next up: | →$/g, '');
  await page.locator('#ov-next').click();
  check('Next up opens that project on the desk', (await page.locator('#project-title').textContent()) === next && await page.locator('#overview').isHidden(), next);
  await shoot(page, 'desk');
  await page.goto(DESK + '#overview');
  await page.waitForFunction(() => window.imageDesk);
  check('#overview opens the overview directly (the link from /private)', await page.locator('#overview').isVisible());
  // Send to site reads the desk in the account: signed out, it says to sign in first
  await page.locator('#ov-close').click();
  await page.locator('#send').click();
  check('Send to site, signed out: asks to sign in first', await waitFor(page, () => document.querySelector('#sent').open && document.querySelector('#sent-title').textContent === 'Sign in first'), await page.locator('#sent-title').textContent());
  await page.locator('#close-sent').click();
  check('signed out: no page errors', errors.length === 0, errors.join(' / '));
  await contextOut.close();

  // ---------- an article: a private draft until Ryan publishes it ----------
  const writer = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pen = await open(writer);
  await pen.page.locator('#new-article').click();
  check('＋ Article opens an empty draft', await pen.page.locator('#article-bench').isVisible() && await pen.page.locator('#project-bench').isHidden());
  check('an article\'s page has ＋ Picture, and no lead button or ← Its page', await pen.page.locator('#add-picture-here').isVisible()
    && await pen.page.locator('#make-hero').isHidden() && await pen.page.locator('#back-to-page').isHidden());
  let articleBoxes = await boxes(pen.page, 'article');
  check('a new article opens only its title', onlyNextOpen(articleBoxes) && articleBoxes.find((b) => b.open)?.name === 'title', show(articleBoxes));
  await pen.page.locator('#article-title').fill('Street interviews');
  await openBox(pen.page, 'article', 'summary');
  articleBoxes = await boxes(pen.page, 'article');
  check('the title, handled, folded when Ryan moved on', (({ open, state, line }) => !open && state === 'done' && line === 'Street interviews')(articleBoxes.find((b) => b.name === 'title')), show(articleBoxes));
  await pen.page.locator('#article-summary').fill('What people on the street told me.');
  await pen.page.locator('#read-text').click();
  await pen.page.keyboard.type('First paragraph of the draft.');
  check('the draft reads as its page on the left', (await pen.page.locator('#reading .reading-title').textContent()) === 'Street interviews'
    && (await pen.page.locator('#reading .reading-text').textContent()).includes('First paragraph'));
  check('the draft is in the project list, marked draft', (await pen.page.locator('#project-picker optgroup[label^="Your articles"] option').allTextContents()).includes('Street interviews · draft'));
  const stored = await pen.page.evaluate((key) => Object.values(JSON.parse(localStorage.getItem(key)).articles ?? {}), 'reddy-world-image-metadata-v4');
  // the desk may also hold drafts seeded from the repo (src/data/article-seeds/): this one is found by its title
  const mine = stored.filter((article) => article.title === 'Street interviews');
  check('the draft is saved and stamped', mine.length === 1 && mine[0].status === 'draft' && mine[0].at > 0, JSON.stringify(mine));
  articleBoxes = await boxes(pen.page, 'article');
  check('writing the text on the page folds the summary and the text box', ['summary', 'text'].every((name) => (({ open, state }) => !open && state === 'done')(articleBoxes.find((b) => b.name === name))), show(articleBoxes));
  // an interview needs its person before it can be published; a story with enough words can
  await openBox(pen.page, 'article', 'about');
  await pen.page.locator('#article-kind').selectOption('interview');
  check('an interview opens the person, the next thing to fill in', await box(pen.page, 'article', 'person').evaluate((b) => !b.hidden && b.open && b.dataset.state === 'todo'));
  check('an interview without its person cannot be published yet', await pen.page.locator('#publish-article').isDisabled() && /the person/.test(await pen.page.locator('#publish-hint').textContent()));
  await pen.page.locator('#article-kind').selectOption('story');
  await openBox(pen.page, 'article', 'publish');
  await pen.page.locator('#publish-article').click();
  const published = await pen.page.evaluate(() => window.imageDesk.state.articles[window.imageDesk.state.article]);
  check('Publish marks it ready, with its address fixed', published.status === 'ready' && published.slug === 'street-interviews' && published.readyAt > 0, JSON.stringify(published).slice(0, 160));
  check('the address it gets is shown', /reddy\.world\/portfolio\/stories\/street-interviews\//.test(await pen.page.locator('#article-address').textContent()));
  await pen.page.locator('#unpublish-article').click();
  check('Back to draft', await pen.page.evaluate(() => window.imageDesk.state.articles[window.imageDesk.state.article].status === 'draft'));
  // how the draft shows elsewhere: on the wall, as a shared link, in search
  await pen.page.locator('#show-elsewhere').click();
  check('the second view shows the wall tile, the link card and the search result', await pen.page.locator('#reading').isHidden()
    && (await pen.page.locator('#elsewhere .tile .t').textContent()) === 'Street interviews'
    && (await pen.page.locator('#elsewhere .tile .m').textContent()) === 'Story'
    && (await pen.page.locator('#elsewhere .linkcard strong').textContent()) === 'Street interviews · reddy.world');
  check('a story sits in the row Inventions & art', /Inventions & art/.test(await pen.page.locator('#elsewhere .preview .hint').first().textContent()));
  check('the search description is the summary, then the start of the text', (await pen.page.locator('#elsewhere .serp .d').textContent()) === 'What people on the street told me. First paragraph of the draft.',
    await pen.page.locator('#elsewhere .serp .d').textContent());
  await pen.page.locator('#article-kind').selectOption('interview');
  check('an interview sits in the row Study & other work', /Study & other work/.test(await pen.page.locator('#elsewhere .preview .hint').first().textContent()));
  await pen.page.locator('#article-kind').selectOption('story');
  await pen.page.locator('#show-elsewhere').click();
  check('and back to its page', await pen.page.locator('#reading').isVisible() && await pen.page.locator('#elsewhere').isHidden());
  // pictures: signed out they can't be added (they live in the account); one the account has shows in the list and the text
  await pen.page.setInputFiles('#pic-input', { name: 'street.png', mimeType: 'image/png', buffer: Buffer.from('89504e470d0a1a0a', 'hex') });
  check('signed out, a picture is not added, and the desk says why', await waitFor(pen.page, () => /sign in first/.test(document.querySelector('#pic-hint').textContent)), await pen.page.locator('#pic-hint').textContent());
  await pen.page.evaluate(() => {
    const s = window.imageDesk.state;
    const id = s.article;
    s.articles[id] = { ...s.articles[id], pictures: { pq1: { path: 'desk-uploads/aaaaaaaaaaaaaaaa-street.jpg', name: 'street.jpg', alt: '' } }, hero: 'pq1', content: '<p>First paragraph of the draft.</p><figure data-picture="pq1"></figure>' };
    window.imageDesk.render();
  });
  check('a picture shows in the list and as a block in the text', (await pen.page.locator('#pic-list .pic-row').count()) === 1 && (await pen.page.locator('#read-text .pic-block[data-picture="pq1"]').count()) === 1);
  check('publishing waits for what the picture shows', /what every picture shows/.test(await pen.page.locator('#publish-hint').textContent()));
  await openBox(pen.page, 'article', 'pictures');
  const row = pen.page.locator('#pic-list > details.box[data-box="pq1"]');
  check('a picture just added opens with its tools', await row.evaluate((b) => b.open && b.dataset.state === 'todo'));
  await row.locator('textarea').fill('A street corner in Utrecht');
  check('saying what it shows lets it publish', await pen.page.locator('#publish-article').isEnabled());
  // an article's picture gets a project picture's tools: keywords with the rated ideas, and its photographer
  await row.locator('.chips input').fill('street interview');
  await row.locator('.chips input').press('Enter');
  await row.locator('details.drawer > summary').click();
  const idea = row.locator('.ideas .idea button').first();
  const ideaWord = await idea.textContent();
  check('the picture has the rated ideas list', (await row.locator('.ideas .idea').count()) > 5 && (await row.locator('.subtabs button').count()) === 6, String(await row.locator('.ideas .idea').count()));
  await idea.click();
  await row.locator('[data-credit="name"]').fill('Jan Fotograaf');
  await row.locator('[data-credit="url"]').fill('https://example.com/jan');
  const pq1 = await pen.page.evaluate(() => window.imageDesk.state.articles[window.imageDesk.state.article].pictures.pq1);
  check('its keywords and photographer are saved with the picture', pq1.tags === `street interview, ${ideaWord}` && pq1.credit?.name === 'Jan Fotograaf' && pq1.credit?.url === 'https://example.com/jan', JSON.stringify(pq1));
  check('still open while working in it', await row.evaluate((b) => b.open));
  check('1280 px: the panel with a picture open fits its width', await pen.page.evaluate(() => { const tab = document.querySelector('.article-panel .tab'); return tab.scrollWidth <= tab.clientWidth; }));
  await pen.page.locator('#article-heading').click();
  const rowNow = await pen.page.evaluate(() => { const b = document.querySelector('#pic-list > details.box[data-box="pq1"]'); return { open: b.open, state: b.dataset.state, line: b.querySelector('.box-line').textContent }; });
  check('described and credited, it folds to one line', !rowNow.open && rowNow.state === 'done' && rowNow.line === 'A street corner in Utrecht · Photo: Jan Fotograaf', JSON.stringify(rowNow));
  await pen.page.locator('#read-text p').first().click();
  await pen.page.keyboard.press('End');
  await pen.page.keyboard.type(' More.');
  check('typing keeps the picture marker in the text', await pen.page.evaluate(() => /<figure data-picture="pq1"><\/figure>/.test(window.imageDesk.state.articles[window.imageDesk.state.article].content)));
  // written in place: the title on the page is the draft's title, both ways
  await pen.page.locator('#read-title').click();
  await pen.page.keyboard.press('End');
  await pen.page.keyboard.type(' today');
  check('typing the title on the page renames the draft', await pen.page.evaluate(() => window.imageDesk.state.articles[window.imageDesk.state.article].title === 'Street interviews today')
    && (await pen.page.locator('#article-title').inputValue()) === 'Street interviews today');
  await openBox(pen.page, 'article', 'title');
  await pen.page.locator('#article-title').fill('Street interviews');
  check('and the title field changes the page', (await pen.page.locator('#read-title').textContent()) === 'Street interviews');
  // pictures in the page's text: ↑ ↓ move them, ✕ takes one out of the text, dragging moves one too
  await pen.page.evaluate(() => {
    document.activeElement?.blur();
    const s = window.imageDesk.state;
    s.articles[s.article] = { ...s.articles[s.article], pictures: { ...s.articles[s.article].pictures, pq2: { path: 'desk-uploads/bbbbbbbbbbbbbbbb-corner.jpg', name: 'corner.jpg', alt: 'A corner' } },
      content: '<p>One.</p><figure data-picture="pq1"></figure><p>Two.</p><figure data-picture="pq2"></figure>' };
    window.imageDesk.render();
  });
  const order = () => pen.page.evaluate(() => [...window.imageDesk.state.articles[window.imageDesk.state.article].content.matchAll(/<p>([^<]*)<\/p>|data-picture="(\w+)"/g)].map((m) => m[1] ?? m[2]).join(' '));
  check('the page shows both pictures, each with ↑ ↓ ✕', (await pen.page.locator('#read-text .pic-block').count()) === 2 && (await pen.page.locator('#read-text .pic-block .pic-tools button').count()) === 6);
  await pen.page.locator('#read-text .pic-block[data-picture="pq1"] button[data-move="down"]').click();
  check('↓ moves a picture below the next paragraph', (await order()) === 'One. Two. pq1 pq2', await order());
  await pen.page.locator('#read-text .pic-block[data-picture="pq2"] button[data-move="up"]').click();
  check('↑ moves a picture up', (await order()) === 'One. Two. pq2 pq1', await order());
  await pen.page.locator('#read-text .pic-block[data-picture="pq2"] button[data-move="out"]').click();
  check('✕ takes it out of the text; it stays in the pictures list', (await order()) === 'One. Two. pq1' && (await pen.page.locator('#pic-list .pic-row').count()) === 2, await order());
  await pen.page.locator('#read-text .pic-block[data-picture="pq1"]').dragTo(pen.page.locator('#read-text p').first(), { targetPosition: { x: 10, y: 2 } });
  check('dragging a picture moves it', (await order()) === 'pq1 One. Two.', await order());
  // ＋ Video: a YouTube or Vimeo link becomes a block in the text, moved like a picture; nothing loads from YouTube
  const videos = [];
  pen.page.on('request', (request) => { if (/youtube|ytimg|vimeo/.test(request.url())) videos.push(request.url()); });
  await pen.page.locator('#read-text p').last().click();
  await pen.page.locator('#add-video-here').click();
  await pen.page.locator('#video-url').fill('https://example.com/clip.mp4');
  await pen.page.locator('#video-form button[type="submit"]').click();
  check('a link that is not YouTube or Vimeo is refused, and the page says so', /not a YouTube or Vimeo link/.test(await pen.page.locator('#page-note').textContent()) && (await pen.page.locator('#read-text .video-block').count()) === 0);
  await pen.page.locator('#video-url').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await pen.page.locator('#video-form button[type="submit"]').click();
  const withVideo = () => pen.page.evaluate(() => [...window.imageDesk.state.articles[window.imageDesk.state.article].content.matchAll(/<p>([^<]*)<\/p>|data-picture="(\w+)"|data-video="([\w:-]+)"/g)].map((m) => m[1] ?? m[2] ?? m[3]).join(' '));
  check('＋ Video puts the video after the paragraph the cursor is in', (await withVideo()) === 'pq1 One. Two. youtube:dQw4w9WgXcQ' && await pen.page.locator('#video-form').isHidden(), await withVideo());
  await pen.page.locator('#read-text .video-block button[data-move="up"]').click();
  check('↑ moves the video too', (await withVideo()) === 'pq1 One. youtube:dQw4w9WgXcQ Two.', await withVideo());
  await pen.page.locator('#read-text .video-block button[data-move="out"]').click();
  check('✕ takes the video out of the text', (await withVideo()) === 'pq1 One. Two.', await withVideo());
  check('the desk loads nothing from YouTube or Vimeo', videos.length === 0, videos.join(' '));
  // moving paragraphs: Alt+↑ / Alt+↓, or ↑ ↓ beside the paragraph the cursor is in; the cursor stays put
  await pen.page.locator('#read-text p').last().click();
  await pen.page.keyboard.press('End');
  await pen.page.keyboard.press('Alt+ArrowUp');
  check('Alt+↑ moves the paragraph above the one before it', (await order()) === 'pq1 Two. One.', await order());
  await pen.page.keyboard.type('!');
  check('the cursor stays where it was in the moved paragraph', (await order()) === 'pq1 Two.! One.', await order());
  check('↑ ↓ show beside the paragraph the cursor is in', await pen.page.locator('#block-tools').isVisible());
  await pen.page.locator('#block-tools button[data-move="down"]').click();
  check('↓ beside it moves it back down', (await order()) === 'pq1 One. Two.!', await order());
  await pen.page.locator('#block-tools button[data-move="up"]').click();
  await pen.page.locator('#block-tools button[data-move="up"]').click();
  check('↑ moves a paragraph past a picture too', (await order()) === 'Two.! pq1 One.', await order());
  // leaving the article with the caret on its page (review findings): its ↑ ↓ and the caret stay behind, and nothing
  // of the draft is saved to the project
  const draftId = await pen.page.evaluate(() => window.imageDesk.state.article);
  const left = () => pen.page.evaluate(() => ({ kind: document.querySelector('#reading').dataset.kind, sum: document.querySelector('#read-sum').textContent,
    tools: !document.querySelector('#block-tools').hidden, inPage: document.querySelector('#reading').contains(document.activeElement) }));
  const toolsBefore = await pen.page.locator('#block-tools').isVisible();
  await pen.page.keyboard.press('Alt+ArrowLeft');
  const leftText = await left();
  check('leaving the article from its text: its ↑ ↓ and the caret stay behind', toolsBefore && leftText.kind === 'project' && !leftText.tools && !leftText.inPage, JSON.stringify(leftText));
  await pen.page.evaluate((id) => window.imageDesk.openArticle(id), draftId);
  await pen.page.locator('#read-sum').click();
  await pen.page.keyboard.press('End');
  await pen.page.keyboard.type(' Draft words');
  await pen.page.keyboard.press('Alt+ArrowLeft');
  const leftSum = await left();
  await pen.page.keyboard.type('?');
  const projectRecords = JSON.stringify(await pen.page.evaluate(() => window.imageDesk.state.projects));
  check('leaving it from its summary: the project shows its own, and nothing of the draft is saved to it', leftSum.kind === 'project' && !/Draft words/.test(leftSum.sum) && !leftSum.inPage
    && !projectRecords.includes('Draft words'), JSON.stringify(leftSum) + ' ' + projectRecords.slice(0, 200));
  // Ctrl+Z on the project's page brings nothing of the draft into it: the browser keeps one undo history for the
  // page, and the draft's cut paragraph came back into the project's text and was saved there (review finding); its
  // deleted summary came back into the project's summary the same way
  const undoOn = await pen.page.evaluate(() => { const desk = window.imageDesk; desk.state.cursor = desk.flat.findIndex((item) => item.project.id === 'rmaekers/lightsurface-mk1-set'); return desk.flat[desk.state.cursor].project.id; });
  const pageNow = () => pen.page.evaluate((id) => ({ kind: document.querySelector('#reading').dataset.kind, text: document.querySelector('#read-text').textContent,
    sum: document.querySelector('#read-sum').textContent, record: JSON.stringify(window.imageDesk.state.projects[id] ?? null) }), undoOn);
  await pen.page.evaluate((id) => window.imageDesk.openArticle(id), draftId);
  const draftSummary = (await pen.page.locator('#read-sum').textContent()).slice(0, 18);
  await pen.page.locator('#read-sum').click();
  await pen.page.keyboard.press('Control+a');
  await pen.page.keyboard.press('Backspace');
  await pen.page.keyboard.press('Alt+ArrowLeft');
  await pen.page.keyboard.press('Control+z');
  await pen.page.keyboard.press('Control+z');
  const sumUndone = await pageNow();
  await pen.page.evaluate((id) => window.imageDesk.openArticle(id), draftId);
  await pen.page.locator('#read-text > p').last().click();
  await pen.page.keyboard.press('End');
  await pen.page.keyboard.press('Enter');
  await pen.page.keyboard.type('A paragraph to cut.');
  await pen.page.evaluate(() => {
    const paragraphs = [...document.querySelectorAll('#read-text > p')];
    const [from, to] = paragraphs.slice(-2);
    const range = document.createRange();
    range.setStart(from, from.childNodes.length);
    range.setEnd(to, to.childNodes.length);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
  });
  await pen.page.keyboard.press('Control+x');
  await pen.page.keyboard.press('Alt+ArrowLeft');
  await pen.page.keyboard.press('Control+z');
  await pen.page.locator('#read-text > p').first().click();
  await pen.page.keyboard.press('Control+z');
  await pen.page.keyboard.press('Control+z');
  const undone = await pageNow();
  check('Ctrl+Z on the project\'s page brings nothing of the draft into it', [sumUndone, undone].every((now) => now.kind === 'project'
    && ![now.text, now.sum, now.record].some((words) => words.includes('A paragraph') || words.includes(draftSummary))) && draftSummary.length > 10,
    JSON.stringify([sumUndone, undone].map((now) => ({ ...now, text: now.text.slice(0, 80) }))));
  await pen.page.evaluate((id) => { delete window.imageDesk.state.projects[id]; window.imageDesk.render(); }, undoOn);
  await pen.page.evaluate((id) => window.imageDesk.openArticle(id), draftId);
  // ＋ Picture on the page: signed out it can't upload, and the page says why
  const [chooser] = await Promise.all([pen.page.waitForEvent('filechooser'), pen.page.locator('#add-picture-here').click()]);
  await chooser.setFiles({ name: 'here.png', mimeType: 'image/png', buffer: Buffer.from('89504e470d0a1a0a', 'hex') });
  check('＋ Picture signed out: the page says why it was not added', await waitFor(pen.page, () => /not added: .*sign in first/.test(document.querySelector('#page-note').textContent)), await pen.page.locator('#page-note').textContent());
  await pen.page.reload();
  await pen.page.waitForFunction(() => window.imageDesk && window.deskSync);
  check('after a reload the draft is still open', (await pen.page.locator('#article-title').inputValue()) === 'Street interviews');
  await pen.page.locator('#open-overview').click();
  check('the overview lists the draft', (await pen.page.locator('#ov-articles').innerText()).includes('Street interviews'));
  await pen.page.locator('#ov-articles .ov-row').first().click();
  check('the overview opens it', await pen.page.locator('#article-bench').isVisible());
  await pen.page.locator('#back-to-projects').click();
  check('back to the projects', await pen.page.locator('#project-bench').isVisible());
  await pen.page.locator('#project-picker').selectOption({ label: 'Street interviews · draft' });
  await pen.page.locator('#delete-article').click();
  check('delete asks first', (await pen.page.locator('#delete-article').textContent()).includes('Click again'));
  await pen.page.locator('#delete-article').click();
  const afterDelete = await pen.page.evaluate(() => Object.values(window.imageDesk.state.articles));
  const tombstones = afterDelete.filter((article) => article.deleted);
  check('deleted: gone from the list, kept as a stamped tombstone', !(await pen.page.locator('#project-picker option').allTextContents()).some((text) => text.startsWith('Street interviews')) && tombstones.length === 1 && tombstones[0].at > 0, JSON.stringify(tombstones));
  check('articles: no page errors', pen.errors.length === 0, pen.errors.join(' / '));
  await shoot(pen.page, 'article');
  await writer.close();

  // ---------- a phone ----------
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const small = await open(phone);
  for (const tab of ['project', 'picture', 'preview']) {
    await small.page.locator('#tab-' + tab).click();
    check('390 px, ' + tab + ' tab: no sideways scroll', await small.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), String(await small.page.evaluate(() => document.documentElement.scrollWidth)));
    await shoot(small.page, 'phone-' + tab);
  }
  // a project's page with rows of pictures fits too, inside its own scroll
  await small.page.locator('#tab-project').click();
  await small.page.locator('#project-picker').selectOption(String(await small.page.evaluate(() => window.imageDesk.DATA.projects.findIndex((project) => project.id === 'rmaekers/merchandising'))));
  check("390 px, a project's page with rows of pictures: no sideways scroll in it", await small.page.evaluate(() => document.querySelector('#reading').scrollWidth <= document.querySelector('#reading').clientWidth),
    String(await small.page.evaluate(() => document.querySelector('#reading').scrollWidth)));
  // leaving the Picture tab scrolls the page to its picture, not the whole window: the tab tapped stays where it was (review finding)
  await small.page.locator('#project-picker').selectOption(String(await small.page.evaluate(() => window.imageDesk.DATA.projects.findIndex((project) => project.id === 'rmaekers/giant-swings'))));
  await small.page.locator('#tab-picture').click();
  await small.page.locator('#filmstrip button').nth(3).click();
  const tabsAt = () => small.page.evaluate(() => ({ y: Math.round(scrollY), tabs: Math.round(document.querySelector('#tab-project').getBoundingClientRect().top) }));
  await small.page.evaluate(() => document.querySelector('#tab-project').scrollIntoView({ block: 'start' }));
  const tabsBefore = await tabsAt();
  await small.page.locator('#tab-project').click();
  const tabsAfter = await tabsAt();
  check('390 px, leaving the Picture tab: the window stays where it was, the tabs under the finger', tabsBefore.y > 0 && Math.abs(tabsAfter.tabs - tabsBefore.tabs) <= 1, JSON.stringify({ tabsBefore, tabsAfter }));
  // the article at phone width: its bar and its boxes fit too
  await small.page.locator('#new-article').click();
  check('390 px, article: no sideways scroll', await small.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), String(await small.page.evaluate(() => document.documentElement.scrollWidth)));
  // a draft with pictures, one open with its tools and ideas
  await small.page.evaluate(() => window.imageDesk.openArticle(Object.keys(window.imageDesk.DATA.seeds)[0]));
  await openBox(small.page, 'article', 'pictures');
  const firstRow = small.page.locator('#pic-list > details.box').first();
  if (!(await firstRow.evaluate((b) => b.open))) await firstRow.locator(':scope > summary').click();
  await firstRow.locator('details.drawer > summary').click();
  check('390 px, an article picture open with its ideas: no sideways scroll', await small.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), String(await small.page.evaluate(() => document.documentElement.scrollWidth)));
  await shoot(small.page, 'phone-article-picture');
  await small.page.locator('#show-elsewhere').click();
  check('390 px, article on the wall and as a link: no sideways scroll', await small.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), String(await small.page.evaluate(() => document.documentElement.scrollWidth)));
  await shoot(small.page, 'phone-article');
  check('390 px: no page errors', small.errors.length === 0, small.errors.join(' / '));
  await phone.close();

  if (signedIn) {
    // ---------- signed in, against the emulators ----------
    const deviceOne = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const one = await open(deviceOne);
    await one.page.setInputFiles('#load-file', exportFile);
    await one.page.waitForFunction(() => /^Loaded/.test(document.querySelector('#note').textContent));
    check('device 1, signed out: browser only', await waitFor(one.page, () => document.querySelector('.top [data-desk-saved]').textContent.startsWith('Not signed in')), await saved(one.page));
    await one.page.evaluate(() => window.__deskSignInForTest('klugook@gmail.com'));
    check('device 1, signed in: saved to the account', await waitFor(one.page, () => /^Saved · \d\d:\d\d$/.test(document.querySelector('.top [data-desk-saved]').textContent)), await saved(one.page));
    await shoot(one.page, 'signed-in-saved');

    const deviceTwo = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const two = await open(deviceTwo, '#overview');
    check('device 2, before sign-in: only the archive', (await progress(two.page)).startsWith(`${archiveDone} of`), await progress(two.page));
    await two.page.evaluate(() => window.__deskSignInForTest('klugook@gmail.com'));
    check('device 2, signed in: the work from device 1 arrives', await waitFor(two.page, (want) => document.querySelector('#progress-label').textContent === want, loaded), await progress(two.page));
    check('device 2: the overview shows it', (await two.page.locator('#ov-total').textContent()) === `${doneLoaded} of ${total} projects done`, await two.page.locator('#ov-total').textContent());
    await shoot(two.page, 'device-two-overview');
    await two.page.locator('#ov-next').click();
    await addWord(two.page, 'word from device two');
    await two.page.locator('#done').click();
    const after = `${doneLoaded + 1} of ${total} projects done`;
    check('device 2: a project finished', (await progress(two.page)) === after, await progress(two.page));
    check('device 2: saved', await waitFor(two.page, () => /^Saved · /.test(document.querySelector('.top [data-desk-saved]').textContent)), await saved(two.page));
    check('device 1: sees it without reloading', await waitFor(one.page, (want) => document.querySelector('#progress-label').textContent === want, after), await progress(one.page));
    // device 1 works too; both changes are kept
    await one.page.locator('#project-picker').selectOption({ index: total - 1 });
    await addWord(one.page, 'last project word');
    check('device 2: gets device 1\'s later word too', await waitFor(two.page, () => {
      const s = window.imageDesk.state; const words = Object.values(s.projects).map((p) => String(p.tags ?? '')).join(','); return words.includes('last project word') && words.includes('word from device two');
    }), '');
    check('device 1: no page errors', one.errors.length === 0, one.errors.join(' / '));
    check('device 2: no page errors', two.errors.length === 0, two.errors.join(' / '));

    // an old browser with work from before the stamps, on the project device 1 just changed (stamped)
    const lastId = await one.page.evaluate(() => window.imageDesk.DATA.projects.at(-1).id);
    const oldPc = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await oldPc.addInitScript(([key, id]) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ projects: { [id]: { tags: 'legacy-work', reviewed: true } }, images: {}, cursor: 0, session: 0 }));
    }, ['reddy-world-image-metadata-v4', lastId]);
    const old = await open(oldPc);
    await old.page.evaluate(() => window.__deskSignInForTest('klugook@gmail.com'));
    const both = (id) => { const p = window.imageDesk.state.projects[id] ?? {}; return /legacy-work/.test(p.tags) && /last project word/.test(p.tags) && p.reviewed === true; };
    check('old browser, signed in: its unstamped work and the stamped word are both kept', await waitFor(old.page, both, lastId), JSON.stringify(await old.page.evaluate((id) => window.imageDesk.state.projects[id], lastId)));
    check('device 1: gets the old browser\'s work too', await waitFor(one.page, both, lastId), JSON.stringify(await one.page.evaluate((id) => window.imageDesk.state.projects[id], lastId)));
    check('old browser: no page errors', old.errors.length === 0, old.errors.join(' / '));

    const stranger = await browser.newContext();
    const other = await open(stranger);
    await addWord(other.page, 'not Ryan');
    await other.page.evaluate(() => window.__deskSignInForTest('someone@example.com'));
    check('another account: refused, and says so', await waitFor(other.page, () => /can't save the desk/.test(document.querySelector('.top [data-desk-saved]').textContent)), await saved(other.page));
    check('another account: the work stays in that browser', await other.page.evaluate(() => Object.values(window.imageDesk.state.projects).some((p) => String(p.tags).includes('not Ryan'))));
  }
} finally {
  await browser.close();
  server.close();
}
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
