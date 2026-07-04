// @ts-check
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';

// KaiTeamTool — indie portfolio. Static; sitemap integration for SEO.
// Served at the root on both targets:
//   GitHub Pages -> https://kaiteamtool.github.io/   (repo: KaiTeamTool.github.io)
//   Cloudflare   -> https://<project>.pages.dev/
// Root serving means no `base` is needed and all "/..." links work as-is.
export default defineConfig({
  site: 'https://kaiteamtool.github.io',
  integrations: [sitemap()],
});