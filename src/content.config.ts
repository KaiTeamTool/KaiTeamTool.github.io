import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Each project is a markdown file in src/content/projects/.
// The body of the file becomes the long-form "THE IDEA" copy on the detail page.
const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    tagline: z.string(),
    status: z.enum(['idea', 'in-progress', 'active', 'archive']),
    stack: z.array(z.string()),
    landing: z.string().url().optional(),
    repo: z.string().url().optional(),
    // optional media: a demo loop and up to a few screenshots. When absent,
    // the detail page renders no media blocks (no empty placeholders).
    demo: z.string().optional(),
    shots: z.array(z.string()).optional(),
    // controls grid + list order; lower comes first
    order: z.number(),
  }),
});

export const collections = { projects };
