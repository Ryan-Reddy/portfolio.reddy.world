import {FILE_VIDEO_KEY} from './uploaded-video.js';
// A video in an article (Ryan, 2026-10-27, #77: "A"): a YouTube or Vimeo link, kept in the text as
// <figure data-video="youtube:<id>"></figure> or data-video="vimeo:<id>". The page shows a black frame with
// a play button; the player (youtube-nocookie.com, or Vimeo with do-not-track, as src/lib/content.js
// embeds them for the archive) loads only when a visitor presses it, so nothing reaches YouTube or Vimeo before.
// The desk (src/pages/image-metadata.astro) reads links with the same two patterns.
const YOUTUBE = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^\s"'<]*&(?:amp;)?)?v=|embed\/|shorts\/|live\/))([\w-]{11})/;
const VIMEO = /vimeo\.com\/(?:video\/)?(\d{1,12})/;

/** A video marker's value: what the text keeps */
export const VIDEO_KEY = {test:value=>/^(?:youtube:[\w-]{11}|vimeo:\d{1,12})$/.test(String(value))||FILE_VIDEO_KEY.test(String(value))};

/** "youtube:<id>" or "vimeo:<id>" for a YouTube or Vimeo link, else null */
export function videoKey(url) {
  const text = String(url ?? '').trim();
  if(FILE_VIDEO_KEY.test(text))return text;
  const own='file:'+text.replace(/^https:\/\/reddy\.world/,'');if(FILE_VIDEO_KEY.test(own))return own;
  const youtube = YOUTUBE.exec(text);
  if (youtube) return `youtube:${youtube[1]}`;
  const vimeo = VIMEO.exec(text);
  return vimeo ? `vimeo:${vimeo[1]}` : null;
}

/** The player and the video's own page for a key, else null */
export function videoFor(key) {
  if (!VIDEO_KEY.test(String(key))) return null;
  if(FILE_VIDEO_KEY.test(key)){const src=key.slice(5);return {host:'Uploaded video',src,href:src,file:true};}
  const [host, id] = key.split(':');
  return host === 'youtube'
    ? { host: 'YouTube', src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`, href: `https://www.youtube.com/watch?v=${id}` }
    : { host: 'Vimeo', src: `https://player.vimeo.com/video/${id}?dnt=1&autoplay=1`, href: `https://vimeo.com/${id}` };
}

/** The figure an article page shows for a key: a play button that loads the player (src/components/Article.astro) */
export function videoFigure(key) {
  const video = videoFor(key);
  if (!video) return '';
  if(video.file)return `<figure class="video-embed uploaded-video"><video controls playsinline preload="metadata" src="${video.src}" aria-label="Project video"></video><figcaption><a href="${video.href}">Open video</a></figcaption></figure>`;
  return `<figure class="video-embed article-video" data-player="${video.src}"><div class="video-frame">` +
    `<button type="button" class="video-play" aria-label="Play the video (${video.host})"><span aria-hidden="true">▶</span> ${video.host}</button>` +
    `</div><figcaption><a href="${video.href}" rel="noopener">Watch on ${video.host}</a></figcaption></figure>`;
}
