// npm test: a video in an article (src/lib/article-video.js), kept by the text cleaner and written by Send to site
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { videoKey, videoFigure } from '../src/lib/article-video.js';
import { storyHtml } from '../src/lib/safe-output.js';
import { articleFile } from './desk-articles.mjs';

test('a YouTube or Vimeo link becomes a key; anything else does not', () => {
  assert.equal(videoKey('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10'), 'youtube:dQw4w9WgXcQ');
  assert.equal(videoKey('https://youtu.be/dQw4w9WgXcQ'), 'youtube:dQw4w9WgXcQ');
  assert.equal(videoKey('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'youtube:dQw4w9WgXcQ');
  assert.equal(videoKey('https://vimeo.com/76979871'), 'vimeo:76979871');
  assert.equal(videoKey('https://example.com/video.mp4'), null);
  assert.equal(videoFigure('youtube:"><script>'), '');
});

test('the page gets a play button and no player: nothing loads from YouTube before a click', () => {
  const html = videoFigure('youtube:dQw4w9WgXcQ');
  assert.doesNotMatch(html, /<iframe|<img/);
  assert.match(html, /data-player="https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?autoplay=1"/);
  assert.match(html, /<button type="button" class="video-play" aria-label="Play the video \(YouTube\)">/);
  assert.match(videoFigure('vimeo:76979871'), /player\.vimeo\.com\/video\/76979871\?dnt=1/);
});

test('the text cleaner keeps a video marker and drops a made-up one', () => {
  assert.equal(storyHtml('<p>a</p><figure data-video="youtube:dQw4w9WgXcQ"></figure>'), '<p>a</p><figure data-video="youtube:dQw4w9WgXcQ"></figure>');
  assert.doesNotMatch(storyHtml('<figure data-video="javascript:x"></figure>'), /data-video/);
});

test('Send to site writes the video as its play button, in its place in the text', () => {
  const T = Date.parse('2026-10-26T10:00:00Z');
  const article = { title: 'A talk', summary: 'What was said on stage, and what came after the talk.', kind: 'story', status: 'ready', readyAt: T, at: T, created: T,
    content: '<p>Before.</p><figure data-video="vimeo:76979871"></figure><p>After.</p>' };
  const text = articleFile('a1', article);
  assert.match(text, /<p>Before\.<\/p><figure class="video-embed article-video" data-player="https:\/\/player\.vimeo\.com\/video\/76979871\?dnt=1&autoplay=1">[\s\S]*?<\/figure><p>After\.<\/p>/);
});
