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
  vaguelyvulgar: new Set(['72', '61', '1',
    '10', // "Sizes": the measurements now sit on the photographs' page (Ryan, 2026-10-25: "that can become one page right?")
  ]),
};

// Hidden posts whose words moved onto another post: their old address jumps there, not to the wall
export const MOVED = {
  vaguelyvulgar: { '10': 'photo-cv' },
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
    // decision 2 in PR #44 (Ryan, 2026-10-25, option a): the materialenmix PDF carries his former
    // full name, so its link and the sentence that introduces it are dropped
    '218': {
      cut: [
        '<p style="text-align:center;">Here is a link to my material research, including bending bamboo, and soft robotics.</p>\n',
        '<p style="text-align:center;"><a href="https://ryanvanlil.wordpress.com/wp-content/uploads/2015/10/17-6-materialenmix-2.pdf" target="_blank">materialenmix onderzoek</a></p>\n',
      ],
    },
  },
  vaguelyvulgar: {
    // one page: the photographs and the measurements (Ryan, 2026-10-25). The weight was
    // measured in October 2026; the rest is from his 2016 site, "pretty much right" still.
    // No words about the page or its history (Ryan, 2026-10-25: "this meta crap on the site
    // has to stop !!"): only the pictures and the measurements as plain data.
    '13': {
      excerpt: 'Height 1.81 m, bust 86.5 cm, waist 70 cm, hips 86 cm, weight 69 kg, long blonde hair, blue eyes.',
      // a comp card: the lead picture with the measurements beside it, the rest in a grid
      layout: 'comp-card',
      // the measurements are current: no year beside them (page date, descriptions)
      undated: true,
      measurements: [
        ['Height', '1.81 m'],
        ['Bust', '86.5 cm'],
        ['Waist', '70 cm'],
        ['Hips', '86 cm'],
        ['Weight', '69 kg'],
        ['Hair', 'Long, blonde'],
        ['Eyes', 'Blue'],
      ],
    },
  },
};

/** The post as the site shows it: the archive record with any reviewed words above */
export function curatedPost(portfolio, post) {
  const copy = COPY[portfolio]?.[String(post.id)];
  if (!copy) return post;
  const { intro, cut = [], ...fields } = copy;
  let content = fields.content ?? post.content;
  for (const text of cut) content = content.replace(text, '');
  return { ...post, ...fields, content: intro ? `${intro}\n\n${content}` : content };
}
