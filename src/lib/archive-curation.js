// The WordPress exports are a source archive, not a promise that every old
// page belongs in Ryan's public portfolio. Keep the records intact, but only
// publish work that is ready to represent him.
//
// A hidden post keeps its data and pictures in the repo. Its old URL gets a
// no-index page that hands visitors to the wall ([...retired].astro), and it is
// left out of the sitemap, rss.xml, llms.txt and the wall.
const HIDDEN = {
  rrproductions: new Set([
    '1631', // unfinished mosquito proposal
    '1609', // unfinished giant-sofa proposal
    '1556', // moon-clock work in progress
    '631',  // unfinished graduation proposal
    '196', '394', '90', '88', '72', '62', '48', '46', '30', '1',
    // Half-finished (2026-10-25, PR #44): no words of their own. Back on the site once Ryan writes them.
    '79',   // "SELECTED WORK" at /79-2/: 28 pictures, no text, a placeholder address
    '227',  // "Materialenmix + integraal 9": 7 pictures, no text; 4 of them are also in "Designing a chair"
    '421',  // "Georgies Wundergarten": 5 pictures, no text; 4 of them are on the ReddyMaekers page of the same name
  ]),
  // Vaguely Vulgar is a modelling portfolio. The old performance, film and
  // business/about pages remain in the source archive but are not its public work.
  vaguelyvulgar: new Set(['72', '61', '1']),
};

// Sources that are kept in the repo but never shown: not Ryan's work (Ryan, 2026-10-24:
// "lets drop maup de kleermaeker, thats not me so not my work"). No pages, no tab, no
// brand; old addresses go to https://reddy.world/.
export const KEPT_NOT_SHOWN = ['maup'];

export function isPublicArchivePost(portfolio, post) {
  if (KEPT_NOT_SHOWN.includes(portfolio)) return false;
  return !HIDDEN[portfolio]?.has(String(post.id));
}

export function publicArchivePosts(portfolio, posts) {
  return posts.filter((post) => isPublicArchivePost(portfolio, post));
}

// Words for pages whose WordPress text was missing or unclear. Every fact comes from the
// post's own data (its text, date and pictures); nothing is added that the archive does
// not say. These are proposals until Ryan OKs them in PR #44 ("Words for Ryan to OK").
const COPY = {
  rrproductions: {
    // its text: "De opdracht was dus, om een kastje te creeeren met bewegend en/of sluitend deel."
    '397': { title: 'A cabinet with a moving part (school project, second year)' },
  },
  vaguelyvulgar: {
    '13': {
      excerpt: 'Fourteen photographs of Ryan Reddy as a model, from his Vaguely Vulgar portfolio site.',
      intro: '<p>Fourteen photographs of Ryan Reddy as a model, first shown on his Vaguely Vulgar site in August 2016. <a href="/portfolio/vaguelyvulgar/sizes/">His measurements</a> are on their own page.</p>',
    },
    '10': {
      excerpt: 'Ryan Reddy’s measurements as a model: height 1.81 m, bust 86.5 cm, waist 70 cm, hips 86 cm, long blonde hair, blue eyes.',
      content: [
        '<p>As listed on his Vaguely Vulgar site in August 2016.</p>',
        '<dl class="measurements">',
        '<dt>Height</dt><dd>1.81 m</dd>',
        '<dt>Bust</dt><dd>86.5 cm</dd>',
        '<dt>Waist</dt><dd>70 cm</dd>',
        '<dt>Hips</dt><dd>86 cm</dd>',
        '<dt>Hair</dt><dd>Long, blonde</dd>',
        '<dt>Eyes</dt><dd>Blue</dd>',
        '</dl>',
        '<p><a href="/portfolio/vaguelyvulgar/photo-cv/">See the photographs</a></p>',
      ].join('\n'),
    },
  },
};

/** The post as the site shows it: the archive record with any reviewed words above */
export function curatedPost(portfolio, post) {
  const copy = COPY[portfolio]?.[String(post.id)];
  if (!copy) return post;
  const { intro, ...fields } = copy;
  const content = fields.content ?? post.content;
  return { ...post, ...fields, content: intro ? `${intro}\n\n${content}` : content };
}
