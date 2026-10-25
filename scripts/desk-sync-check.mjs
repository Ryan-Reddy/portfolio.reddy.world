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
const saved = (page) => page.locator('.top [data-desk-saved]').textContent();
const waitFor = (page, fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);
const shoot = (page, name) => shots && page.screenshot({ path: join(shots, `${name}.png`) });

try {
  // ---------- signed out: the desk as before ----------
  const contextOut = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const { page, errors } = await open(contextOut);
  check('signed out: starts with nothing done', /^0 of \d+ projects$/.test(await progress(page)), await progress(page));
  check('signed out: says so plainly', await waitFor(page, () => document.querySelector('.top [data-desk-saved]').textContent === 'Not signed in: saved in this browser only'), await saved(page));
  await page.setInputFiles('#load-file', exportFile);
  await page.waitForFunction(() => /^Loaded \d+ projects/.test(document.querySelector('#celebrate').textContent));
  const loaded = await progress(page);
  check('Load export: the progress follows the export', !/^0 of/.test(loaded), loaded);
  const total = Number(loaded.match(/of (\d+)/)[1]);
  const doneLoaded = Number(loaded.match(/^(\d+)/)[1]);
  await page.reload();
  await page.waitForFunction(() => window.imageDesk);
  check('reload: the browser kept it', (await progress(page)) === loaded, await progress(page));
  await page.locator('#project-tags').fill('desk check word');
  const stamped = await page.evaluate((key) => { const s = JSON.parse(localStorage.getItem(key)); return Object.values(s.projects).some((p) => p.tags === 'desk check word' && p.at > 0) && Object.keys(s.days ?? {}).length > 0; }, 'reddy-world-image-metadata-v4');
  check('a change is stamped and the day counted', stamped);

  await page.locator('#open-overview').click();
  const overview = await page.locator('#overview').innerText();
  check('overview: total done', overview.includes(`${doneLoaded} of ${total} projects done`), overview.split('\n').slice(0, 6).join(' | '));
  check('overview: one next step', /Next up: .+/.test(overview));
  check('overview: done, started, not started', /\d+ done · \d+ started · \d+ not started/.test(overview));
  check('overview: one row per portfolio', (await page.locator('.ov-portfolio').count()) >= 2, String(await page.locator('.ov-portfolio').count()));
  await shoot(page, 'overview');
  await page.locator('.ov-portfolio summary').first().click();
  check('overview: every project listed', (await page.locator('.ov-row').count()) === total, String(await page.locator('.ov-row').count()));
  await shoot(page, 'overview-open');
  const next = (await page.locator('#ov-next').textContent()).replace(/^Next up: | →$/g, '');
  await page.locator('#ov-next').click();
  check('Next up opens that project on the desk', (await page.locator('#project-title').textContent()) === next && await page.locator('#overview').isHidden(), next);
  await shoot(page, 'desk');
  await page.goto(DESK + '#overview');
  await page.waitForFunction(() => window.imageDesk);
  check('#overview opens the overview directly (the link from /private)', await page.locator('#overview').isVisible());
  check('signed out: no page errors', errors.length === 0, errors.join(' / '));
  await contextOut.close();

  if (signedIn) {
    // ---------- signed in, against the emulators ----------
    const deviceOne = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const one = await open(deviceOne);
    await one.page.setInputFiles('#load-file', exportFile);
    await one.page.waitForFunction(() => /^Loaded/.test(document.querySelector('#celebrate').textContent));
    check('device 1, signed out: browser only', await waitFor(one.page, () => document.querySelector('.top [data-desk-saved]').textContent.startsWith('Not signed in')), await saved(one.page));
    await one.page.evaluate(() => window.__deskSignInForTest('klugook@gmail.com'));
    check('device 1, signed in: saved to the account', await waitFor(one.page, () => /^Saved · \d\d:\d\d$/.test(document.querySelector('.top [data-desk-saved]').textContent)), await saved(one.page));
    await shoot(one.page, 'signed-in-saved');

    const deviceTwo = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const two = await open(deviceTwo, '#overview');
    check('device 2, before sign-in: nothing here', /^0 of/.test(await progress(two.page)), await progress(two.page));
    await two.page.evaluate(() => window.__deskSignInForTest('klugook@gmail.com'));
    check('device 2, signed in: the work from device 1 arrives', await waitFor(two.page, (want) => document.querySelector('#progress-label').textContent === want, loaded), await progress(two.page));
    check('device 2: the overview shows it', (await two.page.locator('#ov-total').textContent()) === `${doneLoaded} of ${total} projects done`, await two.page.locator('#ov-total').textContent());
    await shoot(two.page, 'device-two-overview');
    await two.page.locator('#ov-next').click();
    await two.page.locator('#project-tags').fill('word from device two');
    await two.page.locator('#project-tags').press('Enter');
    const after = `${doneLoaded + 1} of ${total} projects`;
    check('device 2: a project finished', (await progress(two.page)) === after, await progress(two.page));
    check('device 2: saved', await waitFor(two.page, () => /^Saved · /.test(document.querySelector('.top [data-desk-saved]').textContent)), await saved(two.page));
    check('device 1: sees it without reloading', await waitFor(one.page, (want) => document.querySelector('#progress-label').textContent === want, after), await progress(one.page));
    // device 1 works too; both changes are kept
    await one.page.locator('#project-picker').selectOption({ index: total - 1 });
    await one.page.locator('#project-tags').fill('last project word');
    check('device 2: gets device 1\'s later word too', await waitFor(two.page, () => {
      const s = window.imageDesk.state; return Object.values(s.projects).some((p) => p.tags === 'last project word') && Object.values(s.projects).some((p) => p.tags === 'word from device two');
    }), '');
    check('device 1: no page errors', one.errors.length === 0, one.errors.join(' / '));
    check('device 2: no page errors', two.errors.length === 0, two.errors.join(' / '));

    const stranger = await browser.newContext();
    const other = await open(stranger);
    await other.page.locator('#project-tags').fill('not Ryan');
    await other.page.evaluate(() => window.__deskSignInForTest('someone@example.com'));
    check('another account: refused, and says so', await waitFor(other.page, () => /can't save the desk/.test(document.querySelector('.top [data-desk-saved]').textContent)), await saved(other.page));
    check('another account: the work stays in that browser', await other.page.evaluate(() => Object.values(window.imageDesk.state.projects).some((p) => p.tags === 'not Ryan')));
  }
} finally {
  await browser.close();
  server.close();
}
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
