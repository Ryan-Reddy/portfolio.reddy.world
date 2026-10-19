// The software case studies' pictures: public/images/software/<slug>/<file>.webp, with the
// -480w/-800w/-1200w copies scripts/image-variants.mjs makes below the picture's own width.
import path from 'node:path';
import sharp from 'sharp';

const VARIANTS = [480, 800, 1200];

/** The picture's URL on reddy.world, root-absolute */
export const shotUrl = (slug, file) => `/portfolio/images/software/${slug}/${file}`;

/** src, srcset, width and height of a case study's picture, read from the file at build time */
export async function shot(slug, { file, alt, caption }) {
  const { width, height } = await sharp(path.join(process.cwd(), 'public', 'images', 'software', slug, file)).metadata();
  const url = shotUrl(slug, file);
  const at = (w) => url.replace(/\.(webp|jpe?g|png)$/i, `-${w}w.$1`);
  const widths = VARIANTS.filter((w) => w < width);
  return {
    src: widths.includes(1200) ? at(1200) : url,
    srcset: [...widths.map((w) => `${at(w)} ${w}w`), `${url} ${width}w`].join(', '),
    url,
    width,
    height,
    alt,
    caption,
    tall: height > width,
  };
}
