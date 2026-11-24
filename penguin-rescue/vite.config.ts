import { defineConfig } from 'vite';

// Relative base so the build works from any folder on GitHub Pages.
// The build lands in /games/penguin-rescue/ at the root of the site.
export default defineConfig({
  base: './',
  build: {
    outDir: '../games/penguin-rescue',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
  },
});
