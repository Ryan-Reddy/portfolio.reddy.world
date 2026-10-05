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
- **The old host:** portfolio.reddy.world is the Firebase Hosting site `portfolio-reddy` (project `getreddyworld`). It only redirects: every old WordPress URL 301s to its page on reddy.world/portfolio. [deploy-redirects.yml](.github/workflows/deploy-redirects.yml) deploys it on every push to `main`.
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
