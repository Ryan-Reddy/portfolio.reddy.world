// Send to site's web copies of the pictures in published articles (.github/workflows/desk-to-site.yml, in the
// job that has no token). Each picture Ryan added to an article he published, from the original kept in his
// account (reddy.world's /api/desk-upload), becomes public/images/articles/<slug>/<id>.webp at most 2000 px
// wide, with -480w/-800w/-1200w copies below its width (as scripts/image-variants.mjs makes them) and, for the
// lead picture, a 1200×628 JPEG link card. The build stamps the served ones with Ryan's mark
// (scripts/watermark.mjs). Pictures no longer in a desk article leave its folder. A copy that is there already
// is kept, so sending twice changes nothing.
//
//   node scripts/desk-pictures.mjs <desk.json> <folder with the originals> <pictures.json to write>
//     (the originals are named as the last part of their path in the account)
//   then: node scripts/import-image-keywords.mjs <desk.json> --pictures <pictures.json>
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { readySlugs, shownPictures, deskIdOf } from './desk-articles.mjs';
import {isPublicArchivePost} from '../src/lib/archive-curation.js';
import { articleImages } from '../src/lib/article-kinds.js';
import {projectPictureFolder, PICTURE_ID} from '../src/lib/project-pictures.js';

sharp.cache(false);
const WIDTHS = [480, 800, 1200];
const MAX = 2000;

/**
 * Makes the copies and says where they are, per article id: {pictureId: {file, width, height, src, srcset, share?}}.
 * @param {object} state the desk
 * @param {Record<string, {desk?: string}>} existing the article files there are now, by slug
 * @param {string} originals the folder with the originals
 * @param {string} publicDir the site's public/ folder
 */
export async function makePictures(state, existing, originals, publicDir, allowedProjects = null) {
  const slugs = readySlugs(state, existing);
  const out = {};
  const work=Object.entries(slugs).map(([id,slug])=>({id,article:state.articles[id],folder:articleImages(slug)}));
  for (const [id,project] of Object.entries(state.projects ?? {})) {
    if ((allowedProjects && !allowedProjects.has(id)) || !Object.keys(project.pictures ?? {}).length) continue;
    work.push({id,project:true,article:{...project,pictures:Object.fromEntries(Object.entries(project.pictures).filter(([pid,p])=>PICTURE_ID.test(pid) && !p.removed)),content:''},folder:projectPictureFolder(id)});
  }
  for (const task of work) {
    const {id,article,folder}=task;
    const shown = task.project ? Object.keys(article.pictures) : shownPictures(article);
    const dir = path.join(publicDir, 'images', folder);
    const made = {};
    for (const pid of shown) {
      const master = path.join(dir, `${pid}.webp`);
      // a draft seeded from the repo (src/data/article-seeds/) brings its picture as this copy, with no original
      if (!existsSync(master)) {
        const original = article.pictures[pid].path && path.join(originals, path.basename(article.pictures[pid].path));
        if (!original || !existsSync(original)) {if(task.project)throw new Error('Project upload is missing: '+id+'/'+pid);continue;} // not fetched: the article waits (scripts/desk-articles.mjs says so)
        mkdirSync(dir, { recursive: true });
        // turned the way the camera held it, at most 2000 px wide
        await sharp(original).rotate().resize({ width: MAX, withoutEnlargement: true }).webp({ quality: 82 }).toFile(master);
      }
      const { width, height } = await sharp(master).metadata();
      const url = `/portfolio/images/${folder}/${pid}.webp`;
      const widths = WIDTHS.filter((w) => w < width);
      for (const w of widths) {
        const copy = path.join(dir, `${pid}-${w}w.webp`);
        if (!existsSync(copy)) await sharp(master).resize({ width: w }).webp({ quality: 80 }).toFile(copy);
      }
      const entry = {
        file: `${pid}.webp`, width, height,
        src: widths.includes(1200) ? url.replace(/\.webp$/, '-1200w.webp') : url,
        srcset: [...widths.map((w) => `${url.replace(/\.webp$/, `-${w}w.webp`)} ${w}w`), `${url} ${width}w`].join(', '),
      };
      if (pid === article.hero) {
        const card = path.join(dir, `${pid}-share.jpg`);
        if (!existsSync(card)) await sharp(master).resize(1200, 628, { fit: 'cover', position: 'attention' }).jpeg({ quality: 85, mozjpeg: true }).toFile(card);
        entry.share = `${pid}-share.jpg`;
      }
      made[pid] = entry;
    }
    // what is no longer in the article leaves its folder
    if (existsSync(dir)) {
      for (const name of readdirSync(dir)) {
        const pid = name.match(/^(p[a-z0-9]+?)(?:-\d+w|-share)?\.(webp|jpg)$/)?.[1];
        if (pid && !made[pid]) unlinkSync(path.join(dir, name));
      }
    }
    if (task.project) {out.projects ??= {};out.projects[id]=made;} else out[id] = made;
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [deskFile, originals, outFile] = process.argv.slice(2);
  if (!deskFile || !originals || !outFile) {
    console.error('usage: node scripts/desk-pictures.mjs <desk.json> <originals folder> <pictures.json>');
    process.exit(2);
  }
  const state = JSON.parse(readFileSync(deskFile, 'utf-8'));
  const ARTICLES = new URL('../src/content/articles/', import.meta.url);
  const existing = existsSync(ARTICLES) ? Object.fromEntries(readdirSync(ARTICLES).filter((f) => f.endsWith('.md')).map((f) => [f.replace(/\.md$/, ''), { desk: deskIdOf(readFileSync(new URL(f, ARTICLES), 'utf-8')) }])) : {};
  const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
  const allowedProjects=new Set(['rmaekers','rrproductions','vaguelyvulgar'].flatMap(key=>JSON.parse(readFileSync(new URL('../src/data/'+key+'.json',import.meta.url),'utf8')).posts.filter(post=>isPublicArchivePost(key,post)).map(post=>key+'/'+post.slug)));
  const made = await makePictures(state, existing, originals, publicDir, allowedProjects);
  writeFileSync(outFile, `${JSON.stringify(made, null, 1)}\n`);
  const groups=[...Object.entries(made).filter(([key])=>key!=='projects').map(([,pictures])=>pictures),...Object.values(made.projects ?? {})];
  const count=groups.reduce((sum,pictures)=>sum+Object.keys(pictures).length,0);
  console.log(`desk-pictures: ${count} pictures prepared for ${groups.length} pieces`);
}
