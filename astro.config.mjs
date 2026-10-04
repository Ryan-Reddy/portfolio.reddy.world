import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { imagesForPage } from './src/lib/sitemap-images.js';

// Built here, published by reddy.world under /portfolio (see src/lib/portfolios.js)
export default defineConfig({
  site: 'https://reddy.world',
  base: '/portfolio',
  trailingSlash: 'always',
  integrations: [
    sitemap({
      // Google Images reads <image:image> entries; one per photo on the page
      serialize(item) {
        const img = imagesForPage(item.url);
        return img.length ? { ...item, img } : item;
      },
    }),
  ],
});
