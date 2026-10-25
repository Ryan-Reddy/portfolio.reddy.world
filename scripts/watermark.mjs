// Stamps every picture the built archive serves with Ryan's mark (#47). Runs in
// `npm run build`, after `astro build`, on dist/images/ only: the masters in public/images/
// stay clean in the repo, and the dev server shows them clean.
//
//   node scripts/watermark.mjs            (dist/)
//
// For each picture of Ryan's own work (src/lib/image-rights.js):
// - the corner mark: the ASCII Laser Unicorn (scripts/watermark/mark-*.png), bottom right,
//   about a tenth of the shorter side, black on a light corner and white on a dark one;
// - his name and copyright in the file: EXIF Artist/Copyright and XMP (IPTC fields).
// A -480w/-800w/-1200w copy is made again from its clean master, so a picture is encoded
// once, never twice. Animated WebPs get the mark on every frame; GIFs get the mark only
// (the format has no place for the metadata). Stamped files are cached in
// node_modules/.cache/watermark/, keyed by the master's bytes and the stamp, so a rebuild
// only stamps what changed.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { masterOf, rightsOf } from '../src/lib/image-rights.js';
import { EXIF, MARK, STAMP, markBox, markColour, markVariant, meanLuminance, xmpFor } from './watermark/stamp.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DIST = path.resolve(ROOT, process.argv[2] ?? 'dist');
const PUBLIC = path.join(ROOT, 'public');
const CACHE = path.join(ROOT, 'node_modules', '.cache', 'watermark');
const PICTURE = /\.(jpe?g|png|webp|gif)$/i;

// One thread per picture, a picture per core at once. sharp runs on Node's thread pool,
// 4 threads unless set before it starts, so the script starts itself again with a pool per core.
const THREADS = Math.max(2, availableParallelism());
if (!process.env.UV_THREADPOOL_SIZE) {
  const run = spawnSync(process.execPath, process.argv.slice(1), { stdio: 'inherit', env: { ...process.env, UV_THREADPOOL_SIZE: String(THREADS) } });
  process.exit(run.status ?? 1);
}
sharp.cache(false);
sharp.concurrency(1);
mkdirSync(CACHE, { recursive: true });

// mark-white.png, mark-black.png and their -qr versions (scripts/watermark/make-mark.mjs)
const MARKS = Object.fromEntries(['white', 'black', 'white-qr', 'black-qr'].map((c) => [c, readFileSync(path.join(ROOT, 'scripts', 'watermark', `mark-${c}.png`))]));
const aspectOf = async (buf) => { const { width, height } = await sharp(buf).metadata(); return width / height; };
const ASPECT = { plain: await aspectOf(MARKS.white), qr: await aspectOf(MARKS['white-qr']) };
// the stamp's own fingerprint: the mark pictures, its size rules and the metadata
const STAMP_KEY = Object.values(MARKS).reduce((h, buf) => h.update(buf), createHash('sha1'))
  .update(JSON.stringify(MARK)).update(STAMP).update(xmpFor('mark')).update(xmpFor('stamp')).digest('hex');

const sized = new Map();
/** The mark in one colour at one height (with the QR code when tall enough), already see-through */
function markAt(colour, height) {
  const name = markVariant(height) === 'qr' ? `${colour}-qr` : colour;
  const key = `${name}${height}`;
  if (!sized.has(key)) {
    sized.set(key, sharp(MARKS[name]).resize({ height, kernel: 'lanczos3' }).ensureAlpha()
      .linear([1, 1, 1, MARK.opacity], [0, 0, 0, 0]).png().toBuffer());
  }
  return sized.get(key);
}

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const p = path.join(dir, name);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

/** Where the mark goes on a width x height picture (one frame), and in which colour */
function place(width, height, luminanceOf) {
  const plain = markBox(width, height, ASPECT.plain);
  const box = markVariant(plain.height) === 'qr' ? markBox(width, height, ASPECT.qr) : plain;
  const left = Math.max(0, width - box.width - box.margin);
  const top = Math.max(0, height - box.height - box.margin);
  return { ...box, left, top, colour: markColour(luminanceOf({ left, top, w: Math.min(box.width, width - left), h: Math.min(box.height, height - top) })) };
}

/** Encodes a stamped picture in its own format, with Ryan's name in it */
function encode(img, { kind, ext, variant, isPalette, anim = {} }) {
  if (ext === '.gif') return img.gif({ ...anim, effort: 7 }).toBuffer(); // GIF has no room for metadata
  // a picture that is not Ryan's work carries no name in its metadata: only which stamp it has
  img = (kind === 'stamp' ? img : img.withExif(EXIF)).withXmp(xmpFor(kind));
  if (ext === '.png') return img.png({ compressionLevel: 9, palette: isPalette }).toBuffer();
  if (ext === '.webp') return img.webp({ quality: variant || anim.loop !== undefined ? 80 : 82, ...anim }).toBuffer();
  return img.jpeg({ quality: variant ? 78 : 82, progressive: true, mozjpeg: true }).toBuffer();
}

