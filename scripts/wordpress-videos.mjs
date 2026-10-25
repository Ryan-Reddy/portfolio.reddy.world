// Every video a post of the archive embeds or links to (YouTube, Vimeo, VideoPress),
// recorded in the post's `videos`: id, the video's own title, its channel, the start time
// the old page used, whether it still plays, and a thumbnail kept in the repo.
// Thumbnails go to public/images/<portfolio>/video/<id>.jpg; Vaguely Vulgar's film page
// keeps them in public/images/vaguelyvulgar/film/. Streams are never downloaded.
//
//   node scripts/wordpress-videos.mjs
import fs from 'node:fs';
import path from 'node:path';
import { embedsIn } from './wordpress-lib.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const KEYS = ['rmaekers', 'rrproductions', 'vaguelyvulgar', 'maup'];
const today = new Date().toISOString().slice(0, 10);
const HEADERS = { 'User-Agent': 'reddy.world archive video check' };

async function youtube(id) {
  const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`, { headers: HEADERS });
  if (res.ok) {
    const j = await res.json();
    return { status: 'public', title: j.title, channel: j.author_name, channel_url: j.author_url, thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
  }
  // 401/403: private or not embeddable; 404: removed. The watch page says which.
  const page = await (await fetch(`https://www.youtube.com/watch?v=${id}`, { headers: { ...HEADERS, 'Accept-Language': 'en' } })).text();
  const reason = page.match(/"playabilityStatus":\{"status":"([A-Z_]+)"(?:,"reason":"([^"]*)")?/);
  return { status: /private/i.test(reason?.[2] ?? '') ? 'private' : res.status === 404 || reason?.[1] === 'ERROR' ? 'gone' : `unavailable (${reason?.[2] ?? res.status})` };
}

async function vimeo(id) {
  const res = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(`https://vimeo.com/${id}`)}`, { headers: HEADERS });
  if (!res.ok) return { status: res.status === 404 ? 'gone' : `unavailable (${res.status})` };
  const j = await res.json();
  return { status: 'public', title: j.title, channel: j.author_name, channel_url: j.author_url, thumb: j.thumbnail_url };
}

async function videopress(id) {
  const res = await fetch(`https://public-api.wordpress.com/oembed/?format=json&url=${encodeURIComponent(`https://videopress.com/v/${id}`)}`, { headers: HEADERS });
  if (!res.ok) return { status: `unavailable (${res.status})` };
  const j = await res.json();
  return { status: 'public', title: j.title, channel: j.author_name, channel_url: j.author_url, thumb: j.thumbnail_url };
}

const LOOKUP = { youtube, vimeo, videopress };
const WATCH = {
  youtube: (id, start) => `https://www.youtube.com/watch?v=${id}${start ? `&t=${start}s` : ''}`,
  vimeo: (id) => `https://vimeo.com/${id}`,
  videopress: (id) => `https://videopress.com/v/${id}`,
};
const cache = new Map();
let count = 0;

for (const key of KEYS) {
  const file = path.join(ROOT, 'src', 'data', `${key}.json`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const post of data.posts) {
    const found = embedsIn(post.content).filter((e) => LOOKUP[e.kind]);
    if (!found.length) { delete post.videos; continue; }
    post.videos = [];
    for (const e of found) {
      const k = `${e.kind}:${e.id}`;
      if (!cache.has(k)) cache.set(k, await LOOKUP[e.kind](e.id));
      const info = cache.get(k);
      const dir = key === 'vaguelyvulgar' && post.slug === 'film' ? 'film' : 'video';
      let thumbnail = null;
      if (info.thumb) {
        const rel = `images/${key}/${dir}/${e.kind === 'youtube' ? '' : `${e.kind}-`}${e.id}.jpg`;
        const to = path.join(ROOT, 'public', rel);
        if (!fs.existsSync(to)) {
          const res = await fetch(info.thumb, { headers: HEADERS });
          if (res.ok) { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.writeFileSync(to, Buffer.from(await res.arrayBuffer())); }
        }
        if (fs.existsSync(to)) thumbnail = `/portfolio/${rel}`;
      }
      post.videos.push({
        kind: e.kind,
        id: e.id,
        url: WATCH[e.kind](e.id, e.start),
        ...(e.start ? { start: e.start } : {}),
        status: info.status,
        ...(info.title ? { title: info.title, channel: info.channel, channel_url: info.channel_url } : {}),
        ...(thumbnail ? { thumbnail } : {}),
        checked: today,
      });
      count++;
    }
  }
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}
console.log(`wordpress-videos: ${count} videos in ${cache.size} different, ${[...cache.values()].filter((v) => v.status !== 'public').length} no longer public`);
