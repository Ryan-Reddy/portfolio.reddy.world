// Copies every WordPress upload the archive records still point at into the
// repository, so nothing breaks when the old WordPress.com sites go offline.
//
// - Pictures in a post's media and featured image, for every post of every source
//   site: public, hidden (archive-curation.js) and Maup's, which is kept but not shown.
//   The record's url becomes the local copy; the original address stays as wp_url.
// - Uploads a post's text links to (a full-size picture, a PDF drawing). Pictures go
//   next to the others; documents are copied as they are, to public/files/, and only
//   for public posts: the hidden contact page's terms and conditions stay on WordPress
//   until Ryan decides. The link in the text then points at the local copy.
//
// Still pictures are rotated correctly, stripped of metadata and capped at 2000px;
// animated GIFs are kept intact.
//
//   npm run media:self-host
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { isPublicArchivePost } from '../src/lib/archive-curation.js';

sharp.cache(false);
const ROOT = path.resolve(import.meta.dirname, '..');
const KEYS = ['rmaekers', 'rrproductions', 'vaguelyvulgar', 'maup'];
const WORDPRESS = /^https?:\/\/(?:[^/]*\.)?(?:wordpress\.com|wp\.com)\//i;
const UPLOAD_IN_TEXT = /https?:\/\/[^"'\s<>()]*(?:\.files\.wordpress\.com|\.wordpress\.com\/wp-content\/uploads)\/\d{4}\/\d{2}\/[^"'\s<>?#]+(?:\?[^"'\s<>#]*)?/gi;
const IMAGE = /\.(jpe?g|png|gif|webp)$/i;
const DOCUMENT = /\.(pdf|docx?)$/i;
const jobs = new Map();

const localPath = (key, source) => {
  const url = new URL(source);
  const match = decodeURIComponent(url.pathname).match(/\/(?:wp-content\/uploads\/)?(\d{4})\/(\d{2})\/([^/]+)$/i);
  if (!match) throw new Error(`WordPress upload path not understood: ${source}`);
  const [, year, month, filename] = match;
  const dir = IMAGE.test(filename) ? 'images' : 'files';
  return {
    file: path.join(ROOT, 'public', dir, key, year, month, filename),
    url: `/portfolio/${dir}/${key}/${year}/${month}/${filename}`,
  };
};

const job = (key, source) => {
  const clean = source.split('?')[0];
  const local = localPath(key, clean);
  if (!jobs.has(clean)) jobs.set(clean, { source: clean, ...local });
  return jobs.get(clean);
};

for (const key of KEYS) {
  const file = path.join(ROOT, 'src', 'data', `${key}.json`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const post of data.posts) {
    for (const media of [post.featured, ...(post.media ?? [])].filter(Boolean)) {
      if (!WORDPRESS.test(media.url ?? '') || !IMAGE.test(media.url.split('?')[0])) continue;
      const j = job(key, media.url);
      media.wp_url ||= j.source;
      media.url = j.url;
    }
    const pictures = [post.featured, ...post.media].filter((m) => m?.url?.startsWith('/portfolio/'));
    // a text link to an attachment page: point it at that picture's local copy
    post.content = (post.content ?? '').replace(
      /href="https?:\/\/[^"]*wordpress\.com\/\d{4}\/\d{2}\/\d{2}\/[^"/]+\/([^"/]+)\/"(\s+rel="attachment[^"]*")/g,
      (whole, slug, rel) => {
        const media = pictures.find((m) => path.basename(m.url).replace(/\d*\.[a-z]+$/i, '') === slug);
        return media ? `href="${media.url}"${rel}` : whole;
      },
    );
    post.content = post.content.replace(UPLOAD_IN_TEXT, (url) => {
      const clean = url.split('?')[0];
      const name = path.basename(new URL(clean).pathname);
      // the same upload is already one of this post's pictures
      const known = pictures.find((m) => m.wp_url && m.wp_url.split('?')[0].endsWith(`/${name}`));
      if (known) return known.url;
      if (!IMAGE.test(name) && !DOCUMENT.test(name)) return url;
      if (DOCUMENT.test(name) && !isPublicArchivePost(key, post)) return url;
      return job(key, clean).url;
    });
  }
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

let done = 0;
const pending = [...jobs.values()];
async function worker() {
  while (pending.length) {
    const j = pending.shift();
    fs.mkdirSync(path.dirname(j.file), { recursive: true });
    let buffer;
    if (fs.existsSync(j.file)) buffer = fs.readFileSync(j.file);
    else {
      const response = await fetch(j.source, { headers: { 'User-Agent': 'reddy.world archive migration' } });
      if (!response.ok) throw new Error(`${response.status} ${j.source}`);
      buffer = Buffer.from(await response.arrayBuffer());
      if (/\.gif$/i.test(j.file) || DOCUMENT.test(j.file)) fs.writeFileSync(j.file, buffer);
      else {
        const image = sharp(buffer).rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true });
        const ext = path.extname(j.file).toLowerCase();
        await (ext === '.png' ? image.png({ compressionLevel: 9 })
          : ext === '.webp' ? image.webp({ quality: 82 })
          : image.jpeg({ quality: 82, progressive: true, mozjpeg: true })).toFile(j.file);
        buffer = fs.readFileSync(j.file);
      }
    }
    if (IMAGE.test(j.file)) {
      const metadata = await sharp(buffer, { animated: true }).metadata();
      j.width = metadata.width;
      j.height = metadata.pageHeight ?? metadata.height;
    }
    done++;
    if (done % 25 === 0 || done === jobs.size) console.log(`self-host-wordpress: ${done}/${jobs.size}`);
  }
}

await Promise.all(Array.from({ length: 8 }, worker));

// Dimensions are known only after downloading, so write the final records now.
const byUrl = new Map([...jobs.values()].map((j) => [j.url, j]));
for (const key of KEYS) {
  const file = path.join(ROOT, 'src', 'data', `${key}.json`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const post of data.posts) {
    for (const media of [post.featured, ...(post.media ?? [])].filter(Boolean)) {
      const j = byUrl.get(media.url);
      if (j?.width) Object.assign(media, { width: j.width, height: j.height });
    }
  }
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

console.log(`self-host-wordpress: ${jobs.size} uploads are now local`);
