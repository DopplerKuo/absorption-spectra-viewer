import { defineConfig } from 'vite';

// Library build (`vite build`) bundles the framework-agnostic engine from src/index.ts.
// Dev server (`vite`) serves the root index.html app, which imports ./app/main.ts.
export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'Photolyze',
      fileName: 'photolyze',
      formats: ['es', 'umd'],
    },
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
