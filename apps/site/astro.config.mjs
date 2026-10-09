// The public website (GitHub Pages at https://amnesthesia.github.io/sanguine/). Static output, pages as .html files so the
// store listing's URLs (docs/store/listing-en-AU.md) resolve, and no image service: the PNGs are served as they are.
import { defineConfig, passthroughImageService } from 'astro/config';

export default defineConfig({
  site: 'https://amnesthesia.github.io',
  base: '/sanguine',
  trailingSlash: 'never',
  build: { format: 'file' },
  image: { service: passthroughImageService() },
  devToolbar: { enabled: false },
});
