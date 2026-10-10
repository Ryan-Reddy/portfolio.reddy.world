// No imports: astro.config.mjs loads this through sitemap-images.js
const ORIGIN = 'https://reddy.world';

/** A picture's URL as feeds, the sitemap and meta tags need it: self-hosted ones are root-absolute (/portfolio/images/...) */
export const absUrl = (url) => (url.startsWith('/') ? `${ORIGIN}${url}` : url);

/** Only WordPress.com uploads have the ?w= resizer */
export const hasResizer = (url) => /^https?:\/\/[^/]*\.wordpress\.com\//i.test(url);
