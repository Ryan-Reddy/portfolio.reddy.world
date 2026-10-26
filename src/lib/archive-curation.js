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

// Overrides for pages whose WordPress text was missing or unclear: data and Ryan's own
// words only, never text about the page or the work (its history, what the page is).
// Rule: "No meta copy on public pages" (Ryan, 2026-10-25).
const COPY = {
  rrproductions: {
    // The One and the NEPCO internship link each other (Ryan, 2026-10-25: "worked on via NEPCO"):
    // links on his own words only, no new sentence
    '566': {
      swap: [['worked with Nepco on the costumes', 'worked with <a href="/portfolio/rrproductions/internship-at-studio-nepco/">Nepco</a> on the costumes']],
    },
    '662': {
      swap: [['<a href="https://youtu.be/7w6ySPAXsDA" target="_blank">previous post</a>', '<a href="/portfolio/rrproductions/sander-kleinenberg-felix-leiter-the-one-official-music-video/">previous post</a>']],
    },
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
  rmaekers: {
    // Ryan, 2026-10-25: "it was a own brand activation joke for reddymaekers and my first testshop live,
    // actually on reddymaekers.com/shop link to that bomber"
    '2012': {
      intro: '<p>An own brand activation joke for ReddyMaekers, and my first test shop live: <a href="https://reddymaekers.com/shop/">reddymaekers.com/shop</a></p>',
      swap: [['First up, ReddyMaekers Bomber Jackets!', 'First up, <a href="https://reddymaekers.com/shop/">ReddyMaekers Bomber Jackets</a>!']],
    },
    // Ryan, 2026-10-25: "Meghan Sile Catherina", not her surname; the address
    // /rmaekers/meghan-sile-catherina/ and its redirects stay as they are
    '868': { title: 'Meghan Sile Catherina' },
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
      // the film page's videos, embedded here (Ryan, 2026-10-25: "lets embed the videos for now")
      films: 61,
      // age-restricted on YouTube, so it does not play embedded: its still links to YouTube instead
      filmsLinkOnly: ['7w6ySPAXsDA'],
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
  // the text Ryan edited on the image desk is the page's text as it stands: he edited it after the
  // intro, cuts and swaps below, so they are not made again (scripts/import-image-keywords.mjs)
  if (post.edited_content) {
    const { intro, cut, swap, content, ...fields } = copy ?? {};
    return { ...post, ...fields, content: post.edited_content };
  }
  if (!copy) return post;
  const { intro, cut = [], swap = [], ...fields } = copy;
  let content = fields.content ?? post.content;
  for (const text of cut) {
    // a cut that no longer matches would quietly put the words back on the page
    if (!content.includes(text)) throw new Error(`archive-curation: ${portfolio}/${post.id}: text to cut not found: ${text.slice(0, 120)}`);
    content = content.replace(text, '');
  }
  for (const [from, to] of swap) {
    if (!content.includes(from)) throw new Error(`archive-curation: ${portfolio} ${post.id} no longer has "${from.slice(0, 60)}"`);
    content = content.replace(from, to);
  }
  return { ...post, ...fields, content: intro ? `${intro}\n\n${content}` : content };
}
