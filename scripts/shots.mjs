// Re-shoots a software case study's screenshots from its live app or extension, so they keep up when the
// app changes (reddy.world#125). Writes the WebP files the case study's .md names into
// public/images/software/<slug>/ (at most 1600 px wide, no metadata), then their srcset copies.
//
//   npm run shots -- reddy-neuro
//   npm run shots -- focus-desk
//
// Needs Playwright's Chromium once: npx playwright install chromium
// Example data typed into a live app is fine (agreed with Ryan, 2026-10-17); nothing is saved
// to an account.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const CAST = { width: 1280, height: 800 };

async function page(browser, viewport, { storage = {}, clock = false } = {}) {
  const phone = viewport.width < 500;
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: phone, hasTouch: phone });
  await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, storage);
  const p = await ctx.newPage();
  if (clock) await p.clock.install();
  return p;
}
const done = (p) => p.context().close();

// ---------------------------------------------------------------------------- Reddy.Neuro
// The case study is about NeuroOverlay, the browser extension (Ryan, 2026-10-19). It is the
// zip neuro.reddy.world offers (checked against its SHA-256), loaded into Chromium, on a real
// article. Nothing is stored: each capture gets a fresh browser profile.
const NEURO = 'https://neuro.reddy.world';
const ARTICLE = 'https://en.wikipedia.org/wiki/Atkinson_Hyperlegible';
let unpacked;

async function extension() {
  if (unpacked) return unpacked;
  const zip = Buffer.from(await (await fetch(`${NEURO}/neuro-overlay-extension.zip`)).arrayBuffer());
  const want = (await (await fetch(`${NEURO}/neuro-overlay-extension.zip.sha256`)).text()).trim().split(/\s+/)[0];
  const got = createHash('sha256').update(zip).digest('hex');
  if (got !== want) throw new Error(`neuro-overlay-extension.zip: SHA-256 ${got}, the site says ${want}`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'neuro-overlay-'));
  fs.writeFileSync(path.join(dir, 'ext.zip'), zip);
  fs.mkdirSync(path.join(dir, 'ext'));
  // Windows' own tar reads zip files; elsewhere unzip
  if (process.platform === 'win32') execFileSync(path.join(process.env.SystemRoot, 'System32', 'tar.exe'), ['-xf', path.join(dir, 'ext.zip'), '-C', path.join(dir, 'ext')]);
  else execFileSync('unzip', ['-q', path.join(dir, 'ext.zip'), '-d', path.join(dir, 'ext')]);
  unpacked = path.join(dir, 'ext');
  return unpacked;
}

