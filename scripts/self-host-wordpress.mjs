// Copies every public WordPress image into the repository, updates the archive
// records to the local URL, and preserves the original address as wp_url.
// Still pictures are rotated correctly, stripped of metadata and capped at
// 2000px; animated GIFs are kept intact.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { publicArchivePosts } from '../src/lib/archive-curation.js';

sharp.cache(false);
const ROOT = path.resolve(import.meta.dirname, '..');
const KEYS = ['rmaekers', 'rrproductions', 'vaguelyvulgar'];
const jobs = new Map();

const localPath = (key, source) => {
  const url = new URL(source);
  const match = decodeURIComponent(url.pathname).match(/\/(?:wp-content\/uploads\/)?(\d{4})\/(\d{2})\/([^/]+)$/i);
  if (!match) throw new Error(`WordPress upload path not understood: ${source}`);
  const [, year, month, filename] = match;
  return {
    file: path.join(ROOT, 'public', 'images', key, year, month, filename),
    url: `/portfolio/images/${key}/${year}/${month}/${filename}`,
  };
};

for (const key of KEYS) {
  const file = path.join(ROOT, 'src', 'data', `${key}.json`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const publicIds = new Set(publicArchivePosts(key, data.posts).map((post) => String(post.id)));
  for (const post of data.posts.filter((item) => publicIds.has(String(item.id)))) {
    for (const media of [post.featured, ...(post.media ?? [])].filter(Boolean)) {
      if (!/^https?:\/\/[^/]*(?:wordpress|wp)\.(?:com|org)\//i.test(media.url ?? '')
        && !/^https?:\/\/[^/]*\.files\.wordpress\.com\//i.test(media.url ?? '')) continue;
      const source = media.url;
      const local = localPath(key, source);
      media.wp_url ||= source;
      media.url = local.url;
      if (!jobs.has(source)) jobs.set(source, { source, ...local, records: [] });
      jobs.get(source).records.push(media);
    }
  }
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

let done = 0;
const pending = [...jobs.values()];
async function worker() {
  while (pending.length) {
    const job = pending.shift();
    fs.mkdirSync(path.dirname(job.file), { recursive: true });
    let buffer;
    if (fs.existsSync(job.file)) buffer = fs.readFileSync(job.file);
    else {
      const response = await fetch(job.source, { headers: { 'User-Agent': 'reddy.world archive migration' } });
      if (!response.ok) throw new Error(`${response.status} ${job.source}`);
      buffer = Buffer.from(await response.arrayBuffer());
      if (/\.gif$/i.test(job.file)) fs.writeFileSync(job.file, buffer);
      else {
        const image = sharp(buffer).rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true });
        const ext = path.extname(job.file).toLowerCase();
        await (ext === '.png' ? image.png({ compressionLevel: 9 })
          : ext === '.webp' ? image.webp({ quality: 82 })
          : image.jpeg({ quality: 82, progressive: true, mozjpeg: true })).toFile(job.file);
        buffer = fs.readFileSync(job.file);
      }
    }
    const metadata = await sharp(buffer, { animated: true }).metadata();
    for (const record of job.records) {
      record.width = metadata.width;
      record.height = metadata.pageHeight ?? metadata.height;
    }
    done++;
    if (done % 25 === 0 || done === jobs.size) console.log(`self-host-wordpress: ${done}/${jobs.size}`);
  }
}

await Promise.all(Array.from({ length: 8 }, worker));

// Dimensions are known only after downloading, so write the final records now.
for (const key of KEYS) {
  const file = path.join(ROOT, 'src', 'data', `${key}.json`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const post of data.posts) {
    for (const media of [post.featured, ...(post.media ?? [])].filter(Boolean)) {
      const job = [...jobs.values()].find((item) => item.url === media.url);
      const record = job?.records[0];
      if (record) Object.assign(media, { width: record.width, height: record.height });
    }
  }
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

console.log(`self-host-wordpress: ${jobs.size} originals are now local`);
