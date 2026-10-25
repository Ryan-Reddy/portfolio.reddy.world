// Telling Ryan's words from words a machine left on a picture: a camera or WordPress file
// name ("IMG_6773", "img_6773-1.jpg", "36772197_…_n.jpg", a UUID), WordPress's placeholder,
// or the alt text the image-desk importer writes when Ryan gave none. Used by the importer
// (scripts/import-image-keywords.mjs) and the image desk (src/pages/image-metadata.astro).
// Plain functions, no data imports, so plain node can load it too.

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const letters = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|heic|heif|tiff?|bmp)$/i;
// WordPress's own endings: a copy number (-1), -scaled, a size (-1024x768), an edit stamp (-e1534567890)
const WP_SUFFIX = /(?:-\d+x\d+|-scaled|-e\d{9,}|-\d+)$/i;
const withoutSuffix = (s) => {
  let out = s;
  for (let prev; prev !== out && out;) { prev = out; out = out.replace(WP_SUFFIX, ''); }
  return out || s;
};
// shapes that are file names wherever they appear
const SHAPES = [
  /^(img|dsc|fullsizeoutput)[_ -]?\w+$/i,
  /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i,
  /^\d{6,}(_\d+)+_[a-z]$/i, // Facebook: 36772197_1004240556420936_8305567324182675456_n
];
const PLACEHOLDERS = ['enteracaption', 'image', 'capture'];

/** The bare name of a file or a caption: no folder, no image extension, no WordPress ending */
export const fileStem = (name) => withoutSuffix(clean(name).replace(IMAGE_EXT, ''));
const urlStem = (url) => fileStem(String(url ?? '').split('/').pop());

/** A caption or alt that says nothing: the picture's own file name, any file name, or a placeholder */
export const isFileNameCaption = (description, url) => {
  const text = letters(description);
  if (!text || PLACEHOLDERS.includes(text)) return true;
  const base = clean(description).replace(IMAGE_EXT, '');
  if ([base, withoutSuffix(base)].some((s) => SHAPES.some((shape) => shape.test(s)))) return true;
  if (!url) return false;
  const file = String(url).split('/').pop().replace(IMAGE_EXT, '');
  return text === letters(file) || letters(fileStem(description)) === letters(urlStem(url));
};

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** An all-capitals title in title case (MERCHANDISE → Merchandise); any other title as written */
export function titleCase(s) {
  const t = clean(s);
  return t === t.toUpperCase() ? t.toLowerCase().replace(/(^|\s|-)\S/g, (c) => c.toUpperCase()) : t;
}

/**
 * The alt text for a picture Ryan gave no words: the title, the picture's place on the page
 * and up to three of his keywords that the title does not already say
 * ("Merchandise, photo 3 — brand activation, fun, shop").
 * @param {string} title the project title
 * @param {number} position the picture's place among the page's pictures, from 1
 * @param {string[]} keywords Ryan's keywords for the picture, project words first
 */
export function fallbackAlt(title, position, keywords = []) {
  const name = titleCase(title);
  // a keyword the title already says, as a whole word or words, would only repeat it
  const said = (word) => new RegExp(`(?:^|[^\\p{L}\\p{N}])${escape(word)}(?:$|[^\\p{L}\\p{N}])`, 'iu').test(clean(title));
  const words = keywords.map(clean).filter((word) => word && !said(word)).slice(0, 3);
  return `${name}, photo ${position}${words.length ? ` — ${words.join(', ')}` : ''}`;
}

/**
 * Alt text no person wrote: a file name, a placeholder, the page's own "Title, photo 3",
 * or what the importer writes ("Title, photo 3 — words", and before 2026-10-25 "TITLE — words").
 */
export function isMachineAlt(alt, url, title) {
  if (isFileNameCaption(alt, url)) return true;
  const t = clean(title);
  if (!t) return false;
  const name = `(?:${escape(t)}|${escape(titleCase(t))})`;
  return new RegExp(`^${name}(?:, photo \\d+)?(?: — .*)?$`, 'i').test(clean(alt));
}