/** Runs shoot(ctx, worker, id, tabId) in a fresh Chromium with the extension, the article open */
async function withExtension(shoot) {
  const ext = await extension();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'neuro-profile-'));
  const ctx = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', viewport: DESKTOP, deviceScaleFactor: 2,
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  try {
    const worker = ctx.serviceWorkers()[0] ?? await ctx.waitForEvent('serviceworker');
    const id = new URL(worker.url()).host;
    // the extension registers its content script on install; give it a moment
    await worker.evaluate(() => new Promise((r) => setTimeout(r, 2000)));
    const tab = ctx.pages()[0] ?? await ctx.newPage();
    await tab.goto(ARTICLE, { waitUntil: 'networkidle', timeout: 60000 });
    await tab.waitForTimeout(2000);
    const tabId = await worker.evaluate(async (u) => (await chrome.tabs.query({})).find((t) => t.url === u).id, ARTICLE);
    return await shoot({ ctx, worker, id, tab, tabId });
  } finally {
    await ctx.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

/** An extension page (popup or side panel) as it shows for the article's tab */
async function extensionPage(ctx, id, file, viewport) {
  const p = await ctx.newPage();
  await p.setViewportSize(viewport);
  // opened as a tab it would look at itself; point "the current tab" at the article
  await p.addInitScript((u) => {
    const query = chrome.tabs.query.bind(chrome.tabs);
    chrome.tabs.query = async () => (await query({})).filter((t) => t.url === u);
  }, ARTICLE);
  await p.goto(`chrome-extension://${id}/${file}`);
  await p.waitForTimeout(2500);
  return p;
}

const RECIPES = {
  'reddy-neuro': {
    // the article with and without NeuroOverlay, the same window, for the before/after slider
    'neuro-overlay-after.webp': () => withExtension(({ tab }) => tab.screenshot()),
    'neuro-overlay-before.webp': async (b) => {
      const p = await page(b, DESKTOP);
      await p.goto(ARTICLE, { waitUntil: 'networkidle', timeout: 60000 });
      const png = await p.screenshot();
      await done(p);
      return png;
    },
    'neuro-overlay-popup.webp': () => withExtension(async ({ ctx, id }) => (await extensionPage(ctx, id, 'popup.html', { width: 340, height: 600 })).screenshot({ fullPage: true })),
    'neuro-overlay-work-mode.webp': () => withExtension(async ({ tab, worker, tabId }) => {
      await tab.bringToFront();
      await worker.evaluate((t) => globalThis.neuroOpenWorkMode(t), tabId);
      await tab.waitForTimeout(2000);
      return tab.screenshot();
    }),
    // the side panel at its page check
    'neuro-overlay-page-check.webp': () => withExtension(async ({ ctx, id }) => {
      const p = await extensionPage(ctx, id, 'sidepanel.html', { width: 400, height: 900 });
      await p.getByText('Page check', { exact: false }).first().scrollIntoViewIfNeeded();
      await p.evaluate(() => {
        const h = [...document.querySelectorAll('h2')].find((e) => /page check/i.test(e.textContent));
        scrollTo(0, h.getBoundingClientRect().top + scrollY - 260);
      });
      await p.waitForTimeout(500);
      return p.screenshot();
    }),
  },
  'focus-desk': (() => {
    const FOCUS = 'https://focus.reddy.world/';
    const TASKS = ['Write the project summary', 'Answer two client emails', 'Plan tomorrow'];
    async function withTasks(b, viewport) {
      const p = await page(b, viewport, { clock: true });
      await p.goto(FOCUS, { waitUntil: 'networkidle', timeout: 60000 });
      await p.clock.runFor(800);
      for (const t of TASKS) { const i = p.getByPlaceholder(/Add a task/i).first(); await i.fill(t); await i.press('Enter'); }
      await p.locator(`text=${TASKS[0]}`).first().click().catch(() => {});
      return p;
    }
    async function running(b, viewport) {
      const p = await withTasks(b, viewport);
      await p.keyboard.press('Space');                // start focus
      await p.clock.runFor(9 * 60 * 1000 + 18000);    // 9:18 into the 25-minute session
      await p.mouse.move(2, 2);
      const png = await p.screenshot();
      await done(p);
      return png;
    }
    return {
      'focus-desk-running.webp': (b) => running(b, DESKTOP),
      'focus-desk-phone.webp': (b) => running(b, PHONE),
      'focus-desk-cast-view.webp': async (b) => {
        const p = await withTasks(b, CAST);
        await p.keyboard.press('c'); await p.clock.runFor(1000);
        const png = await p.screenshot();
        await done(p);
        return png;
      },
      // the three session colours in fullscreen, each cropped to its ring, side by side
      'focus-desk-three-sessions.webp': async (b) => {
        const p = await withTasks(b, DESKTOP);
        const shots = [];
        await p.keyboard.press('Space'); await p.clock.runFor(9 * 60 * 1000 + 18000);
        await p.keyboard.press('f'); await p.clock.runFor(1500); await p.mouse.move(2, 2);
        shots.push(await p.screenshot());
        await p.keyboard.press('Space'); await p.keyboard.press('f'); await p.clock.runFor(800);
        for (const label of ['Short Break', 'Long Break']) {
          await p.getByRole('tab', { name: label }).click();
          await p.keyboard.press('Space'); await p.clock.runFor(2 * 60 * 1000 + 7000);
          await p.keyboard.press('f'); await p.clock.runFor(1500); await p.mouse.move(2, 2);
          shots.push(await p.screenshot());
          await p.keyboard.press('Space'); await p.keyboard.press('f'); await p.clock.runFor(800);
        }
        await done(p);
        const tiles = await Promise.all(shots.map((s) => sharp(s).extract({ left: 840, top: 160, width: 1200, height: 1500 }).resize({ width: 560 }).png().toBuffer()));
        return sharp({ create: { width: 1680, height: 700, channels: 3, background: '#000' } })
          .composite(tiles.map((input, i) => ({ input, left: i * 560, top: 0 }))).png().toBuffer();
      },
    };
  })(),
};

const slug = process.argv[2];
const recipe = RECIPES[slug];
if (!recipe) {
  console.error(`usage: npm run shots -- <${Object.keys(RECIPES).join('|')}>`);
  process.exit(1);
}
const dir = path.join(import.meta.dirname, '..', 'public', 'images', 'software', slug);
fs.mkdirSync(dir, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `shots-${slug}-`));
const browser = await chromium.launch();
try {
  for (const [file, shoot] of Object.entries(recipe)) {
    const png = await shoot(browser);
    // a blank or nearly blank capture (a page that didn't load, a blocked request) never replaces a picture
    const { channels } = await sharp(png).stats();
    const spread = Math.max(...channels.slice(0, 3).map((c) => c.stdev));
    if (spread < 12) throw new Error(`${file}: the capture is nearly blank (spread ${spread.toFixed(1)}); the old picture stays`);
    fs.writeFileSync(path.join(tmp, file.replace(/\.webp$/, '.png')), png);
    const to = path.join(dir, file);
    // the old srcset copies go, so image-variants.mjs makes new ones
    for (const old of fs.readdirSync(dir).filter((f) => f.startsWith(file.replace(/\.webp$/, '-')) && /-\d+w\.webp$/.test(f))) fs.rmSync(path.join(dir, old));
    const info = await sharp(png).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toFile(to);
    console.log(`${file}: ${info.width}×${info.height}, ${Math.round(info.size / 1024)} KB`);
  }
} finally {
  await browser.close();
}
console.log(`raw captures kept in ${tmp}`);
execFileSync(process.execPath, [path.join(import.meta.dirname, 'image-variants.mjs'), dir], { stdio: 'inherit' });
