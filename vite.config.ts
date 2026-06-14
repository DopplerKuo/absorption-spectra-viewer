import { defineConfig } from 'vite';

// `vite` / `vite build` run the WEB APP (root index.html -> dist/), which is what gets deployed.
// The reusable library bundle is built separately via `npm run build:lib` (vite.lib.config.ts).
export default defineConfig({
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
