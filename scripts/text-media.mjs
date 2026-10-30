// Recover standalone image links during desk publishing. Failed links stay as links.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {textImageLinks, placeTextImages} from '../src/lib/text-media.js';
import {isPublicArchivePost,curatedPost} from '../src/lib/archive-curation.js';

const LIMIT = 15 * 1024 * 1024;
export function trustedImageHost(value) {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.port && !url.username && !url.password
    && /(^|\.)(?:wp\.com|wordpress\.com|googleusercontent\.com)$/.test(url.hostname);
}

async function download(source) {
  let url = source;
  for (let redirects = 0; redirects < 5; redirects++) {
    if (!trustedImageHost(url)) throw new Error('Source needs a manual upload');
    const response = await fetch(url, {redirect:'manual', signal:AbortSignal.timeout(15000)});
    if ([301,302,303,307,308].includes(response.status)) {
      await response.body?.cancel();
      url = new URL(response.headers.get('location'), url).href;
      continue;
    }
    if (!response.ok || !/^image\//i.test(response.headers.get('content-type') ?? '')) {
      await response.body?.cancel(); throw new Error(`Image unavailable (HTTP ${response.status})`);
    }
    if (Number(response.headers.get('content-length')) > LIMIT) { await response.body.cancel(); throw new Error('Image exceeds 15 MB'); }
    const chunks = []; let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > LIMIT) throw new Error('Image exceeds 15 MB');
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  throw new Error('Too many redirects');
}

export async function recoverTextImages(root, fetchImage = download) {
  let added = 0;
  for (const key of ['rmaekers','rrproductions','vaguelyvulgar']) {
    const file = path.join(root, 'src/data', key + '.json');
    const original = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(original);
    for (const post of data.posts) {
      if (!isPublicArchivePost(key, post)) continue;
      const content = curatedPost(key, post).content ?? '';
      const links = textImageLinks(content);
      if (!links.length) continue;
      post.media ??= [];
      for (const source of links) {
        if (post.media.some(m => m.source_url === source || m.wp_url === source)) continue;
        // Only allow trusted image services here; other sources remain usable links.
        if (!trustedImageHost(source)) { console.warn(`text-media: kept link for manual upload: ${source}`); continue; }
        try {
          const id = createHash('sha256').update(source).digest('hex').slice(0,24);
          const relative = `images/project-uploads/${key}/${post.slug}/linked/${id}.webp`;
          const target = path.join(root, 'public', relative);
          let info;
          if (fs.existsSync(target)) info = await sharp(target).metadata();
          else {
            const input = await fetchImage(source);
            const {data:bytes, info:details} = await sharp(input, {limitInputPixels:40000000}).rotate()
              .resize({width:2000,height:2000,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer({resolveWithObject:true});
            fs.mkdirSync(path.dirname(target), {recursive:true}); fs.writeFileSync(target, bytes); info = details;
          }
          post.media.push({id:`linked-${id}`,type:'image',url:`/portfolio/${relative}`,source_url:source,
            title:'',alt:'',caption:'',description:'',width:info.width,height:info.height});
          added++; console.log(`text-media: recovered ${key}/${post.slug}: ${source}`);
        } catch (error) { console.warn(`text-media: kept unavailable link ${source}: ${error.message}`); }
      }
      const placed = placeTextImages(content, post.media);
      if (placed !== content) post.edited_content = placed;
    }
    const next = JSON.stringify(data, null, 2) + '\n';
    if (next !== original) fs.writeFileSync(file, next);
  }
  return added;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(`text-media: ${await recoverTextImages(path.resolve(import.meta.dirname,'..'))} images added`);
}
