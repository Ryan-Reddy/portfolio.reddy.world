import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { pageInfo } from './src/lib/sitemap-images.js';

// Built here, published by reddy.world under /portfolio (see src/lib/portfolios.js)
export default defineConfig({
  site: 'https://reddy.world',
  base: '/portfolio',
  trailingSlash: 'always',
  integrations: [
    sitemap({
      // Google Images reads <image:image> entries, one per photo on the page; lastmod is the post's last edit
      serialize(item) {
        const { img, lastmod } = pageInfo(item.url);
        return { ...item, ...(img.length && { img }), ...(lastmod && { lastmod }) };
      },
    }),
  ],
});
