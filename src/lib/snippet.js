// A page's title and description as a search result shows them: about 60 characters of title and
// 50 to 160 of description. reddy.world checks every live page against the same numbers
// (scripts/snippet-lengths.mjs there) and scripts/check-archive.mjs checks the build here.
// The page's own words are cut to fit at a word; nothing new is added.
export const TITLE_MAX = 60;
export const DESCRIPTION_MIN = 50;
export const DESCRIPTION_MAX = 160;

/** `text` cut at a word so it is at most `max` characters, ending in … when it was cut. */
export function cutAt(text, max) {
  const words = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (words.length <= max) return words;
  const room = words.slice(0, max - 1);
  const space = room.lastIndexOf(' ');
  return `${(space > max / 2 ? room.slice(0, space) : room).replace(/[\s,;:.!?…–—-]+$/, '')}…`;
}

/** The first title that fits; the last one cut at a word when none does. */
export function fitTitle(...candidates) {
  const titles = candidates.map((title) => String(title ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  return titles.find((title) => title.length <= TITLE_MAX) ?? cutAt(titles.at(-1), TITLE_MAX);
}

/**
 * The first text with words in it (web addresses left out: a result can't link them), then `tail`
 * ("Light by ReddyMaekers, 2018"), the text cut at a word so that both fit in 160 characters.
 */
export function fitDescription(texts, tail = '') {
  const text = texts.map((t) => String(t ?? '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim()).find(Boolean) ?? '';
  const end = tail ? ` ${tail}.` : '';
  const full = `${text.replace(/[.!?…]?$/, (stop) => stop || '.')}${end}`;
  return full.length <= DESCRIPTION_MAX ? full : `${cutAt(text, DESCRIPTION_MAX - end.length)}${end}`;
}
