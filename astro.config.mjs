import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { imagesForPage } from './src/lib/sitemap-images.js';

export default defineConfig({
  site: 'https://portfolio.reddy.world',
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
