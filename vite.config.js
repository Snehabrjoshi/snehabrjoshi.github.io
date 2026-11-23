import { existsSync } from 'node:fs';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // Lets the masthead hide the Résumé link while public/resume.pdf is missing.
  define: { __HAS_RESUME_PDF__: existsSync('public/resume.pdf') },
  build: {
    target: 'es2022',
    sourcemap: true,
    // The three.js core chunk is ~515 kB minified (~131 kB gzip) and can't be
    // split further; every app chunk stays far below this.
    chunkSizeWarningLimit: 560,
    rollupOptions: {
      output: {
        // Vendors change rarely: keep each in its own long-cached chunk so app
        // changes don't invalidate them. three.js core is the large one.
        manualChunks(id) {
          if (id.includes('node_modules/three/build')) return 'three';
          if (id.includes('node_modules/three/examples')) return 'three-addons';
          if (id.includes('node_modules/gsap')) return 'gsap';
        },
      },
    },
  },
});
