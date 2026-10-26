// The edit bar on the project pages (src/lib/edit-bar.js) in a real browser, on the local build:
// a visitor gets no bar; with ?edit on a non-reddy.world address it appears and saves to the desk in
// this browser; the desk shows what was written in place.
//
//   npm run build && node scripts/edit-bar-check.mjs     (SHOTS=<dir> keeps screenshots; BROWSER=<path>)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const root = new URL('../dist', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const shots = process.env.SHOTS;
if (shots) await mkdir(shots, { recursive: true });
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const executablePath = process.env.BROWSER ?? (existsSync(edge) ? edge : undefined);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!path.startsWith('/portfolio/')) { res.writeHead(404); return res.end(); }
  let file = join(root, path.slice(11));
  try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); } catch {}
  try { const body = await readFile(file); res.writeHead(200, { 'content-type': types[extname(file).toLowerCase()] ?? 'application/octet-stream' }); res.end(body); } catch { res.writeHead(404); res.end(); }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}/portfolio`;
const browser = await chromium.launch({ executablePath, headless: true });
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` -> ${detail}` : ''}`); };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // without the flag or ?edit nobody gets the bar
  await page.goto(`${base}/rmaekers/making-of-a-kaleidoscope/`.replace('rmaekers', 'rrproductions'));
  await page.waitForTimeout(800);
  check('a visitor gets no bar', (await page.locator('#desk-edit-bar').count()) === 0);
  await page.goto(`${base}/rrproductions/making-of-a-kaleidoscope/?edit`);
  await page.waitForSelector('#desk-edit-bar', { state: 'attached', timeout: 10000 });
  const bar = (sel) => page.locator(`#desk-edit-bar >> ${sel}`);
  check('?edit on a preview shows the bar', await bar('#edit').isVisible());
  await page.waitForTimeout(800);
  check('the bar says where changes go', /browser/.test(await bar('#status').textContent()), await bar('#status').textContent());
  await shoot('bar');
  await bar('#edit').click();
  check('edit mode: summary and text are editable', await page.locator('.post-summary').getAttribute('contenteditable') !== 'false' && (await page.locator('.modal-body-text').getAttribute('contenteditable')) === 'true');
  await page.locator('.post-summary').click();
  await page.keyboard.type('A kaleidoscope made by hand.');
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('reddy-world-image-metadata-v4') || '{}'));
  let s = await stored();
  check('typing the summary saves it to the desk', s.projects?.['rrproductions/making-of-a-kaleidoscope']?.summary === 'A kaleidoscope made by hand.', JSON.stringify(s.projects?.['rrproductions/making-of-a-kaleidoscope'] ?? {}).slice(0, 200));
  await page.locator('.modal-body-text p').first().click();
  await page.keyboard.press('End');
  await page.keyboard.type(' (edited)');
  s = await stored();
  const content = s.projects['rrproductions/making-of-a-kaleidoscope'].content ?? '';
  check('typing in the text saves it, picture blocks kept', /\(edited\)/.test(content) && /<figure data-media=/.test(content), content.slice(0, 160));
  check('picture blocks show in the text', (await page.locator('.modal-body-text .desk-pics').count()) > 0);
  const pens = page.locator('.desk-pic-edit');
  check('the lead picture and the pictures in the text can be opened', (await pens.count()) + (await page.locator('.modal-body-text .desk-pics img').count()) > 3, String(await pens.count()));
  await page.locator('.modal-body-text .desk-pics img').nth(1).click();
  check('✎ opens the picture panel, not the lightbox', await bar('#picture-panel').isVisible() && !(await page.locator('#lightbox').isVisible().catch(() => false)));
  await bar('#pic-description').fill('Mirrors in a tube, seen from the end');
  await bar('#pic-lead').click();
  s = await stored();
  const imgs = Object.entries(s.images ?? {}).filter(([k]) => k.startsWith('rrproductions/making-of-a-kaleidoscope::'));
  check('a picture description is saved under its key', imgs.some(([, r]) => r.description === 'Mirrors in a tube, seen from the end'), JSON.stringify(imgs).slice(0, 200));
  check('the lead picture is chosen', Boolean(s.projects['rrproductions/making-of-a-kaleidoscope'].hero));
  await shoot('editing');
  await bar('#pic-close').click();
  await bar('#words').click();
  await bar('#word-input').fill('kaleidoscope');
  await bar('#word-input').press('Enter');
  s = await stored();
  check('a keyword from the bar is saved', /kaleidoscope/.test(s.projects['rrproductions/making-of-a-kaleidoscope'].tags ?? ''));
  await bar('#edit').click();
  check('done editing: the page shows the site again', (await page.locator('.desk-pic-edit').count()) === 0 && (await page.locator('.modal-body-text').getAttribute('contenteditable')) === 'false' && !(await page.locator('.modal-body-text').innerHTML()).includes('desk-pics'));
  // the desk shows the same changes
  await page.goto(`${base}/image-metadata/#project=${encodeURIComponent('rrproductions/making-of-a-kaleidoscope')}`);
  await page.waitForFunction(() => window.imageDesk);
  const want = await page.evaluate(() => window.imageDesk.DATA.projects.find((p) => p.id === 'rrproductions/making-of-a-kaleidoscope').title);
  check('Open in the desk lands on the project', (await page.locator('#project-title').textContent()) === want, await page.locator('#project-title').textContent());
  check('the desk shows the summary written in place', (await page.locator('#summary').inputValue()) === 'A kaleidoscope made by hand.');
  check('no page errors', errors.length === 0, errors.join(' / '));
  // a page with a lead picture and pictures below the text: each gets a ✎
  await page.goto(`${base}/rmaekers/giant-swings/?edit`);
  await page.waitForSelector('#desk-edit-bar', { state: 'attached' });
  await page.waitForTimeout(500);
  await bar('#edit').click();
  const opener = (await page.locator('.desk-pic-edit').count()) ? page.locator('.desk-pic-edit').first() : page.locator('.modal-body-text .desk-pics img').first();
  await opener.click();
  check('a picture of this page opens its panel', await bar('#picture-panel').isVisible());
  // a phone
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.goto(`${base}/rrproductions/making-of-a-kaleidoscope/?edit`);
  await phone.waitForSelector('#desk-edit-bar', { state: 'attached' });
  await phone.waitForTimeout(600);
  check('390 px: no sideways scroll with the bar', await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  if (shots) await phone.screenshot({ path: `${shots}/editbar-phone.png` });
  async function shoot(name) { if (shots) await page.screenshot({ path: `${shots}/editbar-${name}.png` }); }
} finally {
  await browser.close();
  server.close();
}
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