/** An animated picture (masters only): the mark on every frame */
async function stampAnimated(srcBuf, meta, out) {
  const frameH = meta.pageHeight ?? meta.height;
  const frames = meta.pages;
  const { data, info } = await sharp(srcBuf).raw().toBuffer({ resolveWithObject: true }); // the first frame
  const p = place(meta.width, frameH, (box) => meanLuminance(data, info, box));
  const mark = await markAt(p.colour, p.height);
  const img = out.kind === 'mark' || out.kind === 'stamp'
    ? sharp(srcBuf, { animated: true }).composite(Array.from({ length: frames }, (_, i) => ({ input: mark, left: p.left, top: i * frameH + p.top })))
    : sharp(srcBuf, { animated: true });
  return encode(img, { ...out, isPalette: false, anim: { loop: meta.loop ?? 0, delay: meta.delay } });
}

/**
 * All served files of one master (itself and its -NNNw copies): the master is decoded once,
 * and every copy is made from those clean pixels.
 */
async function stampGroup(srcBuf, outs) {
  const meta = await sharp(srcBuf).metadata();
  if ((meta.pages ?? 1) > 1) return Promise.all(outs.map((o) => stampAnimated(srcBuf, meta, o)));
  const { data, info } = await sharp(srcBuf).raw().toBuffer({ resolveWithObject: true });
  return Promise.all(outs.map(async (o) => {
    const w = o.width ?? info.width;
    const h = Math.round((info.height * w) / info.width);
    let img = sharp(data, { raw: info });
    if (o.width) img = img.resize({ width: o.width });
    if (o.kind === 'mark' || o.kind === 'stamp') {
      // the corner's brightness, read from the master at the same place
      const s = info.width / w;
      const p = place(w, h, (b) => meanLuminance(data, info, {
        left: Math.floor(b.left * s), top: Math.floor(b.top * s),
        w: Math.min(info.width - Math.floor(b.left * s), Math.ceil(b.w * s)), h: Math.min(info.height - Math.floor(b.top * s), Math.ceil(b.h * s)),
      }));
      // resize and composite in one pipeline would composite first; do it in two
      if (o.width) img = sharp(await img.raw().toBuffer(), { raw: { width: w, height: h, channels: info.channels } });
      img = img.composite([{ input: await markAt(p.colour, p.height), left: p.left, top: p.top }]);
    }
    return encode(img, { ...o, isPalette: Boolean(meta.isPalette) });
  }));
}

const started = Date.now();
const files = existsSync(path.join(DIST, 'images')) ? walk(path.join(DIST, 'images')).filter((f) => PICTURE.test(f)) : [];
const tally = { mark: 0, meta: 0, stamp: 0, none: 0, cached: 0, before: 0, after: 0 };

// Group the served files by the clean picture they are made from
const groups = new Map();
for (const file of files) {
  const url = `/portfolio/${path.relative(DIST, file).split(path.sep).join('/')}`;
  const kind = rightsOf(url);
  const size = statSync(file).size;
  tally.before += size;
  tally[kind]++;
  // GIFs hold no metadata: one that gets no corner mark is left as it is
  if (kind === 'none' || (kind === 'meta' && /\.gif$/i.test(file))) { tally.after += size; continue; }
  const master = masterOf(url);
  const variant = master !== url;
  const masterFile = path.join(PUBLIC, ...master.replace(/^\/portfolio\//, '').split('/'));
  // a copy without its master on disk is stamped as it is
  const fromMaster = variant && existsSync(masterFile);
  const src = fromMaster ? masterFile : path.join(PUBLIC, ...url.replace(/^\/portfolio\//, '').split('/'));
  const out = { file, kind, variant, ext: path.extname(file).toLowerCase(), width: fromMaster ? Number(url.match(/-(\d+)w\.[a-z]+$/i)[1]) : undefined };
  const key = existsSync(src) ? src : file;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(out);
}

const queue = [...groups];
async function worker() {
  while (queue.length) {
    const [src, outs] = queue.shift();
    const srcBuf = readFileSync(src);
    const hash = createHash('sha1').update(STAMP_KEY).update(srcBuf).digest('hex');
    for (const o of outs) o.cached = path.join(CACHE, `${createHash('sha1').update(hash).update(`${o.kind}|${o.ext}|${o.width ?? ''}|${o.variant}`).digest('hex')}${o.ext}`);
    const todo = outs.filter((o) => !existsSync(o.cached));
    const made = todo.length ? await stampGroup(srcBuf, todo) : [];
    todo.forEach((o, i) => writeFileSync(o.cached, made[i]));
    for (const o of outs) {
      copyFileSync(o.cached, o.file);
      tally.after += statSync(o.file).size;
    }
    tally.cached += outs.length - todo.length;
  }
}

await Promise.all(Array.from({ length: THREADS }, worker));

const mb = (n) => `${(n / 1e6).toFixed(1)} MB`;
const pct = tally.before ? (((tally.after - tally.before) / tally.before) * 100).toFixed(1) : '0';
console.log(`watermark: ${files.length} pictures in ${((Date.now() - started) / 1000).toFixed(1)} s · `
  + `${tally.mark + tally.stamp} with the mark (${tally.stamp} of them not Ryan's own work: no name or copyright in the file), ${tally.meta} metadata only · `
  + `${tally.cached} from cache · ${mb(tally.before)} -> ${mb(tally.after)} (${pct >= 0 ? '+' : ''}${pct}%)`);
