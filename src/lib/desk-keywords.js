// The image desk's projects and its first two suggestion columns (/portfolio/image-metadata/).
// Shared by the page and by scripts/keyword-ratings.mjs, which rates the same words at build time.
import { portfolios, photos, picture, SITE, KIND_LABEL } from './portfolios.js';
import { isMachineAlt } from './alt-text.js';

const SEARCH_INTENT = {
  rmaekers: ['production studio Amsterdam', 'experiential design studio Amsterdam', 'creative fabrication Amsterdam', 'brand activations Amsterdam', 'exhibition stand design Amsterdam'],
  rrproductions: ['creative technologist Amsterdam', 'industrial design', 'product design', 'product solutions', 'art installation', 'sculpture', 'custom fabrication'],
  vaguelyvulgar: ['male model Amsterdam', 'fashion model', 'editorial modelling', 'portrait photography', 'creative talent Amsterdam'],
};
const PROJECT_INTENT = {
  decor: ['festival stage design', 'event decor Amsterdam', 'art installations Amsterdam', 'set building', 'custom props'],
  signage: ['custom signage Amsterdam', 'light installations', 'exhibition design'],
  furniture: ['furniture design Amsterdam', 'interior design Amsterdam', 'custom interiors', 'product design solutions'],
  design: ['product design Amsterdam', 'interior design Amsterdam', 'creative product solutions'],
  rentals: ['event furniture rental Amsterdam', 'festival decor rental'],
  artists: ['artist collaboration', 'art production Amsterdam'],
  festivals: ['festival production Amsterdam', 'festival installations'],
  clubs: ['club decor Amsterdam', 'nightlife design'],
};
const IMAGE_VOCABULARY = ['wide view', 'close-up', 'detail', 'finished installation', 'work in progress', 'night', 'daylight', 'people', 'lighting', 'materials'];
const NOISE = new Set(['project', 'projects', 'portfolio', 'uncategorized', 'geen categorie']);
const STOPWORDS = new Set('the a an and or of in on at for with from by to is are was were this that these those our my we you your it its as into over under de het een en of van voor met op in bij door dit deze die dat mijn onze foto photo image picture'.split(' '));
const useful = (value) => String(value ?? '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const unique = (values) => [...new Set(values.map(useful).filter((value) => value && value.length > 2 && !NOISE.has(value.toLowerCase())))];
const mediaTitle = (value) => {
  const title = useful(value);
  return /(^img[_ -]?\d+$)|(^[\da-f-]{20,}$)|(^dsc[_ -]?\d+$)|(^fullsizeoutput_)/i.test(title) ? '' : title;
};
const handwrittenDescription = (image, projectTitle) => {
  const text = useful(image.caption) || useful(image.alt);
  if (!text || /^[\da-f]{8}-[\da-f-]{20,}$/i.test(text) || /^(img|dsc|fullsizeoutput)[_ -]?\w+$/i.test(text) || /\.(jpe?g|png|gif|webp)$/i.test(text)) return '';
  if (text.toLowerCase() === useful(projectTitle).toLowerCase() || /,\s*(photo|image|picture)\s+\d+$/i.test(text)) return '';
  if (isMachineAlt(text, image.url, projectTitle)) return '';
  return text;
};
const suggestionsFor = (portfolio, post) => unique([
  ...(SEARCH_INTENT[portfolio.id] ?? []),
  ...post.kinds.flatMap((kind) => PROJECT_INTENT[kind] ?? []),
  ...post.kinds.map((kind) => KIND_LABEL[kind]),
  ...post.categories,
  ...post.tags,
  post.title,
]).slice(0, 18);
const wordsIn = (text) => useful(text).match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? [];
const metadataKeywords = (texts, limit = 12) => {
  const scores = new Map();
  const add = (label, points) => {
    const clean = useful(label).replace(/^[’'-]+|[’'-]+$/g, '');
    const key = clean.toLowerCase();
    if (clean.length < 3 || STOPWORDS.has(key) || NOISE.has(key) || /^\d+$/.test(key)) return;
    const entry = scores.get(key) ?? {label: clean, score: 0};
    entry.score += points;
    scores.set(key, entry);
  };
  for (const text of texts) {
    const words = wordsIn(text);
    words.forEach((word) => add(word, 1));
    for (let index = 0; index < words.length - 1; index++) {
      if (!STOPWORDS.has(words[index].toLowerCase()) && !STOPWORDS.has(words[index + 1].toLowerCase())) add(`${words[index]} ${words[index + 1]}`, 1.6);
    }
  }
  return [...scores.values()].sort((a, b) => b.score - a.score || a.label.localeCompare(b.label)).slice(0, limit).map(({label}) => label);
};

/** Every project on the desk, with its pictures and its first two suggestion columns. */
export function deskProjects() {
  return portfolios.flatMap((portfolio) => portfolio.posts.map((post) => {
    const projectPhotos = photos(post);
    const handwritten = projectPhotos.map((image, index) => ({index, text: handwrittenDescription(image, post.title)})).filter(({text}) => text);
    const originalSuggestions = metadataKeywords(handwritten.map(({text}) => text));
    return {
      id: `${portfolio.id}/${post.slug}`,
      portfolio: portfolio.name,
      title: post.title.trim(),
      href: `${SITE}${post.path}`,
      // the picture that leads the project today (its card, its page, the wall); Ryan can choose another
      hero: post.featured?.url ?? '',
      originalSuggestions,
      currentKeywords: unique([...originalSuggestions, ...post.kinds.map((kind) => KIND_LABEL[kind]), ...post.categories, ...post.tags]),
      // the customer-search phrases alone (no titles or tags): the third column finds related words for these
      intent: unique([...(SEARCH_INTENT[portfolio.id] ?? []), ...post.kinds.flatMap((kind) => PROJECT_INTENT[kind] ?? [])]),
      searchSuggestions: suggestionsFor(portfolio, post).filter((tag) => !originalSuggestions.some((original) => original.toLowerCase() === tag.toLowerCase())),
      images: projectPhotos.map((image, index) => {
        const pic = picture(image);
        const nearby = handwritten.filter((item) => item.index !== index).sort((a, b) => Math.abs(a.index - index) - Math.abs(b.index - index)).slice(0, 3);
        const nearbySuggestions = metadataKeywords(nearby.map(({text}) => text), 8);
        return {
          key: `${portfolio.id}/${post.slug}::${image.url}`,
          url: image.url,
          index: index + 1,
          src: pic.src,
          srcset: pic.srcset ?? '',
          width: pic.width,
          height: pic.height,
          existingDescription: handwrittenDescription(image, post.title),
          nearby: nearby.map(({index: sourceIndex, text}) => ({image: sourceIndex + 1, text})),
          nearbySuggestions,
          suggestions: unique([...nearbySuggestions, mediaTitle(image.title), ...IMAGE_VOCABULARY]),
        };
      }),
    };
  })).filter((project) => project.images.length);
}

/** The words the third column rates for a project: its own words and the other two columns, once each. */
export function ratingCandidates(project) {
  return unique([...project.originalSuggestions, ...project.searchSuggestions, ...project.currentKeywords]);
}
