import {VIDEO_KEY, videoKey} from './article-video.js';
export const PAGE_LAYOUTS = Object.freeze({story:'Text first',cover:'Full-width banner',split:'Side by side'});
export const pageLayout = value => Object.hasOwn(PAGE_LAYOUTS,value) ? value : 'cover';
export const bannerVideo = value => VIDEO_KEY.test(String(value ?? '')) ? value : videoKey(value) ?? '';
export const bannerFocus = value => ['top','center','bottom'].includes(value) ? value : 'center';
