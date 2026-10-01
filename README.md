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
- Built with modern HTML5, CSS custom properties, and Vite.
- Real-time client-side search, category filtering, responsive cards, project detail dialogs, and fullscreen image lightbox with keyboard navigation.

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
