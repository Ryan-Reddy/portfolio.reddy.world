// Whose picture is it? One answer for the watermark (scripts/watermark.mjs), its check
// (scripts/check-watermark.mjs) and the pages' ImageObject structured data (#47).
// No imports: scripts and pages both load it.
//
// Ryan's own work carries his mark: the ASCII Laser Unicorn in a corner, and his name and
// copyright in the file's EXIF and XMP (IPTC fields), which search engines read.
// (Ryan, 2026-10-25: "watermark, yes go for it, every pic.. doesnt have to cover it, just a
// small corner is good, pehaps the unicorn in blackandwhite ascii")

export const CREATOR = 'Ryan Reddy';
export const CREDIT = 'Ryan Reddy';
export const COPYRIGHT = '© Ryan Reddy';
export const WEB_STATEMENT = 'https://reddy.world/';

// Not Ryan's work: no mark, no copyright claim.
const NOT_RYANS = [
  // Maup: kept in the repo, not Ryan's work, never shown (src/lib/archive-curation.js)
  /^\/portfolio\/images\/maup\//,
  // The modelling pictures are photographs OF Ryan, taken by other people: a decision for
  // Ryan on #47 before his name goes on them as their creator
  /^\/portfolio\/images\/vaguelyvulgar\//,
  // ReddyMaekers' "Clients" page: the clients' own logos
  ...[
    'logo-2.jpg', 'radion-logo.jpg', 'dekmantel_logo_1438179591.png', 'apenkooi_logo_def1.png',
    'ruigoord-logo-gr2.png', 'nachtlab-logo-286x55-ffd400.png', 'logo_a8ff3fe67fca799f2aba.jpg',
    'f15-34-mrs_mokum_logo.jpg',
  ].map((f) => new RegExp(`^/portfolio/images/rmaekers/2016/07/${f.replace(/[.]/g, '\\.')}$`)),
];

// Ryan's own logos: his name in the file, but no unicorn stamped on a logo.
const NO_STAMP = [
  /^\/portfolio\/images\/rmaekers\/2016\/07\/logo-round-2\.jpg$/,
  /^\/portfolio\/images\/rmaekers\/2018\/09\/26903677_1547956805300554_1758949314504906172_n-logo-small-white-background-reddymaekers1\.jpg$/,
  /^\/portfolio\/images\/rrproductions\/2015\/05\/logo-piraat-glitterbaard-1-1\.gif$/,
];

/** The picture a -480w/-800w/-1200w copy was made from (its own URL for a master) */
export const masterOf = (url) => url.replace(/-\d+w(\.(?:jpe?g|png|webp|gif))$/i, '$1');

/**
 * What a served picture carries, by its URL (/portfolio/images/...):
 * 'mark'  the corner unicorn and the metadata; 'meta' the metadata only; 'none' neither.
 */
export function rightsOf(url) {
  const master = masterOf(url);
  if (NOT_RYANS.some((re) => re.test(master))) return 'none';
  if (NO_STAMP.some((re) => re.test(master))) return 'meta';
  return 'mark';
}

/** creator, credit and copyright for a picture's ImageObject, or nothing when it is not Ryan's */
export function imageRights(url, personId) {
  const path = url.replace(/^https:\/\/reddy\.world/, '');
  if (rightsOf(path) === 'none') return {};
  return { creator: { '@id': personId }, creditText: CREDIT, copyrightNotice: COPYRIGHT };
}

/** The patterns, so the check can say when one no longer matches any file */
export const RIGHTS_PATTERNS = { NOT_RYANS, NO_STAMP };
