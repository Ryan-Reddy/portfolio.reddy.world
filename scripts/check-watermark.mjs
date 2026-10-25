// Checks that every picture the built archive serves says whose it is (#47). Runs in
// `npm run build`, after scripts/watermark.mjs; fails with a list of problems.
//
//   node scripts/check-watermark.mjs
//
// - Every picture of Ryan's work carries his name, copyright, credit line and web statement
//   in its XMP, his name in its EXIF, and the stamp it should have (corner mark or metadata
//   only). GIFs can hold no metadata: they are counted, not read.
// - No picture that is not Ryan's (src/lib/image-rights.js) carries his copyright.
// - Every rule in image-rights.js still matches a served file, so a renamed file can't slip
//   out of it unnoticed.
// - Every ImageObject in the pages' structured data names Ryan as creator, with credit and
//   copyright, exactly when the picture is his.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { COPYRIGHT, CREATOR, CREDIT, RIGHTS_PATTERNS, WEB_STATEMENT, masterOf, rightsOf } from '../src/lib/image-rights.js';
import { STAMP, readRights } from './watermark/stamp.mjs';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const problems = [];
const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const p = path.join(dir, name);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const urlOf = (file) => `/portfolio/${path.relative(DIST, file).split(path.sep).join('/')}`;

const pictures = walk(path.join(DIST, 'images')).filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f));
const count = { mark: 0, meta: 0, none: 0, gif: 0 };
for (const file of pictures) {
  const url = urlOf(file);
  const kind = rightsOf(url);
  count[kind]++;
  if (/\.gif$/i.test(file)) { count.gif++; continue; }
  const { xmp, exif } = await sharp(file).metadata();
  const r = readRights(xmp);
  if (kind === 'none') {
    if (r.copyright || r.creator) problems.push(`${url}: not Ryan's picture, but carries "${r.copyright ?? r.creator}"`);
    continue;
  }
  const want = { creator: CREATOR, copyright: COPYRIGHT, credit: CREDIT, webStatement: WEB_STATEMENT, stamp: kind === 'mark' ? STAMP : 'metadata-only' };
  const wrong = Object.entries(want).filter(([k, v]) => r[k] !== v).map(([k]) => k);
  if (wrong.length) problems.push(`${url}: XMP lacks ${wrong.join(', ')}`);
  if (!exif?.includes(Buffer.from(CREATOR))) problems.push(`${url}: EXIF lacks the Artist "${CREATOR}"`);
}

for (const [list, patterns] of Object.entries(RIGHTS_PATTERNS)) {
  for (const re of patterns) {
    if (!pictures.some((f) => re.test(masterOf(urlOf(f))))) problems.push(`image-rights.js ${list}: ${re} matches no served picture`);
  }
}

// The structured data: every ImageObject of a self-hosted picture
let objects = 0;
for (const file of walk(DIST).filter((f) => f.endsWith('.html'))) {
  const html = readFileSync(file, 'utf-8');
  for (const [, json] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    const found = [];
    (function visit(node) {
      if (Array.isArray(node)) node.forEach(visit);
      else if (node && typeof node === 'object') {
        if (node['@type'] === 'ImageObject' && /^https:\/\/reddy\.world\/portfolio\/images\//.test(node.contentUrl ?? '')) found.push(node);
        Object.values(node).forEach(visit);
      }
    })(JSON.parse(json));
    for (const o of found) {
      objects++;
      const ryans = rightsOf(o.contentUrl.replace('https://reddy.world', '')) !== 'none';
      const has = Boolean(o.creator && o.creditText === CREDIT && o.copyrightNotice === COPYRIGHT);
      const page = `/${path.relative(DIST, file).split(path.sep).join('/')}`;
      if (ryans && !has) problems.push(`${page}: ImageObject ${o.contentUrl} lacks creator, creditText or copyrightNotice`);
      // a photographer may be the creator of a picture that is not Ryan's (desk credits); it may not name Ryan
      const namesRyan = JSON.stringify(o.creator ?? "").includes("https://reddy.world/#ryan") || o.copyrightNotice === COPYRIGHT || o.creditText === CREDIT;
      if (!ryans && namesRyan) problems.push(`${page}: ImageObject ${o.contentUrl} is not Ryan's picture but names him`);
    }
  }
}

if (problems.length) {
  console.error(`check-watermark: ${problems.length} problem(s)\n${problems.slice(0, 50).map((p) => `  - ${p}`).join('\n')}${problems.length > 50 ? `\n  ... and ${problems.length - 50} more` : ''}`);
  process.exit(1);
}
console.log(`check-watermark: ${pictures.length} pictures · ${count.mark} with the mark, ${count.meta} metadata only, `
  + `${count.none} not Ryan's · ${count.gif} GIFs (mark only, no metadata) · ${objects} ImageObjects agree`);
