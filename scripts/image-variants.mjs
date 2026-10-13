// Makes the smaller copies picture() expects next to a self-hosted image:
// name-480w.jpg, name-800w.jpg, name-1200w.jpg, only below the image's own width.
// For pictures under public/images/<portfolio>/<YYYY>/<MM>/ (the old WordPress uploads,
// and new ones filed the same way). Uses sharp, which Astro already installs.
//
//   node scripts/image-variants.mjs public/images/rmaekers/2017/10/photo.jpg [...more]
//   node scripts/image-variants.mjs public/images/rmaekers        (a whole folder)
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

sharp.cache(false);
const WIDTHS = [480, 800, 1200];
const isMaster = (f) => /\.(jpe?g|png)$/i.test(f) && !/-\d+w\.(jpe?g|png)$/i.test(f);
const walk = (p) => fs.statSync(p).isDirectory()
  ? fs.readdirSync(p).flatMap((name) => walk(path.join(p, name)))
  : [p];

let made = 0;
for (const file of process.argv.slice(2).flatMap(walk).filter(isMaster)) {
  const buf = fs.readFileSync(file);
  const { width } = await sharp(buf).metadata();
  for (const w of WIDTHS.filter((x) => x < width)) {
    const to = file.replace(/\.(jpe?g|png)$/i, `-${w}w.$1`);
    if (fs.existsSync(to)) continue;
    const img = sharp(buf).resize({ width: w });
    await (/\.png$/i.test(file)
      ? img.png({ compressionLevel: 9 })
      : img.jpeg({ quality: 78, progressive: true, mozjpeg: true })).toFile(to);
    made++;
  }
}
console.log(`image-variants: ${made} copies made`);
