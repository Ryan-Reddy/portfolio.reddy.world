# portfolio.reddy.world

Selected visual archive and physical production portfolios of **Ryan Reddy**:

- 🎪 **RMaekers**: Festival decors, bespoke stage builds, mechanical props, and escape room fabrication (Georgies Wundergarten, Wicked Jazz Sounds, Lentekabinet, 11:11, Strafwerk).
- 🎨 **RRproductions**: Ryan Reddy's fine art portfolio, sculptures, Taleidoscope (Beatific Viewer), and mechanical inventions.
- 📷 **Modelling**: Ryan Reddy's selected photographs and modelling profile, under the legacy Vaguely Vulgar URL.

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
- **Every PR gets a preview** ([preview.yml](.github/workflows/preview.yml)): the build on channel `pr<N>` of the `portfolio-reddy` site, opening on `/portfolio/software/`. One bot comment on the PR has the link and is updated for every push. The channel expires after 7 days and is deleted when the PR closes. It shows this archive only; links to reddy.world's app pages go to the live site.

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

## Software case studies

One page per software project at `https://reddy.world/portfolio/software/<slug>/`, and the overview at `/portfolio/software/`.

- **Words:** `src/content/software/<slug>.md`. Keep them short; the store listing (`store`, the main button) has the full, current description. The frontmatter fields are described in [content.config.ts](src/content.config.ts); the build fails on a missing `summary` (120–160 characters) or a screenshot without `alt`. The body is the case study in Markdown.
- **Pictures:** `public/images/software/<slug>/*.webp`, at most 1600 px wide, listed under `screenshots` in reading order (the first heads the page). Make the srcset copies with `node scripts/image-variants.mjs public/images/software/<slug>`.
- **New captures from the live app:** `npm run shots -- <slug>` re-shoots the pictures that [shots.mjs](scripts/shots.mjs) has a recipe for (Reddy.Neuro and Focus Desk so far) and makes their copies. Needs `npx playwright install chromium` once.
- **For reddy.world's wall:** `/portfolio/software.json` ([software.json.js](src/pages/software.json.js)) lists every case study with its line, status, store listings, main button, page and pictures. Version, release date and description come from each app's own `/app.json` at build time ([app-json.js](src/lib/app-json.js)) and are left out when it isn't there, never typed by hand. The apps publish it and start the reddy.world deploy after each release. The archive is the one source for software (Ryan, 2026-10-19); the wall reads this file at runtime.
- **After an app's release:** [refresh-captures.yml](.github/workflows/refresh-captures.yml) takes its pictures again from the live app, checks the build, commits what changed and starts the reddy.world deploy. The app's release starts it: `gh workflow run refresh-captures.yml -R Ryan-Reddy/portfolio.reddy.world -f slug=<slug>` (repo.template.reddy.world#37).
- **CI:** [check-software.mjs](scripts/check-software.mjs) reads the built pages as a crawler would: unique title, description, one `<h1>`, every picture with alt, width, height and srcset, JSON-LD with the author, and the page in the sitemap and `llms.txt`.

## Self-hosted pictures

New posts can use pictures that are not on WordPress.com.

- Put the file in `public/images/<portfolio>/photo.jpg` (create the folder with the first picture). Astro serves `public/` under the base, so it is live at `https://reddy.world/portfolio/images/<portfolio>/photo.jpg`, and reddy.world's `add-portfolio.mjs` copies it along with the rest of `dist/`.
- In the post's `media[]` and `featured`, set `url` to `/portfolio/images/<portfolio>/photo.jpg` (root-absolute) and the real `width` and `height`.
- Pictures filed as `public/images/<portfolio>/<YYYY>/<MM>/photo.jpg` get a resized `srcset` from their `-480w`, `-800w` and `-1200w` copies: make them with `node scripts/image-variants.mjs <file or folder>`. All RMaekers pictures live here since 2026-10-13 (web copies of the WordPress export: at most 2000 px, metadata stripped, animated GIFs as animated WebP); each media item keeps its old address as `wp_url`.
- Other self-hosted pictures are served whole, so upload them at web size. WordPress.com URLs still get their `?w=` srcset.
- The RSS feed, the image sitemap and the share/JSON-LD tags turn the root-absolute URL into `https://reddy.world/...` ([media-url.js](src/lib/media-url.js)).
