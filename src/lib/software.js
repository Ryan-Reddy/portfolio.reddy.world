// The software case studies' pictures: public/images/software/<slug>/<file>.webp, with the
// -480w/-800w/-1200w copies scripts/image-variants.mjs makes below the picture's own width.
// The interviews' pictures sit the same way under public/images/interviews/<slug>/.
import path from 'node:path';
import sharp from 'sharp';

const VARIANTS = [480, 800, 1200];

/** The picture's URL on reddy.world, root-absolute */
export const shotUrl = (slug, file) => `/portfolio/images/software/${slug}/${file}`;

/** url, src, srcset, width and height of public/images/<dir>/<file>, read at build time */
export async function pictureAt(dir, file) {
  const { width, height } = await sharp(path.join(process.cwd(), 'public', 'images', dir, file)).metadata();
  const url = `/portfolio/images/${dir}/${file}`;
  const at = (w) => url.replace(/\.(webp|jpe?g|png)$/i, `-${w}w.$1`);
  const widths = VARIANTS.filter((w) => w < width);
  return {
    src: widths.includes(1200) ? at(1200) : url,
    srcset: [...widths.map((w) => `${at(w)} ${w}w`), `${url} ${width}w`].join(', '),
    url,
    width,
    height,
  };
}

const picture = (slug, file) => pictureAt(`software/${slug}`, file);

/** A case study's picture, with its dark-mode twin's srcset where there is one */
export async function shot(slug, { file, alt, caption, dark }) {
  const p = await picture(slug, file);
  return { ...p, alt, caption, tall: p.height > p.width, dark: dark ? (await picture(slug, dark)).srcset : undefined };
}
