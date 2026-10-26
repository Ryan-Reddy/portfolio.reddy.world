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
// a keyword typed into the project's keyword box, as Ryan does: type, then Enter
const addWord = async (page, word) => { await page.locator('#project-chips input').fill(word); await page.locator('#project-chips input').press('Enter'); };
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
  check('a project shows the keywords the site has', chips.length === 5, chips.join(' | '));
  check('opening a project changes nothing', await page.evaluate(() => Object.keys(window.imageDesk.state.projects).length === 0));
  // a word left in the box lands on the project it was typed on, not on the next one (review finding)
  await page.locator('#project-chips input').fill('pendingword');
  await page.keyboard.press('Alt+ArrowRight');
  const after = await page.evaluate(() => { const s = window.imageDesk.state.projects; const ids = window.imageDesk.DATA.projects.map((p) => p.id); return { here: s['rmaekers/lightsurface-mk1-set']?.tags ?? '', next: s[ids[ids.indexOf('rmaekers/lightsurface-mk1-set') + 1]] ?? null }; });
  check('a pending keyword stays on its own project when moving on', /pendingword/.test(after.here) && after.next === null, JSON.stringify(after));
  await page.locator('#project-picker').selectOption(String(seeded));
  // removing the last chip with Backspace keeps the focus in the box
  await page.locator('#project-chips input').click();
  await page.keyboard.press('Backspace');
  check('Backspace removes a chip and keeps the focus in the box', await page.evaluate(() => document.activeElement?.closest('#project-chips') !== null && !window.imageDesk.state.projects['rmaekers/lightsurface-mk1-set'].tags.includes('pendingword')));
  // removing every chip leaves none: the archive's words don't come back
  for (let i = 0; i < 6; i++) await page.keyboard.press('Backspace');
  check('removing every keyword leaves none', (await page.locator('#project-chips .chip').count()) === 0);
  await page.evaluate(() => { delete window.imageDesk.state.projects['rmaekers/lightsurface-mk1-set']; window.imageDesk.render(); });
  await page.locator('#tab-picture').click();
  const wp = await page.locator('#wp-picture').innerText();
  check('a picture shows its WordPress file name', /\.(jpe?g|png|webp|gif)/i.test(wp), wp.replace(/\s+/g, ' ').slice(0, 120));
  check('a picture shows what it says today', (await page.locator('#description').inputValue()).length > 0, await page.locator('#description').inputValue());
  await page.locator('#tab-project').click();
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
  await pen.page.locator('#article-title').fill('Street interviews');
  await pen.page.locator('#article-summary').fill('What people on the street told me.');
  await pen.page.locator('#article-text').click();
  await pen.page.keyboard.type('First paragraph of the draft.');
  check('the draft reads as its page on the left', (await pen.page.locator('#reading .reading-title').textContent()) === 'Street interviews'
    && (await pen.page.locator('#reading .reading-text').textContent()).includes('First paragraph'));
  check('the draft is in the project list, marked draft', (await pen.page.locator('#project-picker optgroup[label^="Your articles"] option').allTextContents()).includes('Street interviews · draft'));
  const stored = await pen.page.evaluate((key) => Object.values(JSON.parse(localStorage.getItem(key)).articles ?? {}), 'reddy-world-image-metadata-v4');
  // the desk may also hold drafts seeded from the repo (src/data/article-seeds/): this one is found by its title
  const mine = stored.filter((article) => article.title === 'Street interviews');
  check('the draft is saved and stamped', mine.length === 1 && mine[0].status === 'draft' && mine[0].at > 0, JSON.stringify(mine));
  // an interview needs its person before it can be published; a story with enough words can
  await pen.page.locator('#article-kind').selectOption('interview');
  check('an interview without its person cannot be published yet', await pen.page.locator('#publish-article').isDisabled() && /the person/.test(await pen.page.locator('#publish-hint').textContent()));
  await pen.page.locator('#article-kind').selectOption('story');
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
  check('a picture shows in the list and as a block in the text', (await pen.page.locator('#pic-list .pic-row').count()) === 1 && (await pen.page.locator('#article-text .pics[data-picture="pq1"]').count()) === 1);
  check('publishing waits for what the picture shows', /what every picture shows/.test(await pen.page.locator('#publish-hint').textContent()));
  await pen.page.locator('#pic-list textarea').fill('A street corner in Utrecht');
  check('saying what it shows lets it publish', await pen.page.locator('#publish-article').isEnabled());
  await pen.page.locator('#article-text p').first().click();
  await pen.page.keyboard.press('End');
  await pen.page.keyboard.type(' More.');
  check('typing keeps the picture marker in the text', await pen.page.evaluate(() => /<figure data-picture="pq1"><\/figure>/.test(window.imageDesk.state.articles[window.imageDesk.state.article].content)));
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
