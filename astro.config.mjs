// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';

// Same architecture as sdx-website / jenomics-website / amaze_genius / BLL_website:
// static pages + one Node endpoint (/api/contact), CSS inlined, self-hosted fonts, no CMS.
export default defineConfig({
  site: process.env.SITE_URL || 'https://pe-admin.de',
  trailingSlash: 'always',
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  build: {
    inlineStylesheets: 'always',
    format: 'directory',
  },
  compressHTML: true,
  security: { checkOrigin: false },
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  integrations: [
    sitemap({
      
      filter: (page) => !page.includes('/api/'),
    }),
  ],
});
