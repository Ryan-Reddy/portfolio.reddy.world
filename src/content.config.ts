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

// One interview per file, at /portfolio/interviews/<file name>/ (reddy.world#176): the questions
// as ## headings, the answers in the interviewee's own words. Nothing else is written on the page
// but an intro in Ryan's own words.
const interviews = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/interviews' }),
  schema: z.object({
    title: z.string(),
    // the title's language when it differs from the interview's
    titleLang: z.string().optional(),
    // the <title>, when the title is too long for a search result
    seoTitle: z.string().optional(),
    description: z.string().min(50).max(160),
    // the interview's language; the page is marked with it
    lang: z.string().default('nl'),
    // the words before the interviewee's name, as the transcript has them
    byline: z.string(),
    interviewee: z.object({
      name: z.string(),
      role: z.string(),
      roleLang: z.string().optional(),
      org: z.string(),
      orgUrl: z.url(),
    }),
    year: z.number().int(),
    // Ryan's own words above the interview, quoted and dated in the PR that adds them
    intro: z.object({ text: z.string(), lang: z.string().default('en') }).optional(),
    // the case study the interview was for
    related: reference('software'),
    // the sitemap's lastmod
    updated: z.coerce.date(),
  }),
});

export const collections = { software, interviews };
