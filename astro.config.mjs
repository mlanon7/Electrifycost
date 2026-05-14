import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
// NOTE: @astrojs/sitemap 3.1.6 crashes against Astro 4.16.19 ("Cannot read properties of undefined (reading 'reduce')").
// Disabled until upgraded. Submit URLs directly to Google Search Console in the meantime.
// import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://electrifycost.com',
  integrations: [
    react(),
    tailwind({ applyBaseStyles: false }),
    // sitemap({ changefreq: 'weekly', priority: 0.7, lastmod: new Date() }),
  ],
  build: { inlineStylesheets: 'auto' },
  vite: {
    cacheDir: '.astro/vite-cache',  // project-local cache to avoid EPERM on node_modules\.vite under Windows OneDrive/AV
    ssr: { noExternal: [] },
  },
});
