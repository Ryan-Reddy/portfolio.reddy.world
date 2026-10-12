# portfolio.reddy.world

Visual archive and physical production portfolios of **Ryan Reddy** and friends:

- 🎪 **RMaekers**: Festival decors, bespoke stage builds, mechanical props, and escape room fabrication (Georgies Wundergarten, Wicked Jazz Sounds, Lentekabinet, 11:11, Strafwerk).
- 🎨 **RRproductions**: Ryan Reddy's fine art portfolio, sculptures, Taleidoscope (Beatific Viewer), and mechanical inventions.
- 🪑 **Maup de Kleermaeker**: Bespoke adaptive furniture design and master craftsmanship (*Meubels met het gemak van aanpassing of hervorming*, Lightmaeker, Birthinchair, LoungeChair).
- 🎭 **Vaguely Vulgar**: Theatrical performance, acting, and modelling archives.

---

## Architecture & Data Pipeline

- Extracted from original WordPress WXR XML exports via `scripts/parse_wordpress.py`.
- Normalized into structured JSON under `src/data/`.
- Built with Astro as one static page per project, under the base `/portfolio`.
- Client-side search and category filtering, and a fullscreen image lightbox with keyboard navigation.

## Where it is published

- **The pages:** https://reddy.world/portfolio/. The reddy.world deploy builds this repo and publishes `dist/` under `/portfolio`.
- **The old host:** portfolio.reddy.world is the Firebase Hosting site `portfolio-reddy` (project `getreddyworld`). It only redirects: every old WordPress URL 301s to its page on reddy.world/portfolio. [deploy.yml](.github/workflows/deploy.yml) deploys it on every push to `main`, and starts the reddy.world deploy so the pages go live too.
- `npm run build` writes `firebase.json` ([firebase-config.mjs](scripts/firebase-config.mjs)) and fails if a redirect target is missing from the build.

---

## Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Preview build
npm run preview

# Re-run XML import parser
npm run import
```

## Self-hosted pictures

New posts can use pictures that are not on WordPress.com.

- Put the file in `public/images/<portfolio>/photo.jpg` (create the folder with the first picture). Astro serves `public/` under the base, so it is live at `https://reddy.world/portfolio/images/<portfolio>/photo.jpg`, and reddy.world's `add-portfolio.mjs` copies it along with the rest of `dist/`.
- In the post's `media[]` and `featured`, set `url` to `/portfolio/images/<portfolio>/photo.jpg` (root-absolute) and the real `width` and `height`.
- Only WordPress.com URLs get a resized `srcset` (its `?w=` resizer). A self-hosted picture is served whole, so upload it at web size.
- The RSS feed, the image sitemap and the share/JSON-LD tags turn the root-absolute URL into `https://reddy.world/...` ([media-url.js](src/lib/media-url.js)).
