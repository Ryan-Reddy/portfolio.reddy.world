import {VIDEO_KEY, videoKey} from './article-video.js';
export const PAGE_LAYOUTS = Object.freeze({story:'Story',cover:'Cover',split:'Split'});
export const pageLayout = value => Object.hasOwn(PAGE_LAYOUTS,value) ? value : 'story';
export const bannerVideo = value => VIDEO_KEY.test(String(value ?? '')) ? value : videoKey(value) ?? '';
export const bannerFocus = value => ['top','center','bottom'].includes(value) ? value : 'center';
