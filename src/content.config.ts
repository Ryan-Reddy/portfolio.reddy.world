import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// One case study per software project, at /portfolio/software/<file name>/ (reddy.world#135).
// The build fails when a summary or a picture's alt text is missing.
const software = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/software' }),
  schema: z.object({
    title: z.string(),
    // the meta description and the line on the overview
    summary: z.string().min(120).max(160),
    // one short line under the name; also the page title's second half
    dek: z.string(),
    // the small line above the name, e.g. "Web app · neuro.reddy.world"
    eyebrow: z.string(),
    // app → SoftwareApplication; work (a job or a school project) → CreativeWork
    kind: z.enum(['app', 'work']),
    // schema.org applicationCategory and operatingSystem, for apps
    category: z.string().optional(),
    platform: z.string().optional(),
    year: z.number().int(),
    status: z.string(),
    // the app's own site
    live: z.url().optional(),
    // its store listings, the first is the main button; only listings Ryan or a source gave.
    // The app's own /app.json (version, date, description, listings) wins at build time.
    store: z.array(z.object({ name: z.string(), url: z.url() })).default([]),
    // the main button's words, before the arrow
    cta: z.string().optional(),
    // only a public repo
    repo: z.url().optional(),
    stack: z.array(z.string()).default([]),
    // the facts rail
    audience: z.string().optional(),
    maker: z.string().optional(),
    role: z.string(),
    when: z.string().optional(),
    // the overview's order, low first
    order: z.number().default(99),
    // where reddy.world's wall places it, by its branch ids (reddy.world src/data/branches.ts);
    // left out, it sits under "Software & web". "art" is "Inventions & art" (Ryan, 2026-10-25)
    branch: z.enum(['software', 'decor', 'signs', 'furniture', 'art', 'performance', 'work']).optional(),
    // the work it is built on, credited in the facts rail and as schema.org isBasedOn
    credit: z.object({ name: z.string(), url: z.url() }).optional(),
    // a line the page must carry, e.g. that it is not affiliated with the names it uses
    disclaimer: z.string().optional(),
    // the sitemap's lastmod
    updated: z.coerce.date(),
    // files in public/images/software/<slug>/, in reading order; the first heads the page
    screenshots: z.array(z.object({
      file: z.string(),
      alt: z.string().min(1),
      caption: z.string().min(1),
      // capture: a real screenshot; display: an image made around the app (Ryan's displays, #156)
      kind: z.enum(['capture', 'display']).default('capture'),
      // two matching pictures marked before and after head the page as a before/after slider;
      // label names each side on it
      pair: z.enum(['before', 'after']).optional(),
      label: z.string().optional(),
      // the same view in dark mode, shown when the visitor's system is dark (Ryan, 2026-10-21, #40:
      // "screenshot is in light on darkmode ... these screenshots should be both depending how they get shown")
      dark: z.string().optional(),
    })).default([]),
  }),
});

// what the desk gives an article's picture beyond its alt: keywords, and the photographer who took it
const pictureWords = {
  keywords: z.array(z.string()).optional(),
  credit: z.object({ name: z.string(), url: z.url().optional() }).optional(),
};

// One article per file (reddy.world#183, decision 4 B): interviews, stories, case studies, projects,
// recipes, writing and poems, at /portfolio/<kind's path>/<file name>/ (src/lib/article-kinds.js).
// Nothing is written on the page but Ryan's own words and, in an interview, the interviewee's answers.
const articles = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/articles' }),
  schema: z.object({
    kind: z.enum(['interview', 'story', 'case-study', 'project', 'recipe', 'writing', 'poem']),
    title: z.string(),
    // the title's language when it differs from the article's
    titleLang: z.string().optional(),
    // the <title>, when the title is too long for a search result
    seoTitle: z.string().optional(),
    description: z.string().min(50).max(160),
    // the line on the wall, in Ryan's words; the description when there is none
    summary: z.string().optional(),
    // the article's language; the page is marked with it
    lang: z.string().default('en'),
    // an interview: the words before the person's name (as the transcript has them), and the person
    byline: z.string().optional(),
    person: z.object({
      name: z.string(),
      role: z.string(),
      roleLang: z.string().optional(),
      org: z.string().optional(),
      orgUrl: z.url().optional(),
      // words of the role that link to where they stand on the organisation's own site; no words are added
      roleLinks: z.record(z.string(), z.url()).optional(),
      // the organisation's own profiles (as its site links them), for the structured data
      orgSameAs: z.array(z.url()).optional(),
      // the person's own profile (as Ryan gives it): the name links there, and the structured data
      profile: z.url().optional(),
    }).optional(),
    year: z.number().int(),
    // when it went online: the feed's date (the update when there is none)
    published: z.coerce.date().optional(),
    // the picture across the top, in public/images/articles/<slug>/, alt in the article's language;
    // `share`: a JPEG copy for link cards (LinkedIn and others read JPEG and PNG, not always WebP);
    // its keywords (the ImageObject's) and its photographer (the caption), as Ryan gave them on the desk
    hero: z.object({ file: z.string(), alt: z.string().min(1), share: z.string().optional(), ...pictureWords }).optional(),
    // the pictures in the text, for the structured data (the text itself shows them, with their credit)
    figures: z.array(z.object({ file: z.string(), alt: z.string().min(1), ...pictureWords })).optional(),
    // Ryan's own words above the article, quoted and dated in the PR that adds them
    intro: z.object({ text: z.string(), lang: z.string().default('en') }).optional(),
    // the case study it belongs to, when there is one (an interview done for it)
    related: reference('software').optional(),
    // the sitemap's lastmod
    updated: z.coerce.date(),
    // the desk draft it was published from (scripts/desk-articles.mjs), so Send to site keeps the two tied
    desk: z.string().optional(),
  }).refine((d) => d.kind !== 'interview' || Boolean(d.person && d.byline), { message: 'an interview names its person and its byline' }),
});

export const collections = { software, articles };
