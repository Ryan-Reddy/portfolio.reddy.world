// Writes firebase.json: two Hosting sites, each with 301s from the old WordPress URLs.
//
// - portfolio.reddy.world receives the WordPress.com "Site Redirect" traffic (#6),
//   which keeps the old path, e.g. /2016/07/20/wicked-jazz-sounds-festival/.
// - reddymaekers.com was the custom domain of the ReddyMaekers WordPress site
//   until 2021; its old paths still have backlinks.
import { readFileSync, writeFileSync } from 'node:fs';

const KEYS = ['rmaekers', 'rrproductions', 'maup', 'vaguelyvulgar'];
const PORTFOLIO = 'https://portfolio.reddy.world';

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

const redirects = (host) => [
  ...[...map].flatMap(([from, to]) => [
    { source: from, destination: `${host}${to}`, type: 301 },
    { source: `${from}/`, destination: `${host}${to}`, type: 301 },
    { source: `${from}/**`, destination: `${host}${to}`, type: 301 },
  ]),
  // anything else from the old WordPress structure lands on the overview
  ...['/category/**', '/tag/**', '/201*/**', '/202*/**'].map((source) => ({ source, destination: `${host}/`, type: 301 })),
];

const config = {
  hosting: [
    {
      target: 'portfolio',
      public: 'dist',
      cleanUrls: true,
      trailingSlash: true,
      redirects: redirects(''),
      headers: [{ source: '/_astro/**', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] }],
    },
    {
      target: 'reddymaekers',
      public: 'reddymaekers',
      redirects: redirects(PORTFOLIO),
    },
  ],
};

writeFileSync(new URL('../firebase.json', import.meta.url), JSON.stringify(config, null, 2) + '\n');
console.log(`firebase.json: ${map.size} old URLs mapped per site`);
