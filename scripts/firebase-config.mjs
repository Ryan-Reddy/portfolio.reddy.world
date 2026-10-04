// Writes firebase.json: two Hosting sites that only redirect.
//
// Both old hosts serve no content any more. Every old WordPress path 301s in one
// hop to its final URL on reddy.world/portfolio, which is where the pages live.
//
// - portfolio.reddy.world receives the WordPress.com "Site Redirect" traffic (#6),
//   which keeps the old path, e.g. /2016/07/20/wicked-jazz-sounds-festival/.
// - reddymaekers.com was the custom domain of the ReddyMaekers WordPress site
//   until 2021; its old paths still have backlinks.
//
// Run `npm run build` first: the check at the end confirms each target exists in dist/.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const KEYS = ['rmaekers', 'rrproductions', 'maup', 'vaguelyvulgar'];
const FINAL = 'https://reddy.world/portfolio';

const oldPath = (url) => {
  try {
    const path = decodeURI(new URL(url).pathname);
    return path.length > 1 ? path.replace(/\/?$/, '') : null;
  } catch {
    return null;
  }
};

// First portfolio wins when two old sites used the same path
const map = new Map();
for (const key of KEYS) {
  const data = JSON.parse(readFileSync(new URL(`../src/data/${key}.json`, import.meta.url), 'utf-8'));
  for (const post of data.posts) {
    const from = oldPath(post.old_url);
    if (from && !map.has(from)) map.set(from, `/${key}/${post.slug}/`);
  }
}

// Every rule points straight at the final URL, so each old path is one hop
const redirects = () => [
  ...[...map].flatMap(([from, to]) => [
    { source: from, destination: `${FINAL}${to}`, type: 301 },
    { source: `${from}/`, destination: `${FINAL}${to}`, type: 301 },
    { source: `${from}/**`, destination: `${FINAL}${to}`, type: 301 },
  ]),
  // anything else from the old WordPress structure lands on the overview
  ...['/category/**', '/tag/**', '/201*/**', '/202*/**'].map((source) => ({ source, destination: `${FINAL}/`, type: 301 })),
  // everything left, including the old home page
  { source: '**', destination: `${FINAL}/`, type: 301 },
];

const site = (target) => ({ target, public: 'redirect-only', cleanUrls: true, trailingSlash: true, redirects: redirects() });

const config = { hosting: [site('portfolio'), site('reddymaekers')] };

writeFileSync(new URL('../firebase.json', import.meta.url), JSON.stringify(config, null, 2) + '\n');
console.log(`firebase.json: ${map.size} old URLs mapped, 2 redirect-only sites`);

// Check: every mapped target is a page in the build (dist/ is the reddy.world/portfolio root)
if (existsSync(new URL('../dist/', import.meta.url))) {
  const missing = [...map.values()].filter((to) => !existsSync(new URL(`../dist${to}index.html`, import.meta.url)));
  if (missing.length) {
    console.error(`${missing.length} redirect targets missing from dist:\n${missing.join('\n')}`);
    process.exit(1);
  }
  console.log(`all ${map.size} redirect targets exist in dist/`);
}
