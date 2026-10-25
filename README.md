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

- **The pages:** project details are published below `https://reddy.world/portfolio/`. Portfolio, theme and software overview URLs hand visitors to the wall on reddy.world; there is no second browsing interface.
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
- RRproductions and every other archive picture are self-hosted too, hidden posts and Maup's included. `npm run media:self-host` copies any upload the records still point at (and PDFs a public post's text links to, into `public/files/`), caps stills at 2000 px, preserves `wp_url`, and updates the records; then run `node scripts/image-variants.mjs` for the folder of any picture a page shows.
- **Before the WordPress.com sites go offline:** `npm run media:capture` compares everything each old site still publishes with the repo and exits 1 on any gap: every public page (Jetpack portfolio items too), every picture a page shows (text, featured image, theme), every file it links to, every embed (YouTube, Vimeo, VideoPress, Sketchfab) and every upload no page shows. It reads the public WordPress.com API, no account. `-- --fix` first copies what is missing into `archive/wordpress/<site>/` (in the repo, not on the site; never a file carrying the former surname); `-- --probe` also asks WordPress for every upload again.
  - `npm run media:inventory` writes [wordpress-inventory.json](src/data/wordpress-inventory.json): every public page with what it shows (src, srcset, `data-orig-file`, Jetpack slideshows' `data-gallery`, gallery shortcodes by id; the exact file, so WordPress's edited copy `name-e123….jpg` is told apart from its original), links and embeds, and every upload with the post it belongs to (4 minutes; `posts/<id>` answers for uploads too, the media endpoint does not without login).
  - `npm run media:videos` records each post's videos in its `videos` (title, channel, start time, still public or not) with a thumbnail under `public/images/<site>/video/` (`vaguelyvulgar/film/` for the film page). Streams are never downloaded.
  - `npm run media:unused -- --export <site>=<media export .tar> … [--wxr <site>=<WXR .xml> …]` gives every upload no page shows its reason, in [wordpress-unused.json](src/data/wordpress-unused.json), with a thumbnail under `public/images/unused/` for the no-index review page `/portfolio/image-metadata/unused/`. The media exports are Ryan's (WordPress.com mails them: https://wordpress.com/support/export/); they stay on his machine.
- `/portfolio/image-metadata/` is a no-index, browser-local keyword and description desk, absent from the sitemap. Press **Export** there, then `npm run keywords:import -- reddy-world-image-metadata.json` writes the descriptions into each picture's `alt` and `description` and the keywords into `keywords` ([import-image-keywords.mjs](scripts/import-image-keywords.mjs); `--dry-run` first to see the count). `npm test` runs it on a sample export.

## What is shown

- [archive-curation.js](src/lib/archive-curation.js) decides it. Hidden posts (unfinished, or pages that were never work) keep their data and pictures; their old address is a no-index page that hands visitors to the wall, and they are in no sitemap, feed or list.
- **Maup de Kleermaeker** is kept in the repo but never shown: not Ryan's work (Ryan, 2026-10-24). No tab or brand; its old addresses go to https://reddy.world/ (the no-index pages under `/portfolio/maup/` and the redirects in `firebase.json`).
- Words written for a page whose WordPress text was empty or unclear live there too (`COPY`), every fact taken from the post's own data.
- **CI:** [check-archive.mjs](scripts/check-archive.mjs) fails on a WordPress picture in a page, two indexable pages with one title, a retired address without noindex or in the sitemap, or Maup in any page, feed or list.
- The RSS feed, the image sitemap and the share/JSON-LD tags turn the root-absolute URL into `https://reddy.world/...` ([media-url.js](src/lib/media-url.js)).
