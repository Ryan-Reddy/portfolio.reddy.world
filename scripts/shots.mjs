// Re-shoots a software case study's screenshots from its live app, so they keep up when the
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
const NEURO = 'https://neuro.reddy.world';
const VELVET = { adhd_palette_id: 'velvet_olive', adhd_font_id: 'atkinson_next' };

async function neuroTab(browser, tab) {
  const p = await page(browser, DESKTOP, { storage: VELVET });
  await p.goto(`${NEURO}/app?tab=${tab}`, { waitUntil: 'networkidle', timeout: 60000 });
  await p.waitForTimeout(2000);
  const png = await p.screenshot();
  await done(p);
  return png;
}

const RECIPES = {
  'reddy-neuro': {
    'neuro-baseline-vs-velvet-olive.webp': (b) => neuroTab(b, 'matrix'),
    'neuro-room-color-sets.webp': (b) => neuroTab(b, 'palettes'),
    // Reader Mode on a real article, scrolled to its first paragraph, ruler on
    'neuro-reader-mode-wikipedia.webp': async (b) => {
      const p = await page(b, DESKTOP, { storage: VELVET });
      await p.goto(`${NEURO}/app?tab=inspector`, { waitUntil: 'networkidle', timeout: 60000 });
      const address = await p.evaluateHandle(() => [...document.querySelectorAll('input')].find((i) => /^https?:/.test(i.value)));
      await address.asElement().fill('https://en.wikipedia.org/wiki/Atkinson_Hyperlegible');
      await p.getByRole('button', { name: /Load URL/ }).click();
      await p.waitForFunction(() => /Atkinson Hyperlegible is a/.test(document.body.innerText), null, { timeout: 45000 });
      await p.waitForTimeout(1000);
      await p.getByRole('button', { name: 'Reader Mode' }).first().click();
      // the buttons name their current state: bold word starts off, the reading ruler on
      if (await p.getByRole('button', { name: /Bionic ON/ }).count()) await p.getByRole('button', { name: /Bionic ON/ }).first().click();
      if (await p.getByRole('button', { name: /Ruler OFF/ }).count()) await p.getByRole('button', { name: /Ruler OFF/ }).first().click();
      await p.waitForTimeout(500);
      await p.evaluate(() => {
        const el = [...document.querySelectorAll('p,div')].find((e) => e.children.length < 3 && /^Atkinson Hyperlegible is a/.test(e.innerText.trim()));
        if (el) scrollTo(0, el.getBoundingClientRect().top + scrollY - 330);
      });
      await p.mouse.move(DESKTOP.width * 0.35, 470);
      await p.waitForTimeout(800);
      const png = await p.screenshot();
      await done(p);
      return png;
    },
    'neuro-landing-phone.webp': async (b) => {
      const p = await page(b, PHONE);
      await p.goto(NEURO, { waitUntil: 'networkidle', timeout: 60000 });
      await p.waitForTimeout(1500);
      const png = await p.screenshot();
      await done(p);
      return png;
    },
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
