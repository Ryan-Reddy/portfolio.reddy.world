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
      // The wall is the only overview. Redirect stubs exist for old links but
      // are deliberately absent from search results; project details remain.
      filter(page) {
        const path = new URL(page).pathname;
        return path !== '/portfolio/'
          && path !== '/portfolio/image-metadata/'
          && path !== '/portfolio/software/'
          && !/^\/portfolio\/(rmaekers|rrproductions|vaguelyvulgar)\/$/.test(path)
          && !path.startsWith('/portfolio/theme/');
      },
      // Google Images reads <image:image> entries, one per photo on the page; lastmod is the post's last edit
      serialize(item) {
        const { img, lastmod } = pageInfo(item.url);
        return { ...item, ...(img.length && { img }), ...(lastmod && { lastmod }) };
      },
    }),
  ],
});
