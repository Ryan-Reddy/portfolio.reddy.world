import { defineCollection } from 'astro:content';
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
    live: z.url().optional(),
    // the button's words, before the arrow; default "Open <title>"
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
    // the sitemap's lastmod
    updated: z.coerce.date(),
    // files in public/images/software/<slug>/, in reading order; the first heads the page
    screenshots: z.array(z.object({
      file: z.string(),
      alt: z.string().min(1),
      caption: z.string().min(1),
    })).default([]),
  }),
});

export const collections = { software };
