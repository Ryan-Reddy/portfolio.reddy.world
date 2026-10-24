// The WordPress exports are a source archive, not a promise that every old
// page belongs in Ryan's public portfolio. Keep the records intact, but only
// publish work that is ready to represent him.
const HIDDEN = {
  rrproductions: new Set([
    '1631', // unfinished mosquito proposal
    '1609', // unfinished giant-sofa proposal
    '1556', // moon-clock work in progress
    '631',  // unfinished graduation proposal
    '196', '394', '90', '88', '72', '62', '48', '46', '30', '1',
  ]),
  // Vaguely Vulgar is a modelling portfolio. The old performance, film and
  // business/about pages remain in the source archive but are not its public work.
  vaguelyvulgar: new Set(['72', '61', '1']),
};

export function isPublicArchivePost(portfolio, post) {
  return !HIDDEN[portfolio]?.has(String(post.id));
}

export function publicArchivePosts(portfolio, posts) {
  return posts.filter((post) => isPublicArchivePost(portfolio, post));
}
